const { criarGeminiEmbeddingProvider, LIMITE_LOTE } = require('../../src/services/agente/providers/embedding/gemini');
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

  test('faz retry em resposta 429 ou 5xx e recupera se a segunda for sucesso', async () => {
    const provider = criarGeminiEmbeddingProvider(configBase);

    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embedding: { values: [1, 1, 1, 1] },
        }),
      });

    const vetor = await provider.embedQuery('Pergunta com retry');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(vetor).toHaveLength(4);
    expect(norma(vetor)).toBeCloseTo(1, 5);
  });

  test('lança ProvedorIndisponivelError tipado se o retry também falhar', async () => {
    const provider = criarGeminiEmbeddingProvider(configBase);

    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

    await expect(provider.embedQuery('Pergunta falha')).rejects.toThrow(
      ProvedorIndisponivelError
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
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

