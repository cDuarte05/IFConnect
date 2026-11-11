// Define NODE_ENV=test antes de carregar models/database para garantir SQLite em memória
// e nunca tocar no banco de desenvolvimento (portal.sqlite).
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const { sequelize, Article, Campaign, Category, AgentChunk } = require('../../../src/models');
const { getConfig } = require('../../../src/services/agente/config');
const { criarMockEmbeddingProvider } = require('../../../src/services/agente/providers/embedding/mock');
const {
  montarDocumentoArtigo,
  montarDocumentoCampanha,
  dividirDocumento,
  hashDocumento,
} = require('../../../src/services/agente/ingest/chunker');
const {
  obterProvider,
  descreverProvider,
  embedDocumentos,
  limparCache,
} = require('../../../src/services/agente/ingest/embedder');
const { indexarFonte } = require('../../../src/services/agente/ingest/indexer');
const { invalidarIndice } = require('../../../src/services/agente/retrieval/indice');
const { buscarLexical } = require('../../../src/services/agente/retrieval/lexical');
const { buscarVetorial } = require('../../../src/services/agente/retrieval/vector');
const { recuperar, CANDIDATOS_POR_RAMO } = require('../../../src/services/agente/retrieval/hybrid');
const { ehPerguntaDeNavegacao } = require('../../../src/services/agente/generation/intencao');

const CAMINHO_DATASET = path.join(__dirname, 'dataset.json');
const CAMINHO_RELATORIO = path.join(__dirname, 'ultimo-relatorio.json');
const GRUPOS_RELEVANTES = ['lexical', 'parafrase', 'corpo', 'distrator', 'status'];
const LIMIARES = Array.from({ length: 11 }, (_, i) => Number((0.3 + i * 0.05).toFixed(2)));
const ATRASO_PROVIDER_REAL_MS = 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv = []) {
  let providerNome = null;
  let k = 4;
  let json = false;

  for (const arg of argv) {
    if (arg === '--json') {
      json = true;
    } else if (arg.startsWith('--provider=')) {
      const val = arg.slice('--provider='.length).trim();
      if (val === 'mock' || val === 'gemini') providerNome = val;
    } else if (arg.startsWith('--k=')) {
      const val = Number(arg.slice('--k='.length));
      if (Number.isInteger(val) && val > 0) k = val;
    }
  }

  return { providerNome, k, json };
}

function resolverProvider(providerNome) {
  const config = getConfig();
  const escolhido =
    providerNome || (process.env.AGENTE_RAG_EMBEDDING_API_KEY ? 'gemini' : 'mock');

  if (escolhido === 'mock') {
    return criarMockEmbeddingProvider(config);
  }

  return obterProvider({
    ...config,
    rag: {
      ...config.rag,
      embeddingProvider: 'gemini',
    },
  });
}

function extrairChavesUnicas(chavesBrutas, k) {
  const vistas = new Set();
  const resultado = [];
  for (const chave of chavesBrutas) {
    if (!chave || vistas.has(chave)) continue;
    vistas.add(chave);
    resultado.push(chave);
    if (resultado.length >= k) break;
  }
  return resultado;
}

function calcularMetricasModo(resultadosPorPergunta, perguntasRelevantes, chavesNaoPublicas, k) {
  let somaRecall = 0;
  let somaMrr = 0;
  const porGrupo = {};

  for (const grupo of GRUPOS_RELEVANTES) {
    porGrupo[grupo] = { total: 0, acertos: 0, recall: 0 };
  }

  for (const p of perguntasRelevantes) {
    const chavesTopK = resultadosPorPergunta.get(p.id) || [];
    const pos = chavesTopK.findIndex((c) => p.relevantes.includes(c));
    const acertou = pos !== -1 ? 1 : 0;

    somaRecall += acertou;
    if (pos !== -1) {
      somaMrr += 1 / (pos + 1);
    }

    if (porGrupo[p.grupo]) {
      porGrupo[p.grupo].total += 1;
      porGrupo[p.grupo].acertos += acertou;
    }
  }

  const totalRelevantes = perguntasRelevantes.length || 1;
  for (const grupo of Object.keys(porGrupo)) {
    const g = porGrupo[grupo];
    g.recall = g.total > 0 ? Number((g.acertos / g.total).toFixed(4)) : 0;
  }

  let vazamentosNaoPublicos = 0;
  for (const chaves of resultadosPorPergunta.values()) {
    for (const chave of chaves) {
      if (chavesNaoPublicas.has(chave)) {
        vazamentosNaoPublicos += 1;
      }
    }
  }

  return {
    k,
    totalPerguntas: perguntasRelevantes.length,
    recall: Number((somaRecall / totalRelevantes).toFixed(4)),
    mrr: Number((somaMrr / totalRelevantes).toFixed(4)),
    porGrupo,
    vazamentosNaoPublicos,
  };
}

