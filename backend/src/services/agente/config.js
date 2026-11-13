/**
 * Centralização da configuração do assistente e do RAG.
 * Lê process.env a cada chamada para permitir testes dinâmicos.
 */

function parseNumber(value, padrao = null) {
  if (value === undefined || value === null || value === '') return padrao;
  const n = Number(value);
  return Number.isNaN(n) ? padrao : n;
}

function getConfig() {
  const enabled = process.env.AGENTE_IA_ENABLED === 'true';
  const provider = process.env.AGENTE_IA_PROVIDER;
  const apiKey = process.env.AGENTE_IA_API_KEY;
  const model = process.env.AGENTE_IA_MODEL;
  const timeoutMs = parseNumber(process.env.AGENTE_IA_TIMEOUT_MS, 8000);
  const rateLimit = parseNumber(process.env.AGENTE_IA_RATE_LIMIT, 10);

  const ragEnabled = process.env.AGENTE_RAG_ENABLED === 'true';
  const embeddingProvider = process.env.AGENTE_RAG_EMBEDDING_PROVIDER || 'gemini';
  const embeddingModel = process.env.AGENTE_RAG_EMBEDDING_MODEL || 'gemini-embedding-001';
  const embeddingDim = parseNumber(process.env.AGENTE_RAG_EMBEDDING_DIM, 768);

  let embeddingApiKey = process.env.AGENTE_RAG_EMBEDDING_API_KEY;
  if (!embeddingApiKey && process.env.AGENTE_IA_PROVIDER === 'gemini') {
    embeddingApiKey = process.env.AGENTE_IA_API_KEY;
  }

  const topK = parseNumber(process.env.AGENTE_RAG_TOP_K, 4);
  const minScore = parseNumber(process.env.AGENTE_RAG_MIN_SCORE, null);

  return {
    enabled,
    provider,
    apiKey,
    model,
    timeoutMs,
    rateLimit,
    rag: {
      enabled: ragEnabled,
      embeddingProvider,
      embeddingModel,
      embeddingDim,
      embeddingApiKey,
      topK,
      minScore,
    },
  };
}

module.exports = { getConfig, parseNumber };
