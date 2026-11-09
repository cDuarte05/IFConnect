const { fetchComTimeout } = require('../http');
const { ProvedorIndisponivelError } = require('../errors');
const { normalizarL2 } = require('./mock');

const LIMITE_LOTE = 50;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizarVetor(vetor, dimEsperada) {
  if (!Array.isArray(vetor) || vetor.length !== dimEsperada) {
    throw new ProvedorIndisponivelError(
      `Dimensão do vetor recebido (${vetor ? vetor.length : 0}) difere da esperada (${dimEsperada})`,
      { provedor: 'gemini' }
    );
  }
  return normalizarL2(vetor);
}

function criarGeminiEmbeddingProvider(config = {}) {
  const providerName = 'gemini';
  const model = config.rag?.embeddingModel || 'gemini-embedding-001';
  const dim = config.rag?.embeddingDim || 768;
  const apiKey = config.rag?.embeddingApiKey;
  const timeoutMs = config.timeoutMs || 8000;

  async function executarComRetry(url, options) {
    let resposta;
    for (let tentativa = 0; tentativa <= 1; tentativa++) {
      try {
        resposta = await fetchComTimeout(url, options, timeoutMs);
        if (resposta.ok) {
          return await resposta.json();
        }
        // Se 429 ou 5xx e ainda for primeira tentativa, espera e tenta de novo
        if (tentativa === 0 && (resposta.status === 429 || resposta.status >= 500)) {
          await sleep(200);
          continue;
        }
        throw new ProvedorIndisponivelError(`Provedor respondeu ${resposta.status}`, {
          provedor: providerName,
          status: resposta.status,
        });
      } catch (err) {
        if (err instanceof ProvedorIndisponivelError) {
          throw err;
        }
        if (tentativa === 0) {
          await sleep(200);
          continue;
        }
        throw new ProvedorIndisponivelError(err.message, { provedor: providerName });
      }
    }
  }

  return {
    info: {
      provider: providerName,
      model,
      dim,
    },

    async embedDocuments(textos = []) {
      if (!textos.length) return [];
      const resultados = [];

      for (let i = 0; i < textos.length; i += LIMITE_LOTE) {
        const pedaco = textos.slice(i, i + LIMITE_LOTE);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`;

        const body = {
          requests: pedaco.map((texto) => ({
            model: `models/${model}`,
            content: { parts: [{ text: texto }] },
            taskType: 'RETRIEVAL_DOCUMENT',
            outputDimensionality: dim,
          })),
        };

        const dados = await executarComRetry(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(body),
        });

        const embeddings = dados.embeddings || [];
        for (const item of embeddings) {
          resultados.push(normalizarVetor(item.values, dim));
        }
      }

      return resultados;
    },

    async embedQuery(texto = '') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`;

      const body = {
        model: `models/${model}`,
        content: { parts: [{ text: texto }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: dim,
      };

      const dados = await executarComRetry(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });

      const values = dados.embedding?.values;
      return normalizarVetor(values, dim);
    },
  };
}

module.exports = { criarGeminiEmbeddingProvider, normalizarVetor, LIMITE_LOTE };

