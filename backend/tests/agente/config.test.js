const { getConfig } = require('../../src/services/agente/config');

describe('Configuração do Agente e RAG (config.js)', () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    process.env = { ...envOriginal };
    delete process.env.AGENTE_IA_ENABLED;
    delete process.env.AGENTE_IA_PROVIDER;
    delete process.env.AGENTE_IA_API_KEY;
    delete process.env.AGENTE_IA_MODEL;
    delete process.env.AGENTE_IA_TIMEOUT_MS;
    delete process.env.AGENTE_IA_RATE_LIMIT;
    delete process.env.AGENTE_RAG_ENABLED;
    delete process.env.AGENTE_RAG_EMBEDDING_PROVIDER;
    delete process.env.AGENTE_RAG_EMBEDDING_MODEL;
    delete process.env.AGENTE_RAG_EMBEDDING_DIM;
    delete process.env.AGENTE_RAG_EMBEDDING_API_KEY;
    delete process.env.AGENTE_RAG_TOP_K;
    delete process.env.AGENTE_RAG_MIN_SCORE;
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  test('retorna valores padrão quando nenhuma variável está definida', () => {
    const config = getConfig();

    expect(config.enabled).toBe(false);
    expect(config.provider).toBeUndefined();
    expect(config.apiKey).toBeUndefined();
    expect(config.model).toBeUndefined();
    expect(config.timeoutMs).toBe(8000);
    expect(config.rateLimit).toBe(10);

    expect(config.rag.enabled).toBe(false);
    expect(config.rag.embeddingProvider).toBe('gemini');
    expect(config.rag.embeddingModel).toBe('gemini-embedding-001');
    expect(config.rag.embeddingDim).toBe(768);
    expect(config.rag.embeddingApiKey).toBeUndefined();
    expect(config.rag.topK).toBe(4);
    expect(config.rag.minScore).toBeNull();
  });

  test('recupera fallback para valores numéricos inválidos / NaN', () => {
    process.env.AGENTE_IA_TIMEOUT_MS = 'invalido';
    process.env.AGENTE_IA_RATE_LIMIT = 'abc';
    process.env.AGENTE_RAG_EMBEDDING_DIM = 'dim_invalida';
    process.env.AGENTE_RAG_TOP_K = 'nao_e_numero';
    process.env.AGENTE_RAG_MIN_SCORE = 'nao_e_numero';

    const config = getConfig();

    expect(config.timeoutMs).toBe(8000);
    expect(config.rateLimit).toBe(10);
    expect(config.rag.embeddingDim).toBe(768);
    expect(config.rag.topK).toBe(4);
    expect(config.rag.minScore).toBeNull();
  });

  test('lê minScore numérico válido quando configurado', () => {
    process.env.AGENTE_RAG_MIN_SCORE = '0.75';
    const config = getConfig();
    expect(config.rag.minScore).toBe(0.75);
  });

  test('usa AGENTE_RAG_EMBEDDING_API_KEY prioritariamente quando definida', () => {
    process.env.AGENTE_IA_PROVIDER = 'gemini';
    process.env.AGENTE_IA_API_KEY = 'chave-llm-gemini';
    process.env.AGENTE_RAG_EMBEDDING_API_KEY = 'chave-embedding-dedicada';

    const config = getConfig();
    expect(config.rag.embeddingApiKey).toBe('chave-embedding-dedicada');
  });

  test('fallback de chave de embedding usa AGENTE_IA_API_KEY se vazia E provedor for gemini', () => {
    process.env.AGENTE_IA_PROVIDER = 'gemini';
    process.env.AGENTE_IA_API_KEY = 'chave-gemini-compartilhada';

    const config = getConfig();
    expect(config.rag.embeddingApiKey).toBe('chave-gemini-compartilhada');
  });

  test('NÃO faz fallback para AGENTE_IA_API_KEY se provedor for diferente de gemini', () => {
    process.env.AGENTE_IA_PROVIDER = 'anthropic';
    process.env.AGENTE_IA_API_KEY = 'chave-anthropic';

    const config = getConfig();
    expect(config.rag.embeddingApiKey).toBeUndefined();
  });
});

