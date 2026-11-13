const {
  criarGeminiEmbeddingProvider,
  LIMITE_LOTE,
  TIMEOUT_EMBED_QUERY_MS,
  MAX_RETRY_AFTER_MS,
  calcularDelayRetry,
} = require('../../src/services/agente/providers/embedding/gemini');
const { getEmbeddingProvider } = require('../../src/services/agente/providers/embedding');
const { ProvedorIndisponivelError } = require('../../src/services/agente/providers/errors');

const fetchOriginal = global.fetch;

function norma(v) {
  return Math.sqrt(v.reduce((soma, val) => soma + val * val, 0));
}

describe('Provedor Gemini de Embedding (providers/embedding/gemini.js)', () => {
  const configBase = {
    timeoutMs: 1000,
    rag: {
      embeddingProvider: 'gemini',
      embeddingModel: 'gemini-embedding-001',
      embeddingDim: 4, // Usando 4 para facilidade nos testes
      embeddingApiKey: 'chave-secreta-gemini',
    },
  };

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  test('exporta TIMEOUT_EMBED_QUERY_MS igual a 3000 ms', () => {
    expect(TIMEOUT_EMBED_QUERY_MS).toBe(3000);
  });

  test('getEmbeddingProvider retorna null quando gemini não tem chave configurada', () => {
    const semChave = {
      rag: {
        embeddingProvider: 'gemini',
        embeddingApiKey: '',
      },
    };
    expect(getEmbeddingProvider(semChave)).toBeNull();
  });

  test('embedQuery envia RETRIEVAL_QUERY, chave no header x-goog-api-key (NUNCA na URL) e normaliza vetor', async () => {
    const provider = criarGeminiEmbeddingProvider(configBase);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embedding: {
          values: [2, 0, 0, 0], // Norma inicial = 2
        },
      }),
    });

    const vetor = await provider.embedQuery('Pergunta de teste');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];

    // Chave NÃO pode estar na URL
    expect(url).not.toContain('chave-secreta-gemini');
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent'
    );
    expect(options.headers['x-goog-api-key']).toBe('chave-secreta-gemini');

    const body = JSON.parse(options.body);
    expect(body.taskType).toBe('RETRIEVAL_QUERY');
    expect(body.outputDimensionality).toBe(4);
    expect(body.content.parts[0].text).toBe('Pergunta de teste');

    // Vetor retornado normalizado L2
    expect(vetor).toHaveLength(4);
    expect(norma(vetor)).toBeCloseTo(1, 5);
    expect(vetor).toEqual([1, 0, 0, 0]);
  });

  test('embedQuery não faz retry em falha 429 ou 5xx e lança erro na primeira tentativa', async () => {
    const provider = criarGeminiEmbeddingProvider(configBase);

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
    });

    await expect(provider.embedQuery('Pergunta sem retry')).rejects.toThrow(
      ProvedorIndisponivelError
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('embedDocuments envia RETRIEVAL_DOCUMENT e divide em lotes respeitando o limite', async () => {
    const provider = criarGeminiEmbeddingProvider(configBase);

    // Gerar mais que LIMITE_LOTE textos (ex: 55 textos)
    const totalTextos = LIMITE_LOTE + 5;
    const textos = Array.from({ length: totalTextos }, (_, i) => `Texto ${i}`);

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: Array.from({ length: LIMITE_LOTE }, () => ({ values: [0, 3, 0, 0] })),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: Array.from({ length: 5 }, () => ({ values: [0, 5, 0, 0] })),
        }),
      });

    const resultado = await provider.embedDocuments(textos);

    expect(global.fetch).toHaveBeenCalledTimes(2);

    const [url1, opt1] = global.fetch.mock.calls[0];
    expect(url1).toContain(':batchEmbedContents');
    const body1 = JSON.parse(opt1.body);
    expect(body1.requests).toHaveLength(LIMITE_LOTE);
    expect(body1.requests[0].taskType).toBe('RETRIEVAL_DOCUMENT');
    expect(body1.requests[0].outputDimensionality).toBe(4);

    const [, opt2] = global.fetch.mock.calls[1];
    const body2 = JSON.parse(opt2.body);
    expect(body2.requests).toHaveLength(5);

    expect(resultado).toHaveLength(totalTextos);
    for (const v of resultado) {
      expect(v).toHaveLength(4);
      expect(norma(v)).toBeCloseTo(1, 5);
    }
  });

  test('embedDocuments faz retry em resposta 429 ou 5xx e recupera se a segunda for sucesso', async () => {
    const provider = criarGeminiEmbeddingProvider(configBase);

    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: [{ values: [1, 1, 1, 1] }],
        }),
      });

    const resultado = await provider.embedDocuments(['Doc com retry']);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(resultado).toHaveLength(1);
    expect(norma(resultado[0])).toBeCloseTo(1, 5);
  });

  test('embedDocuments respeita o cabeçalho Retry-After quando presente', async () => {
    const provider = criarGeminiEmbeddingProvider(configBase);

    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { 'retry-after': '0.05' },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: [{ values: [0, 2, 0, 0] }],
        }),
      });

    const inicio = Date.now();
    const resultado = await provider.embedDocuments(['Doc com retry-after']);
    const decorrido = Date.now() - inicio;

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(decorrido).toBeGreaterThanOrEqual(40);
    expect(resultado).toHaveLength(1);
  });

  test('embedDocuments limita a espera do cabeçalho Retry-After ao teto de 10s', async () => {
    jest.useFakeTimers();
    try {
      const provider = criarGeminiEmbeddingProvider(configBase);

      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { 'retry-after': '3600' },
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            embeddings: [{ values: [0, 2, 0, 0] }],
          }),
        });

      const promise = provider.embedDocuments(['Doc com retry-after excessivo']);

      // Avança os timers pelo teto de 10s (e não 3600s)
      await jest.advanceTimersByTimeAsync(10000);

      const resultado = await promise;
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(resultado).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('calcularDelayRetry limita tempo ao teto MAX_RETRY_AFTER_MS (10s) para segundos e datas distantes', () => {
    expect(MAX_RETRY_AFTER_MS).toBe(10000);
    expect(calcularDelayRetry({ 'retry-after': '3600' }, 0)).toBe(10000);
    expect(calcularDelayRetry({ 'retry-after': '99999' }, 0)).toBe(10000);

    const dataFuturaDistante = new Date(Date.now() + 3600 * 1000).toUTCString();
    expect(calcularDelayRetry({ 'retry-after': dataFuturaDistante }, 0)).toBe(10000);
  });

  test('embedDocuments faz até 3 tentativas (backoff crescente) e lança erro se todas falharem', async () => {
    const provider = criarGeminiEmbeddingProvider(configBase);

    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(provider.embedDocuments(['Doc falha total'])).rejects.toThrow(
      ProvedorIndisponivelError
    );
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('embedDocuments valida embeddings.length === pedaco.length e lança ProvedorIndisponivelError se diferir', async () => {
    const provider = criarGeminiEmbeddingProvider(configBase);

    // Enviando 2 textos, mas API retorna só 1 embedding
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embeddings: [{ values: [1, 0, 0, 0] }],
      }),
    });

    await expect(
      provider.embedDocuments(['Texto 1', 'Texto 2'])
    ).rejects.toThrow(ProvedorIndisponivelError);
  });

  test('lança erro tipado quando a dimensão do vetor recebido for diferente da esperada', async () => {
    const provider = criarGeminiEmbeddingProvider(configBase); // dimensão configurada = 4

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embedding: {
          values: [1, 2], // Retornou 2 elementos ao invés de 4
        },
      }),
    });

    await expect(provider.embedQuery('Pergunta dim errada')).rejects.toThrow(
      ProvedorIndisponivelError
    );
  });
});
