const crypto = require('crypto');
const { AgentChunk } = require('../../src/models');
const { criarMockEmbeddingProvider } = require('../../src/services/agente/providers/embedding/mock');

function criarProvider() {
  return criarMockEmbeddingProvider();
}

async function semearChunk({
  sourceType = 'artigo',
  sourceId = crypto.randomUUID(),
  chunkIndex = 0,
  texto,
  provider,
} = {}) {
  const prov = provider || criarProvider();
  const [embedding] = await prov.embedDocuments([texto]);

  return await AgentChunk.create({
    sourceType,
    sourceId,
    chunkIndex,
    texto,
    contentHash: 'a'.repeat(64),
    embedding,
    embeddingModel: prov.info.model,
    dim: prov.info.dim,
  });
}

module.exports = {
  criarProvider,
  semearChunk,
};