/**
 * Executa a avaliação completa de recuperação do RAG sobre o dataset fixo.
 * @returns {Promise<object>} Relatório estruturado sem chaves de API nem textos de chunks.
 */
async function executarAvaliacao({ provider, k = 4, log = console.log } = {}) {
  const dataset = JSON.parse(fs.readFileSync(CAMINHO_DATASET, 'utf8'));
  const prov = provider || resolverProvider();
  const ehMock = prov.info.provider === 'mock';

  if (ehMock) {
    log('[agente:eval] Aviso: calibração de limiar só é válida com provider real');
  }

  invalidarIndice();
  limparCache();
  await sequelize.sync({ force: true });

  // 1) Preparação: categorias e documentos
  const mapCategorias = new Map();
  for (const nome of dataset.categorias || []) {
    const cat = await Category.create({ nome });
    mapCategorias.set(nome, cat.id);
  }

  const chavePorId = new Map();
  const chavesNaoPublicas = new Set();

  for (const doc of dataset.documentos) {
    let registro;
    if (doc.tipo === 'artigo') {
      registro = await Article.create({
        titulo: doc.titulo,
        resumo: doc.resumo,
        conteudo: doc.conteudo,
        tipo: doc.tipoPublicacao,
        tema: doc.tema,
        palavrasChave: doc.palavrasChave,
        status: doc.status,
        categoryId: mapCategorias.get(doc.categoria) || null,
      });
    } else {
      registro = await Campaign.create({
        titulo: doc.titulo,
        descricao: doc.descricao,
        tema: doc.tema,
        palavrasChave: doc.palavrasChave,
        metaFinanceira: doc.metaFinanceira,
        valorArrecadado: doc.valorArrecadado,
        status: doc.status,
        categoryId: mapCategorias.get(doc.categoria) || null,
      });
    }

    chavePorId.set(`${doc.tipo}:${registro.id}`, doc.chave);

    if (doc.publico) {
      await indexarFonte(doc.tipo, registro.id, { provider: prov, force: true });
      if (!ehMock) await sleep(ATRASO_PROVIDER_REAL_MS);
    } else {
      // Documentos não públicos recebem chunks "fantasma" direto em AgentChunk
      // para comprovar a eficácia do filtro de status na re-hidratação (hybrid.js).
      chavesNaoPublicas.add(doc.chave);
      const dadosDoc = {
        id: registro.id,
        ...doc,
        categoria: doc.categoria ? { nome: doc.categoria } : null,
      };
      const documento =
        doc.tipo === 'artigo'
          ? montarDocumentoArtigo(dadosDoc)
          : montarDocumentoCampanha(dadosDoc);
      const hash = hashDocumento(documento);
      const chunks = dividirDocumento(documento);
      if (chunks.length > 0) {
        const { model: embeddingModel, dim } = descreverProvider(prov);
        const vetores = await embedDocumentos(
          chunks.map((c) => c.texto),
          { provider: prov }
        );
        await AgentChunk.bulkCreate(
          chunks.map((c, idx) => ({
            sourceType: doc.tipo,
            sourceId: registro.id,
            chunkIndex: c.chunkIndex,
            texto: c.texto,
            contentHash: hash,
            embedding: vetores[idx],
            embeddingModel,
            dim,
          })),
          { validate: true }
        );
        if (!ehMock) await sleep(ATRASO_PROVIDER_REAL_MS);
      }
    }
  }

  const perguntas = dataset.perguntas || [];
  const perguntasRelevantes = perguntas.filter((p) => (p.relevantes || []).length > 0);
  const perguntasNegativas = perguntas.filter((p) => p.grupo === 'negativa');
  const perguntasIsolamento = perguntas.filter((p) => p.grupo === 'isolamento');

  const configEval = {
    ...getConfig(),
    rag: {
      ...getConfig().rag,
      embeddingProvider: prov.info.provider,
      embeddingModel: prov.info.model,
      embeddingDim: prov.info.dim,
      topK: k,
      minScore: null,
    },
  };

  // 2) Execução dos três modos base (lexical, vetorial, híbrido com minScore null)
  const resLexical = new Map();
  const resVetorial = new Map();
  const resHibrido = new Map();
  const ocorrenciasIsolamento = [];

  for (const p of perguntas) {
    const lex = await buscarLexical(p.pergunta, { k: Math.max(CANDIDATOS_POR_RAMO, k * 4) });
    resLexical.set(
      p.id,
      extrairChavesUnicas(
        lex.map((c) => chavePorId.get(`${c.sourceType}:${c.sourceId}`)),
        k
      )
    );

    const vet = await buscarVetorial(p.pergunta, {
      provider: prov,
      k: Math.max(CANDIDATOS_POR_RAMO, k * 4),
    });
    resVetorial.set(
      p.id,
      extrairChavesUnicas(
        vet.map((c) => chavePorId.get(`${c.sourceType}:${c.sourceId}`)),
        k
      )
    );
    if (!ehMock) await sleep(ATRASO_PROVIDER_REAL_MS);

    const { fontes } = await recuperar(p.pergunta, {
      config: configEval,
      provider: prov,
      k,
      minScore: null,
    });
    const chavesHibrido = extrairChavesUnicas(
      fontes.map((f) => {
        const st = f.tipo === 'publicacao' ? 'artigo' : 'campanha';
        return chavePorId.get(`${st}:${f.id}`);
      }),
      k
    );
    resHibrido.set(p.id, chavesHibrido);

    for (const chave of chavesHibrido) {
      if (chavesNaoPublicas.has(chave)) {
        ocorrenciasIsolamento.push({ perguntaId: p.id, chave, minScore: null });
      }
    }
  }

  const modos = {
    lexical: calcularMetricasModo(resLexical, perguntasRelevantes, chavesNaoPublicas, k),
    vetorial: calcularMetricasModo(resVetorial, perguntasRelevantes, chavesNaoPublicas, k),
    hibrido: calcularMetricasModo(resHibrido, perguntasRelevantes, chavesNaoPublicas, k),
  };

  // 3) Taxa de vazio correto (negativas e isolamento) com minScore null
  const taxaVazio = (lista, mapaRes) => {
    if (!lista.length) return 1;
    const vazios = lista.filter((p) => (mapaRes.get(p.id) || []).length === 0).length;
    return Number((vazios / lista.length).toFixed(4));
  };

  const detalhePorPergunta = {};
  for (const p of perguntas) {
    detalhePorPergunta[p.id] = {
      grupo: p.grupo,
      relevantes: p.relevantes,
      lexical: resLexical.get(p.id) || [],
      vetorial: resVetorial.get(p.id) || [],
      hibrido: resHibrido.get(p.id) || [],
    };
  }

  // 4) Varredura de limiar (reaproveita cache LRU do embedPergunta)
  const varreduraLimiar = [];
  for (const t of LIMIARES) {
    const mapaT = new Map();
    let isolamentoNoLimiar = true;

    for (const p of perguntas) {
      const { fontes } = await recuperar(p.pergunta, {
        config: { ...configEval, rag: { ...configEval.rag, minScore: t } },
        provider: prov,
        k,
        minScore: t,
      });
      const chaves = extrairChavesUnicas(
        fontes.map((f) => {
          const st = f.tipo === 'publicacao' ? 'artigo' : 'campanha';
          return chavePorId.get(`${st}:${f.id}`);
        }),
        k
      );
      mapaT.set(p.id, chaves);

      for (const chave of chaves) {
        if (chavesNaoPublicas.has(chave)) {
          isolamentoNoLimiar = false;
          ocorrenciasIsolamento.push({ perguntaId: p.id, chave, minScore: t });
        }
      }
    }

    const metricasT = calcularMetricasModo(mapaT, perguntasRelevantes, chavesNaoPublicas, k);
    varreduraLimiar.push({
      limiar: t,
      recall: metricasT.recall,
      vazioNegativas: taxaVazio(perguntasNegativas, mapaT),
      vazioIsolamento: taxaVazio(perguntasIsolamento, mapaT),
      isolamentoOk: isolamentoNoLimiar,
    });
  }

  // Recomendação: menor t com 100% de vazio correto nas negativas e maior recall
  const candidatosLimiar = varreduraLimiar.filter((item) => item.vazioNegativas === 1);
  let recomendacaoTexto = 'nenhum t atende';
  let limiarRecomendado = null;

  if (candidatosLimiar.length > 0) {
    const melhor = candidatosLimiar.reduce((acc, cur) =>
      cur.recall > acc.recall ? cur : acc
    );
    limiarRecomendado = melhor.limiar;
    recomendacaoTexto = `Limiar recomendado: ${melhor.limiar.toFixed(2)} (menor t com 100% de vazio correto nas negativas e maior recall=${melhor.recall})`;
  }

  // 5) Avaliação de detecção de intenção de navegação
  const falsosPositivos = [];
  const falsosNegativos = [];
  let acertosNavegacao = 0;

  for (const p of perguntas) {
    const esperado = Boolean(p.navegacao);
    const obtido = ehPerguntaDeNavegacao(p.pergunta);
    if (obtido === esperado) {
      acertosNavegacao += 1;
    } else if (obtido && !esperado) {
      falsosPositivos.push(p.id);
    } else {
      falsosNegativos.push(p.id);
    }
  }

  const relatorio = {
    geradoEm: new Date().toISOString(),
    provider: {
      provider: prov.info.provider,
      model: prov.info.model,
      dim: prov.info.dim,
    },
    k,
    isolamentoOk: ocorrenciasIsolamento.length === 0,
    ocorrenciasIsolamento,
    modos,
    negativasEisolamento: {
      vazioNegativas: taxaVazio(perguntasNegativas, resHibrido),
      vazioIsolamento: taxaVazio(perguntasIsolamento, resHibrido),
      vazioCombinado: taxaVazio([...perguntasNegativas, ...perguntasIsolamento], resHibrido),
    },
    varreduraLimiar,
    recomendacao: {
      limiar: limiarRecomendado,
      texto: recomendacaoTexto,
    },
    navegacao: {
      total: perguntas.length,
      acertos: acertosNavegacao,
      falsosPositivos,
      falsosNegativos,
    },
    detalhePorPergunta,
  };

  fs.writeFileSync(CAMINHO_RELATORIO, JSON.stringify(relatorio, null, 2), 'utf8');
  imprimirRelatorio(relatorio, log);

  return relatorio;
}

