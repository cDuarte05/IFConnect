const { criarGeminiEmbeddingProvider } = require('./gemini');
const { criarMockEmbeddingProvider } = require('./mock');

function getEmbeddingProvider(config = {}) {
  const providerName = config.rag?.embeddingProvider || 'gemini';

  if (providerName === 'mock') {
    return criarMockEmbeddingProvider(config);
  }

  if (providerName === 'gemini') {
    if (!config.rag?.embeddingApiKey) {
      return null;
    }
    return criarGeminiEmbeddingProvider(config);
  }

  return null;
}

module.exports = { getEmbeddingProvider };

