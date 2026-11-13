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
const DFS_VARREDURA = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60];
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

function calcularEstatisticas(numeros) {
  if (!numeros || numeros.length === 0) {
    return { min: 0, med: 0, max: 0 };
  }
  const ordenados = [...numeros].sort((a, b) => a - b);
  const min = ordenados[0];
  const max = ordenados[ordenados.length - 1];
  const meio = Math.floor(ordenados.length / 2);
  const med =
    ordenados.length % 2 === 0
      ? (ordenados[meio - 1] + ordenados[meio]) / 2
      : ordenados[meio];
  return {
    min: Number(min.toFixed(4)),
    med: Number(med.toFixed(4)),
    max: Number(max.toFixed(4)),
  };
}

function calcularMetricasModo(resultadosPorPergunta, perguntasRelevantes, chavesNaoPublicas, k) {
  let somaRecall1 = 0;
  let somaRecall3 = 0;
  let somaRecall4 = 0;
  let somaMrr = 0;
  const porGrupo = {};

  for (const grupo of GRUPOS_RELEVANTES) {
    porGrupo[grupo] = {
      total: 0,
      acertos1: 0,
      acertos3: 0,
      acertos4: 0,
      somaMrr: 0,
    };
  }

  for (const p of perguntasRelevantes) {
    const chavesTopK = resultadosPorPergunta.get(p.id) || [];
    const pos = chavesTopK.findIndex((c) => p.relevantes.includes(c));

    const ac1 = pos === 0 ? 1 : 0;
    const ac3 = pos >= 0 && pos < 3 ? 1 : 0;
    const ac4 = pos >= 0 && pos < Math.max(k, 4) ? 1 : 0;
    const mrr = pos !== -1 ? 1 / (pos + 1) : 0;

    somaRecall1 += ac1;
    somaRecall3 += ac3;
    somaRecall4 += ac4;
    somaMrr += mrr;

    if (porGrupo[p.grupo]) {
      const g = porGrupo[p.grupo];
      g.total += 1;
      g.acertos1 += ac1;
      g.acertos3 += ac3;
      g.acertos4 += ac4;
      g.somaMrr += mrr;
    }
  }

  const totalRelevantes = perguntasRelevantes.length || 1;
  const gruposFormatados = {};
  for (const grupo of Object.keys(porGrupo)) {
    const g = porGrupo[grupo];
    const tot = g.total || 1;
    gruposFormatados[grupo] = {
      total: g.total,
      recall1: Number((g.acertos1 / tot).toFixed(4)),
      recall3: Number((g.acertos3 / tot).toFixed(4)),
      recall4: Number((g.acertos4 / tot).toFixed(4)),
      recall: Number((g.acertos4 / tot).toFixed(4)),
      mrr: Number((g.somaMrr / tot).toFixed(4)),
    };
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
    recall: Number((somaRecall4 / totalRelevantes).toFixed(4)),
    recall1: Number((somaRecall1 / totalRelevantes).toFixed(4)),
    recall3: Number((somaRecall3 / totalRelevantes).toFixed(4)),
    recall4: Number((somaRecall4 / totalRelevantes).toFixed(4)),
    mrr: Number((somaMrr / totalRelevantes).toFixed(4)),
    porGrupo: gruposFormatados,
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
  const chavesPublicas = new Set();
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
      chavesPublicas.add(doc.chave);
      await indexarFonte(doc.tipo, registro.id, { provider: prov, force: true });
      if (!ehMock) await sleep(ATRASO_PROVIDER_REAL_MS);
    } else {
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
  // e coleta de cossenos detalhados (busca vetorial pura k=50)
  const resLexical = new Map();
  const resVetorial = new Map();
  const resHibrido = new Map();
  const vetoriaisPuros = new Map();
  const ocorrenciasIsolamento = [];

  const cossenosPorPergunta = {};
  const valoresPorGrupo = {};
  for (const g of [...GRUPOS_RELEVANTES, 'negativa', 'isolamento', 'navegacao']) {
    valoresPorGrupo[g] = {
      relevantes: [],
      naoRelevantes: [],
      topPublico: [],
    };
  }

  const todosCosRelevante = [];
  const cosTopPublicoNegativas = [];

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
      k: 50,
    });
    vetoriaisPuros.set(p.id, vet);
    resVetorial.set(
      p.id,
      extrairChavesUnicas(
        vet.map((c) => chavePorId.get(`${c.sourceType}:${c.sourceId}`)),
        k
      )
    );
    if (!ehMock) await sleep(ATRASO_PROVIDER_REAL_MS);

    // Registro de cossenos para calibração (Ponto 1)
    const temRelevantes = (p.relevantes || []).length > 0;
    if (temRelevantes) {
      let cosRelevante = null;
      let cosMelhorNaoRelevante = null;

      for (const item of vet) {
        const chave = chavePorId.get(`${item.sourceType}:${item.sourceId}`);
        if (!chave) continue;

        if (p.relevantes.includes(chave)) {
          if (cosRelevante === null || item.score > cosRelevante) {
            cosRelevante = item.score;
          }
        } else if (chavesPublicas.has(chave)) {
          if (cosMelhorNaoRelevante === null || item.score > cosMelhorNaoRelevante) {
            cosMelhorNaoRelevante = item.score;
          }
        }
      }

      const cosRel = cosRelevante ?? 0;
      const cosNaoRel = cosMelhorNaoRelevante ?? 0;

      cossenosPorPergunta[p.id] = {
        grupo: p.grupo,
        cosRelevante: Number(cosRel.toFixed(4)),
        cosMelhorNaoRelevante: Number(cosNaoRel.toFixed(4)),
      };

      if (valoresPorGrupo[p.grupo]) {
        valoresPorGrupo[p.grupo].relevantes.push(cosRel);
        valoresPorGrupo[p.grupo].naoRelevantes.push(cosNaoRel);
      }
      todosCosRelevante.push(cosRel);
    } else {
      let cosTopPublico = null;
      for (const item of vet) {
        const chave = chavePorId.get(`${item.sourceType}:${item.sourceId}`);
        if (chave && chavesPublicas.has(chave)) {
          if (cosTopPublico === null || item.score > cosTopPublico) {
            cosTopPublico = item.score;
          }
        }
      }
      const topPub = cosTopPublico ?? 0;
      cossenosPorPergunta[p.id] = {
        grupo: p.grupo,
        cosTopPublico: Number(topPub.toFixed(4)),
      };

      if (valoresPorGrupo[p.grupo]) {
        valoresPorGrupo[p.grupo].topPublico.push(topPub);
      }
      if (p.grupo === 'negativa') {
        cosTopPublicoNegativas.push(topPub);
      }
    }

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

  // Ponto 2: Estatísticas de cossenos e margem
  const minCosRelevante = todosCosRelevante.length > 0 ? Math.min(...todosCosRelevante) : 0;
  const maxCosTopPublicoNegativas =
    cosTopPublicoNegativas.length > 0 ? Math.max(...cosTopPublicoNegativas) : 0;
  const margem = Number((minCosRelevante - maxCosTopPublicoNegativas).toFixed(4));
  const separavel = margem > 0;
  const limiarSugeridoMargem = separavel
    ? Number(((minCosRelevante + maxCosTopPublicoNegativas) / 2).toFixed(3))
    : null;

  const estatisticasPorGrupo = {};
  for (const [g, val] of Object.entries(valoresPorGrupo)) {
    if (val.relevantes.length > 0) {
      estatisticasPorGrupo[g] = {
        cosRelevante: calcularEstatisticas(val.relevantes),
        cosMelhorNaoRelevante: calcularEstatisticas(val.naoRelevantes),
      };
    } else if (val.topPublico.length > 0) {
      estatisticasPorGrupo[g] = {
        cosTopPublico: calcularEstatisticas(val.topPublico),
      };
    }
  }

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
      cossenos: cossenosPorPergunta[p.id] || null,
    };
  }

  // 3) Varredura de limiar APENAS vetorial (gate = cosseno >= t, sem resgate lexical) (Ponto 3)
  const varreduraLimiar = [];
  for (const t of LIMIARES) {
    const mapaT = new Map();

    for (const p of perguntas) {
      const vet = vetoriaisPuros.get(p.id) || [];
      const contagemPorDoc = new Map();
      const chavesPassaram = [];

      for (const item of vet) {
        if (chavesPassaram.length >= k) break;
        if (item.score < t) break;

        const chave = chavePorId.get(`${item.sourceType}:${item.sourceId}`);
        if (!chave || !chavesPublicas.has(chave)) continue;

        const qtd = contagemPorDoc.get(chave) || 0;
        if (qtd >= 2) continue;
        contagemPorDoc.set(chave, qtd + 1);

        if (!chavesPassaram.includes(chave)) {
          chavesPassaram.push(chave);
        }
      }
      mapaT.set(p.id, chavesPassaram);
    }

    const metricasT = calcularMetricasModo(mapaT, perguntasRelevantes, chavesNaoPublicas, k);
    varreduraLimiar.push({
      limiar: t,
      recall: metricasT.recall,
      vazioNegativas: taxaVazio(perguntasNegativas, mapaT),
      vazioIsolamento: taxaVazio(perguntasIsolamento, mapaT),
      isolamentoOk: true,
    });
  }

  // Varredura de LEXICAL_MAX_DF (0.10 a 0.60) com minScore null (Ponto 3)
  const varreduraLexicalDf = [];
  for (const df of DFS_VARREDURA) {
    const mapaDf = new Map();
    for (const p of perguntas) {
      const { fontes } = await recuperar(p.pergunta, {
        config: configEval,
        provider: prov,
        k,
        minScore: null,
        lexicalMaxDf: df,
      });
      const chaves = extrairChavesUnicas(
        fontes.map((f) => {
          const st = f.tipo === 'publicacao' ? 'artigo' : 'campanha';
          return chavePorId.get(`${st}:${f.id}`);
        }),
        k
      );
      mapaDf.set(p.id, chaves);
    }

    const metricasDf = calcularMetricasModo(mapaDf, perguntasRelevantes, chavesNaoPublicas, k);
    varreduraLexicalDf.push({
      dfMax: df,
      recall: metricasDf.recall,
      vazioNegativas: taxaVazio(perguntasNegativas, mapaDf),
      vazioIsolamento: taxaVazio(perguntasIsolamento, mapaDf),
      isolamentoOk: metricasDf.vazamentosNaoPublicos === 0,
    });
  }

  // 4) Recomendação: avalia apenas o grupo "negativa" e margem (Ponto 5)
  const candidatosLimiarVet = varreduraLimiar.filter((item) => item.vazioNegativas === 1);
  let limiarRecomendado = limiarSugeridoMargem;
  let recomendacaoTexto = '';

  if (separavel && limiarSugeridoMargem !== null) {
    recomendacaoTexto = `Limiar vetorial recomendado: ${limiarSugeridoMargem.toFixed(3)} (ponto médio entre min relevante ${minCosRelevante.toFixed(3)} e max negativa ${maxCosTopPublicoNegativas.toFixed(3)})`;
  } else if (candidatosLimiarVet.length > 0) {
    const melhor = candidatosLimiarVet.reduce((acc, cur) =>
      cur.recall > acc.recall ? cur : acc
    );
    limiarRecomendado = melhor.limiar;
    recomendacaoTexto = `Limiar vetorial: ${melhor.limiar.toFixed(2)} (vazioNeg=1.00, recall=${melhor.recall.toFixed(4)}), classes sobrepostas: cosseno sozinho não separa`;
  } else {
    recomendacaoTexto = 'classes sobrepostas: cosseno sozinho não separa';
  }

  // Melhor LEXICAL_MAX_DF
  const candidatosDf = varreduraLexicalDf.filter((item) => item.vazioNegativas === 1);
  let melhorDfRecomendado = null;
  if (candidatosDf.length > 0) {
    const melhorDf = candidatosDf.reduce((acc, cur) => (cur.recall > acc.recall ? cur : acc));
    melhorDfRecomendado = melhorDf.dfMax;
    recomendacaoTexto += ` | LEXICAL_MAX_DF recomendado: ${melhorDf.dfMax.toFixed(2)} (recall=${melhorDf.recall.toFixed(4)}, vazioNeg=1.00)`;
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
    cossenos: {
      porGrupo: estatisticasPorGrupo,
      minCosRelevante,
      maxCosTopPublicoNegativas,
      margem,
      separavel,
      limiarSugeridoMargem,
    },
    negativasEisolamento: {
      vazioNegativas: taxaVazio(perguntasNegativas, resHibrido),
      vazioIsolamento: taxaVazio(perguntasIsolamento, resHibrido),
      vazioCombinado: taxaVazio([...perguntasNegativas, ...perguntasIsolamento], resHibrido),
    },
    varreduraLimiar,
    varreduraLexicalDf,
    recomendacao: {
      limiar: limiarRecomendado,
      lexicalMaxDf: melhorDfRecomendado,
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

  // BLOCO 1: Modos e Métricas
  log('\n[Bloco 1] Modos e Métricas (perguntas relevantes)');
  for (const nome of ['lexical', 'vetorial', 'hibrido']) {
    const m = r.modos[nome];
    log(
      `  ${nome.padEnd(8)} | r@1=${m.recall1.toFixed(2)} | r@3=${m.recall3.toFixed(2)} | r@4=${m.recall4.toFixed(2)} | MRR=${m.mrr.toFixed(4)} | não-públicos=${m.vazamentosNaoPublicos}`
    );
    for (const [g, d] of Object.entries(m.porGrupo)) {
      log(`    -> ${g.padEnd(10)}: r@1=${d.recall1.toFixed(2)} | r@3=${d.recall3.toFixed(2)} | r@4=${d.recall4.toFixed(2)} | MRR=${d.mrr.toFixed(4)}`);
    }
  }

  // BLOCO 2: Distribuição de Cossenos e Margem
  log('\n[Bloco 2] Distribuição de Cossenos (min / med / max) e Margem');
  for (const [g, est] of Object.entries(r.cossenos.porGrupo)) {
    if (est.cosRelevante) {
      const cr = est.cosRelevante;
      const cnr = est.cosMelhorNaoRelevante;
      log(`  ${g.padEnd(10)} | cosRelevante: [${cr.min}, ${cr.med}, ${cr.max}] | cosMelhorNãoRel: [${cnr.min}, ${cnr.med}, ${cnr.max}]`);
    } else if (est.cosTopPublico) {
      const ctp = est.cosTopPublico;
      log(`  ${g.padEnd(10)} | cosTopPublico: [${ctp.min}, ${ctp.med}, ${ctp.max}]`);
    }
  }
  log(`  Margem de separação (minRelevante - maxNegativa): ${r.cossenos.margem.toFixed(4)}`);
  log(`  Diagnóstico de separabilidade: ${r.cossenos.separavel ? 'SEPARÁVEL' : 'classes sobrepostas: cosseno sozinho não separa'}`);

  // BLOCO 3: Varreduras de Calibração
  log('\n[Bloco 3] Varreduras de Calibração');
  log('  -- Varredura de Limiar Vetorial Puro (gate = cosseno >= t, sem resgate lexical) --');
  for (const v of r.varreduraLimiar) {
    log(
      `    t=${v.limiar.toFixed(2)} | recall=${v.recall.toFixed(4)} | vazioNeg=${v.vazioNegativas.toFixed(2)} | vazioIso=${v.vazioIsolamento.toFixed(2)}`
    );
  }
  log('  -- Varredura de LEXICAL_MAX_DF (minScore=null) --');
  for (const v of r.varreduraLexicalDf) {
    log(
      `    dfMax=${v.dfMax.toFixed(2)} | recall=${v.recall.toFixed(4)} | vazioNeg=${v.vazioNegativas.toFixed(2)} | vazioIso=${v.vazioIsolamento.toFixed(2)}`
    );
  }

  // BLOCO 4: Segurança, Navegação e Recomendação
  log('\n[Bloco 4] Segurança, Navegação e Recomendação');
  log(`  Isolamento híbrido: ${r.isolamentoOk ? 'OK (0 vazamentos de não-públicos)' : 'FALHOU'}`);
  log(`  Vazio em perguntas negativas: ${(r.negativasEisolamento.vazioNegativas * 100).toFixed(1)}% | isolamento: ${(r.negativasEisolamento.vazioIsolamento * 100).toFixed(1)}%`);
  log(`  Navegação: ${r.navegacao.acertos}/${r.navegacao.total} acertos (FP=[${r.navegacao.falsosPositivos.join(', ')}], FN=[${r.navegacao.falsosNegativos.join(', ')}])`);
  log(`  Recomendação final: ${r.recomendacao.texto}`);
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