function imprimirRelatorio(r, log) {
  log(`\n=== Avaliação RAG (${r.provider.provider} / ${r.provider.model} / dim=${r.provider.dim}, k=${r.k}) ===`);
  log('\n-- Modos (perguntas relevantes) --');
  for (const nome of ['lexical', 'vetorial', 'hibrido']) {
    const m = r.modos[nome];
    const grupos = Object.entries(m.porGrupo)
      .map(([g, d]) => `${g}=${(d.recall * 100).toFixed(0)}%`)
      .join(' ');
    log(
      `  ${nome.padEnd(8)} | recall@${r.k}=${m.recall.toFixed(4)} | MRR=${m.mrr.toFixed(4)} | não-públicos=${m.vazamentosNaoPublicos} | ${grupos}`
    );
  }

  log(`\n-- Isolamento híbrido: ${r.isolamentoOk ? 'OK (0 vazamentos)' : 'FALHOU'} --`);
  log(
    `-- Vazio correto (minScore=null): negativas=${r.negativasEisolamento.vazioNegativas} | isolamento=${r.negativasEisolamento.vazioIsolamento}`
  );

  log('\n-- Varredura de limiar --');
  for (const v of r.varreduraLimiar) {
    log(
      `  t=${v.limiar.toFixed(2)} | recall=${v.recall.toFixed(4)} | vazioNeg=${v.vazioNegativas.toFixed(2)} | vazioIso=${v.vazioIsolamento.toFixed(2)} | isoOk=${v.isolamentoOk}`
    );
  }
  log(`  Recomendação: ${r.recomendacao.texto}`);

  log(
    `\n-- Navegação: ${r.navegacao.acertos}/${r.navegacao.total} | FP=[${r.navegacao.falsosPositivos.join(', ')}] | FN=[${r.navegacao.falsosNegativos.join(', ')}]`
  );
}

async function executarCli() {
  require('dotenv').config();
  const opcoes = parseArgs(process.argv.slice(2));
  const prov = resolverProvider(opcoes.providerNome);

  try {
    const relatorio = await executarAvaliacao({
      provider: prov,
      k: opcoes.k,
      log: opcoes.json ? () => {} : console.log,
    });

    if (opcoes.json) {
      console.log(JSON.stringify(relatorio, null, 2));
    }

    process.exitCode = relatorio.isolamentoOk ? 0 : 3;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  executarCli().catch((err) => {
    console.error('[agente:eval] Erro inesperado:', err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  executarAvaliacao,
  parseArgs,
};

