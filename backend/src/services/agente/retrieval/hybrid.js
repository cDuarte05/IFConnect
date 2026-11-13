const { Op } = require('sequelize');
const { Article, Campaign, Category } = require('../../../models');
const { getConfig } = require('../config');
const { obterProvider } = require('../ingest/embedder');
const { buscarLexical, dfRatio, totalChunks } = require('./lexical');
const { buscarVetorial } = require('./vector');

/**
 * Recuperação híbrida (lexical BM25 + vetorial) com Reciprocal Rank Fusion (RRF).
 *
 * Esta é a função crítica de segurança do RAG (RN-01, RN-02, RN-05, RF-10):
 * mesmo que a tabela agente_chunks contenha chunks obsoletos ou "fantasmas", NENHUM candidato
 * sobrevive se a fonte não estiver pública NO BANCO no momento da consulta. A re-hidratação
 * (e o filtro de status) acontece ANTES de qualquer corte por relevância ou por k.
 *
 * Observações:
 * - O texto dos trechos devolvidos ainda NÃO está escapado; a T11 escapa "<" e ">" ao montar o prompt.
 * - Lista de fontes vazia significa "sem contexto"; quem decide o que fazer é a T12.
 */

const RRF_K = 60;
const CANDIDATOS_POR_RAMO = 20;
const MAX_CHUNKS_POR_DOCUMENTO = 2;
const LEXICAL_MAX_DF = 0.25;
const MIN_CHUNKS_PARA_DF = 8;

const STATUS_PUBLICOS_CAMPANHA = ['ativa', 'financiada'];

/**
 * Funde listas já ordenadas via RRF. Função pura.
 * A contribuição de um item na posição p (começando em 1) é 1 / (rrfK + p), somada entre as listas.
 *
 * @param {Array<Array<{chunkId: string}|string>|null>} listas
 * @returns {Map<string, { chunkId: string, rrf: number, posicoes: Array<number|null> }>}
 */
function fundirRrf(listas, { rrfK = RRF_K } = {}) {
  const resultado = new Map();
  const todas = Array.isArray(listas) ? listas : [];

  todas.forEach((lista, idxLista) => {
    if (!Array.isArray(lista)) return;

    lista.forEach((item, idx) => {
      const chunkId = item && typeof item === 'object' ? item.chunkId : item;
      if (chunkId === undefined || chunkId === null) return;

      const posicao = idx + 1;
      let entrada = resultado.get(chunkId);
      if (!entrada) {
        entrada = { chunkId, rrf: 0, posicoes: todas.map(() => null) };
        resultado.set(chunkId, entrada);
      }
      // Se o mesmo chunk aparecer duas vezes na mesma lista, vale somente a primeira posição
      if (entrada.posicoes[idxLista] === null) {
        entrada.posicoes[idxLista] = posicao;
        entrada.rrf += 1 / (rrfK + posicao);
      }
    });
  });

  return resultado;
}

/**
 * Re-hidrata fontes públicas diretamente do banco. NUNCA seleciona autor, e-mail ou dados de usuário.
 */
async function carregarFontesPublicas(candidatos) {
  const idsArtigos = [...new Set(candidatos.filter((c) => c.sourceType === 'artigo').map((c) => c.sourceId))];
  const idsCampanhas = [...new Set(candidatos.filter((c) => c.sourceType === 'campanha').map((c) => c.sourceId))];

  const [artigos, campanhas] = await Promise.all([
    idsArtigos.length
      ? Article.findAll({
          where: { id: idsArtigos, status: 'publicado' },
          attributes: ['id', 'titulo', 'tipo', 'tema'],
          include: [{ model: Category, as: 'categoria', attributes: ['nome'] }],
        })
      : [],
    idsCampanhas.length
      ? Campaign.findAll({
          where: { id: idsCampanhas, status: { [Op.in]: STATUS_PUBLICOS_CAMPANHA } },
          attributes: ['id', 'titulo', 'tema', 'status', 'metaFinanceira', 'valorArrecadado'],
          include: [{ model: Category, as: 'categoria', attributes: ['nome'] }],
        })
      : [],
  ]);

  return {
    artigos: new Map(artigos.map((a) => [a.id, a])),
    campanhas: new Map(campanhas.map((c) => [c.id, c])),
  };
}

