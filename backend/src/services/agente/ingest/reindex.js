const { Op } = require('sequelize');
const { sequelize, Article, Campaign, AgentChunk } = require('../../../models');
const { getConfig } = require('../config');
const {
  obterProvider,
  EmbeddingNaoConfiguradoError,
} = require('./embedder');
const {
  STATUS_PUBLICO_ARTIGO,
  STATUS_PUBLICO_CAMPANHA,
  indexarFonte,
  removerFonte,
} = require('./indexer');

function padraoSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Interpreta argumentos de linha de comando para o script de reindexação.
 */
function parseArgs(argv = []) {
  let dryRun = false;
  let force = false;
  let delayMs = 300;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('--delay-ms=')) {
      const bruto = arg.slice('--delay-ms='.length);
      const valor = Number(bruto);
      if (bruto !== '' && Number.isFinite(valor) && valor >= 0) {
        delayMs = valor;
      } else {
        delayMs = 300;
      }
    }
  }

  return { dryRun, force, delayMs };
}

/**
 * Reindexa de forma idempotente todas as fontes públicas (artigos publicados
 * e campanhas ativas/financiadas) e remove chunks órfãos ao final.
 */
async function reindexarTudo({
  config = getConfig(),
  provider,
  force = false,
  dryRun = false,
  delayMs = 0,
  log = () => {},
  sleep = padraoSleep,
} = {}) {
  const inicio = Date.now();
  const prov = provider || obterProvider(config);

  const [artigos, campanhas] = await Promise.all([
    Article.findAll({
      where: { status: { [Op.in]: STATUS_PUBLICO_ARTIGO } },
      attributes: ['id'],
      order: [['createdAt', 'ASC']],
    }),
    Campaign.findAll({
      where: { status: { [Op.in]: STATUS_PUBLICO_CAMPANHA } },
      attributes: ['id'],
      order: [['createdAt', 'ASC']],
    }),
  ]);

  const fontes = [
    ...artigos.map((a) => ({ sourceType: 'artigo', sourceId: a.id })),
    ...campanhas.map((c) => ({ sourceType: 'campanha', sourceId: c.id })),
  ];

  const chavesPublicas = new Set(
    fontes.map((f) => `${f.sourceType}:${f.sourceId}`)
  );

  let indexados = 0;
  let inalterados = 0;
  let removidos = 0;
  let orfaosRemovidos = 0;
  let ignorados = 0;
  const falhas = [];

  for (let i = 0; i < fontes.length; i++) {
    if (i > 0 && delayMs > 0) {
      await sleep(delayMs);
    }

    const { sourceType, sourceId } = fontes[i];
    const prefixo = `[${i + 1}/${fontes.length}] ${sourceType} ${sourceId}`;

    try {
      const res = await indexarFonte(sourceType, sourceId, {
        config,
        provider: prov,
        force,
        dryRun,
      });

      if (res.acao === 'indexado') indexados += 1;
      else if (res.acao === 'inalterado') inalterados += 1;
      else if (res.acao === 'removido') removidos += 1;
      else if (res.acao === 'ignorado') ignorados += 1;

      log(`${prefixo}: ${res.acao} (${res.chunks} chunks)`);
    } catch (err) {
      falhas.push({
        sourceType,
        sourceId,
        mensagem: err.message,
      });
      log(`${prefixo}: falha (${err.message})`);
    }
  }

  // Remove chunks órfãos (fontes apagadas ou que deixaram de ser públicas)
  const gruposChunks = await AgentChunk.findAll({
    attributes: ['sourceType', 'sourceId'],
    group: ['sourceType', 'sourceId'],
    raw: true,
  });

  for (const grupo of gruposChunks) {
    const chave = `${grupo.sourceType}:${grupo.sourceId}`;
    if (!chavesPublicas.has(chave)) {
      const qtd = dryRun
        ? await AgentChunk.count({
            where: { sourceType: grupo.sourceType, sourceId: grupo.sourceId },
          })
        : await removerFonte(grupo.sourceType, grupo.sourceId);

      orfaosRemovidos += qtd;
    }
  }

  return {
    indexados,
    inalterados,
    removidos,
    orfaosRemovidos,
    ignorados,
    falhas,
    duracaoMs: Date.now() - inicio,
    modelo: prov.info.model,
    dim: prov.info.dim,
    dryRun,
  };
}

/**
 * Retorna código de saída do CLI com base nas falhas registradas.
 */
function codigoDeSaida(resumo) {
  return resumo && Array.isArray(resumo.falhas) && resumo.falhas.length === 0 ? 0 : 2;
}

async function executarCli() {
  require('dotenv').config();
  const opcoes = parseArgs(process.argv.slice(2));
  const config = getConfig();

  if (process.env.AGENTE_RAG_ENABLED !== 'true') {
    console.warn(
      '[agente:reindex] Aviso: AGENTE_RAG_ENABLED não está ativo ("true"). O índice será gerado, mas o RAG permanece desligado nas consultas.'
    );
  }

  await sequelize.sync();

  try {
    const resumo = await reindexarTudo({
      config,
      force: opcoes.force,
      dryRun: opcoes.dryRun,
      delayMs: opcoes.delayMs,
      log: console.log,
    });

    console.log(
      `[agente:reindex] Concluído (${resumo.dryRun ? 'dry-run' : 'aplicado'}) | ` +
        `modelo=${resumo.modelo} dim=${resumo.dim} | ` +
        `indexados=${resumo.indexados} inalterados=${resumo.inalterados} ` +
        `removidos=${resumo.removidos} orfaosRemovidos=${resumo.orfaosRemovidos} ` +
        `ignorados=${resumo.ignorados} falhas=${resumo.falhas.length} duracaoMs=${resumo.duracaoMs}`
    );

    process.exitCode = codigoDeSaida(resumo);
  } catch (err) {
    if (err instanceof EmbeddingNaoConfiguradoError) {
      console.error(
        '[agente:reindex] Erro: provedor de embedding não configurado. Defina AGENTE_RAG_EMBEDDING_API_KEY no ambiente para executar a reindexação.'
      );
      process.exitCode = 1;
      return;
    }
    throw err;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  executarCli().catch((err) => {
    console.error('[agente:reindex] Erro inesperado:', err.message);
    process.exitCode = 2;
  });
}

module.exports = {
  reindexarTudo,
  codigoDeSaida,
  parseArgs,
};

