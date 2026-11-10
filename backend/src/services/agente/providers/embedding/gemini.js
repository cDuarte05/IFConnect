const { fetchJsonComTimeout } = require('../http');
const { ProvedorIndisponivelError } = require('../errors');
const { normalizarL2 } = require('./vetor');

const LIMITE_LOTE = 50;
const TIMEOUT_EMBED_QUERY_MS = 3000;
const MAX_RETRY_AFTER_MS = 10000;

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

function calcularDelayRetry(headers, tentativaIndex) {
  const backoffs = [200, 800];
  const padrao = backoffs[tentativaIndex] ?? 800;

  const retryAfter = headers?.get
    ? (headers.get('retry-after') || headers.get('Retry-After'))
    : (headers?.['retry-after'] || headers?.['Retry-After']);

  if (retryAfter !== undefined && retryAfter !== null && retryAfter !== '') {
    const segundos = Number(retryAfter);
    if (!Number.isNaN(segundos)) {
      return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, Math.round(segundos * 1000)));
    }
    const dataMs = Date.parse(retryAfter);
    if (!Number.isNaN(dataMs)) {
      return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, dataMs - Date.now()));
    }
  }

  return padrao;
}

async function executarLoteComRetry(url, options, timeoutMs, providerName) {
  const MAX_TENTATIVAS = 3;
  let ultimaResposta = null;
  let ultimoErro = null;

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    try {
      const resposta = await fetchJsonComTimeout(url, options, timeoutMs);
      if (resposta.ok) {
        return resposta.data;
      }

      ultimaResposta = resposta;

      if (
        tentativa < MAX_TENTATIVAS - 1 &&
        (resposta.status === 429 || resposta.status >= 500)
      ) {
        const delay = calcularDelayRetry(resposta.headers, tentativa);
        await sleep(delay);
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
      ultimoErro = err;
      if (tentativa < MAX_TENTATIVAS - 1) {
        const delay = calcularDelayRetry(null, tentativa);
        await sleep(delay);
        continue;
      }
      throw new ProvedorIndisponivelError(err.message, { provedor: providerName });
    }
  }

  if (ultimaResposta) {
    throw new ProvedorIndisponivelError(`Provedor respondeu ${ultimaResposta.status}`, {
      provedor: providerName,
      status: ultimaResposta.status,
    });
  }
  throw new ProvedorIndisponivelError(ultimoErro?.message || 'Falha no provedor', {
    provedor: providerName,
  });
}

function criarGeminiEmbeddingProvider(config = {}) {
  const providerName = 'gemini';
  const model = config.rag?.embeddingModel || 'gemini-embedding-001';
  const dim = config.rag?.embeddingDim || 768;
  const apiKey = config.rag?.embeddingApiKey;
  const timeoutMs = config.timeoutMs || 8000;

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

        const dados = await executarLoteComRetry(
          url,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(body),
          },
          timeoutMs,
          providerName
        );

        const embeddings = dados?.embeddings;
        if (!Array.isArray(embeddings) || embeddings.length !== pedaco.length) {
          throw new ProvedorIndisponivelError(
            `Quantidade de embeddings retornada (${embeddings ? embeddings.length : 0}) difere da solicitada (${pedaco.length})`,
            { provedor: providerName }
          );
        }

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

      let resposta;
      try {
        resposta = await fetchJsonComTimeout(
          url,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(body),
          },
          TIMEOUT_EMBED_QUERY_MS
        );
      } catch (err) {
        if (err instanceof ProvedorIndisponivelError) throw err;
        throw new ProvedorIndisponivelError(err.message, { provedor: providerName });
      }

      if (!resposta.ok) {
        throw new ProvedorIndisponivelError(`Provedor respondeu ${resposta.status}`, {
          provedor: providerName,
          status: resposta.status,
        });
      }

      const values = resposta.data?.embedding?.values;
      return normalizarVetor(values, dim);
    },
  };
}

module.exports = {
  criarGeminiEmbeddingProvider,
  normalizarVetor,
  calcularDelayRetry,
  MAX_RETRY_AFTER_MS,
  LIMITE_LOTE,
  TIMEOUT_EMBED_QUERY_MS,
};