function montarFonte(sourceType, registro) {
  if (sourceType === 'artigo') {
    return {
      tipo: 'publicacao',
      id: registro.id,
      titulo: registro.titulo,
      url: `/publicacoes/${registro.id}`,
      categoria: registro.categoria?.nome || null,
      tema: registro.tema || null,
      tipoPublicacao: registro.tipo,
      status: 'publicado',
    };
  }
  return {
    tipo: 'projeto',
    id: registro.id,
    titulo: registro.titulo,
    url: `/vitrine/${registro.id}`,
    categoria: registro.categoria?.nome || null,
    tema: registro.tema || null,
    status: registro.status,
    meta: Number(registro.metaFinanceira),
    arrecadado: Number(registro.valorArrecadado),
  };
}

/**
 * Recupera os trechos finais, já filtrados por status público e agrupados por fonte.
 * Nunca lança exceção por falha do provedor de embedding (degrada para modo 'lexical').
 */
async function recuperar(
  pergunta,
  {
    config = getConfig(),
    provider,
    k = config.rag.topK,
    minScore = config.rag.minScore,
    store,
    lexicalMaxDf = LEXICAL_MAX_DF,
  } = {}
) {
  // a) Ramo lexical (apenas banco/memória; não depende de provedor externo)
  const lexical = await buscarLexical(pergunta, { k: CANDIDATOS_POR_RAMO });

  // b) Ramo vetorial: qualquer falha (inclusive provedor não configurado) degrada para lexical
  let vetorial = null;
  let vetorialErro = null;
  let modo = 'hibrido';
  try {
    const prov = provider || obterProvider(config);
    vetorial = await buscarVetorial(pergunta, { provider: prov, k: CANDIDATOS_POR_RAMO, store });
  } catch (err) {
    vetorial = null;
    vetorialErro = err && err.message ? String(err.message) : 'falha desconhecida';
    modo = 'lexical';
  }

  // c) Fusão por RRF e união dos candidatos dos dois ramos
  const fundidos = fundirRrf([lexical, vetorial]);
  const candidatosMap = new Map();

  for (const item of lexical) {
    candidatosMap.set(item.chunkId, {
      chunkId: item.chunkId,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      chunkIndex: item.chunkIndex,
      texto: item.texto,
      cobertura: item.cobertura,
      termosCasados: item.termosCasados || [],
      cosseno: null,
    });
  }
  for (const item of vetorial || []) {
    const existente = candidatosMap.get(item.chunkId);
    if (existente) {
      existente.cosseno = item.score;
    } else {
      candidatosMap.set(item.chunkId, {
        chunkId: item.chunkId,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        chunkIndex: item.chunkIndex,
        texto: item.texto,
        cobertura: null,
        termosCasados: [],
        cosseno: item.score,
      });
    }
  }

  let candidatos = [...candidatosMap.values()].map((c) => ({
    ...c,
    rrf: fundidos.get(c.chunkId)?.rrf || 0,
  }));

  // d) RE-HIDRATAÇÃO E FILTRO DE STATUS ANTES de qualquer corte (RN-01/RN-02/RF-10)
  const fontesBanco = await carregarFontesPublicas(candidatos);
  const totalAntesStatus = candidatos.length;
  candidatos = candidatos.filter((c) =>
    c.sourceType === 'artigo' ? fontesBanco.artigos.has(c.sourceId) : fontesBanco.campanhas.has(c.sourceId)
  );
  const descartadosPorStatus = totalAntesStatus - candidatos.length;

  // e) Portão de relevância calibrado (T10-fix)
  // Passa se o cosseno atingir minScore (quando calibrado) OU se houve correspondência lexical específica.
  // Um candidato só satisfaz o critério lexical se algum token de termosCasados tiver dfRatio <= LEXICAL_MAX_DF.
  // Se o índice tiver menos de MIN_CHUNKS_PARA_DF chunks, mantém a regra antiga (cobertura > 0).
  const nChunksTotal = totalChunks();
  const totalAntesRelevancia = candidatos.length;
  let descartadosPorTermoGenerico = 0;

  candidatos = candidatos.filter((c) => {
    const passaVetor =
      minScore !== null && minScore !== undefined && c.cosseno !== null && c.cosseno >= minScore;

    const temCasamentoLexical = c.cobertura !== null && c.cobertura > 0;
    let passaLexical = false;

    if (temCasamentoLexical) {
      if (nChunksTotal < MIN_CHUNKS_PARA_DF) {
        passaLexical = true;
      } else {
        const temTermoEspecifico =
          Array.isArray(c.termosCasados) &&
          c.termosCasados.some((t) => dfRatio(t) <= lexicalMaxDf);
        if (temTermoEspecifico) {
          passaLexical = true;
        } else if (!passaVetor) {
          descartadosPorTermoGenerico += 1;
        }
      }
    }

    return passaVetor || passaLexical;
  });
  const descartadosPorRelevancia = totalAntesRelevancia - candidatos.length;

  // f) Ordena por rrf desc (desempate por chunkId), limita por documento e corta em k
  candidatos.sort((a, b) => {
    if (b.rrf !== a.rrf) return b.rrf - a.rrf;
    return String(a.chunkId).localeCompare(String(b.chunkId));
  });

  const contagemPorFonte = new Map();
  const selecionados = [];
  for (const c of candidatos) {
    if (selecionados.length >= k) break;
    const chave = `${c.sourceType}:${c.sourceId}`;
    const usados = contagemPorFonte.get(chave) || 0;
    if (usados >= MAX_CHUNKS_POR_DOCUMENTO) continue;
    contagemPorFonte.set(chave, usados + 1);
    selecionados.push(c);
  }

  // g) Agrupa por fonte mantendo a ordem do melhor chunk; trechos em ordem de leitura (chunkIndex)
  const grupos = new Map();
  for (const c of selecionados) {
    const chave = `${c.sourceType}:${c.sourceId}`;
    let grupo = grupos.get(chave);
    if (!grupo) {
      const registro = c.sourceType === 'artigo' ? fontesBanco.artigos.get(c.sourceId) : fontesBanco.campanhas.get(c.sourceId);
      grupo = {
        ...montarFonte(c.sourceType, registro),
        trechos: [],
        rrf: c.rrf,
        cosseno: c.cosseno,
        cobertura: c.cobertura,
      };
      grupos.set(chave, grupo);
    } else {
      grupo.rrf = Math.max(grupo.rrf, c.rrf);
      if (c.cosseno !== null && (grupo.cosseno === null || c.cosseno > grupo.cosseno)) grupo.cosseno = c.cosseno;
      if (c.cobertura !== null && (grupo.cobertura === null || c.cobertura > grupo.cobertura)) grupo.cobertura = c.cobertura;
    }
    grupo.trechos.push({ chunkIndex: c.chunkIndex, texto: c.texto });
  }

  const fontes = [...grupos.values()].map((fonte, idx) => {
    fonte.trechos.sort((a, b) => a.chunkIndex - b.chunkIndex);
    return { ref: idx + 1, ...fonte };
  });

  // h) Diagnóstico (sem chaves nem corpos de requisição)
  return {
    fontes,
    diagnostico: {
      modo,
      candidatosLexical: lexical.length,
      candidatosVetorial: vetorial ? vetorial.length : null,
      vetorialErro,
      descartadosPorStatus,
      descartadosPorRelevancia,
      descartadosPorTermoGenerico,
    },
  };
}

module.exports = {
  RRF_K,
  CANDIDATOS_POR_RAMO,
  MAX_CHUNKS_POR_DOCUMENTO,
  LEXICAL_MAX_DF,
  MIN_CHUNKS_PARA_DF,
  fundirRrf,
  recuperar,
};

