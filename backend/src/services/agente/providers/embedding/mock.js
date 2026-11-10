/**
 * Mock determinístico de embedding para testes.
 * Dimensão 64: hash das palavras normalizadas em buckets com contagem e normalização L2.
 */

const { normalizarL2 } = require('./vetor');

const normalizar = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function criarVetor(texto, dim = 64) {
  const vetor = new Array(dim).fill(0);
  const palavras = normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 0);

  for (const p of palavras) {
    const bucket = hashString(p) % dim;
    vetor[bucket] += 1;
  }

  return normalizarL2(vetor);
}

function criarMockEmbeddingProvider(config = {}) {
  const dim = 64;
  const model = config.rag?.embeddingModel || 'mock-embedding';

  return {
    info: {
      provider: 'mock',
      model,
      dim,
    },
    async embedDocuments(textos) {
      return (textos || []).map((t) => criarVetor(t, dim));
    },
    async embedQuery(texto) {
      return criarVetor(texto || '', dim);
    },
  };
}

module.exports = { criarMockEmbeddingProvider, normalizarL2 };

