const { getConfig } = require('../config');
const { getEmbeddingProvider } = require('../providers/embedding');
const { reindexarTudo } = require('./reindex');

let emExecucao = false;

async function reconciliarAgora({
  config = getConfig(),
  reindexar = reindexarTudo,
  log,
} = {}) {
  if (!config || !config.enabled || !config.rag || !config.rag.enabled) {
    return null;
  }

  const provider = getEmbeddingProvider(config);
  if (!provider) {
    return null;
  }

  if (emExecucao) {
    return null;
  }

  emExecucao = true;
  try {
    const resumo = await reindexar({ config, force: false, delayMs: 300 });
    const houveMudanca =
      resumo &&
      (resumo.indexados > 0 ||
        resumo.removidos > 0 ||
        (resumo.orfaosRemovidos || 0) > 0 ||
        (resumo.falhas && resumo.falhas.length > 0));

    if (houveMudanca) {
      const logger =
        log || (process.env.NODE_ENV === 'test' ? () => {} : console.log);
      logger(
        `[agente:reconciliar] indexados=${resumo.indexados} inalterados=${resumo.inalterados} ` +
          `removidos=${resumo.removidos} orfaosRemovidos=${resumo.orfaosRemovidos || 0} ` +
          `falhas=${resumo.falhas ? resumo.falhas.length : 0}`
      );
    }

    return resumo;
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[agente] reconciliação falhou:', err.message);
    }
    return null;
  } finally {
    emExecucao = false;
  }
}

function iniciarReconciliacao({
  config = getConfig(),
  intervaloMin = config?.rag?.reconciliarIntervaloMin,
} = {}) {
  if (process.env.NODE_ENV === 'test') {
    return { parar: () => {} };
  }

  module.exports.reconciliarAgora({ config }).catch(() => {});

  let timer = null;
  if (intervaloMin > 0) {
    timer = setInterval(() => {
      module.exports.reconciliarAgora({ config }).catch(() => {});
    }, intervaloMin * 60_000);

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  return {
    parar() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

module.exports = {
  reconciliarAgora,
  iniciarReconciliacao,
};
