const { getConfig } = require('../config');
const { reindexarTudo } = require('./reindex');
const { getEmbeddingProvider } = require('../providers/embedding');

let emExecucao = false;

/**
 * Executa uma rodada única de reconciliação de forma segura e não bloqueante.
 * Retorna null se desabilitado, sem chave configurada, ou se já houver uma rodada em andamento.
 */
async function reconciliarAgora({
  config = getConfig(),
  reindexar = reindexarTudo,
  log,
} = {}) {
  if (!config.enabled || !config.rag?.enabled) {
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

    const totalMudancas =
      (resumo.indexados || 0) +
      (resumo.removidos || 0) +
      (resumo.orfaosRemovidos || 0);
    const totalFalhas = (resumo.falhas || []).length;

    if (totalMudancas > 0 || totalFalhas > 0) {
      const msg = `[agente:reconciliador] Sincronização concluída: indexados=${resumo.indexados || 0}, inalterados=${resumo.inalterados || 0}, removidos=${(resumo.removidos || 0) + (resumo.orfaosRemovidos || 0)}, falhas=${totalFalhas}`;
      if (typeof log === 'function') {
        log(msg);
      } else if (process.env.NODE_ENV !== 'test') {
        console.log(msg);
      }
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

/**
 * Agenda a reconciliação em segundo plano.
 * Não faz nada quando executado sob NODE_ENV === 'test'.
 */
function iniciarReconciliacao({
  config = getConfig(),
  intervaloMin = config.rag?.reconciliarIntervaloMin,
  reconciliar = reconciliarAgora,
} = {}) {
  if (process.env.NODE_ENV === 'test') {
    return { parar: () => {} };
  }

  // Dispara no início sem await (não atrasa o servidor)
  reconciliar({ config }).catch(() => {});

  let timer = null;
  if (typeof intervaloMin === 'number' && intervaloMin > 0) {
    timer = setInterval(() => {
      reconciliar({ config }).catch(() => {});
    }, intervaloMin * 60_000);

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  return {
    parar: () => {
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
