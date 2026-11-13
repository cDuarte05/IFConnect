const {
  EmbeddingNaoConfiguradoError,
  obterProvider,
  descreverProvider,
  embedDocumentos,
  embedPergunta,
  criarCacheLru,
  limparCache,
} = require('../../src/services/agente/ingest/embedder');
const { criarMockEmbeddingProvider } = require('../../src/services/agente/providers/embedding/mock');
const { ProvedorIndisponivelError } = require('../../src/services/agente/providers/errors');

describe('Embedder (services/agente/ingest/embedder.js)', () => {
  beforeEach(() => {
    limparCache();
  });

  describe('obterProvider', () => {
    test('lança EmbeddingNaoConfiguradoError sem chave quando provider é gemini', () => {
      const configSemChave = {
        rag: {
          embeddingProvider: 'gemini',
          embeddingModel: 'gemini-embedding-001',
          embeddingDim: 768,
          embeddingApiKey: '',
        },
      };

      let erroCapturado;
      try {
        obterProvider(configSemChave);
      } catch (err) {
        erroCapturado = err;
      }

      expect(erroCapturado).toBeInstanceOf(EmbeddingNaoConfiguradoError);
      expect(erroCapturado.name).toBe('EmbeddingNaoConfiguradoError');
      expect(erroCapturado.message).toContain('AGENTE_RAG_EMBEDDING_API_KEY');
    });

    test('funciona com provider "mock" mesmo sem chave', () => {
      const provider = obterProvider({
        rag: {
          embeddingProvider: 'mock',
          embeddingModel: 'mock-embedding',
          embeddingDim: 768,
        },
      });

      expect(provider.info.provider).toBe('mock');
      expect(provider.info.dim).toBe(64);
    });
  });

  describe('descreverProvider', () => {
    test('usa info do provider (mock retorna dim 64 mesmo com config.rag.embeddingDim 768)', () => {
      const provider = obterProvider({
        rag: {
          embeddingProvider: 'mock',
          embeddingModel: 'modelo-teste',
          embeddingDim: 768,
        },
      });

      expect(descreverProvider(provider)).toEqual({
        model: 'modelo-teste',
        dim: 64,
      });
    });
  });

  describe('embedDocumentos', () => {
    test('mantém ordem, deduplica textos idênticos chamando o provider só uma vez e devolve alinhado', async () => {
      const base = criarMockEmbeddingProvider();
      const spy = jest.spyOn(base, 'embedDocuments');

      const entrada = [
        'Robótica educacional no IF',
        'Energia solar fotovoltaica',
        'Robótica educacional no IF',
        'Hortas comunitárias',
        'Energia solar fotovoltaica',
      ];

      const resultado = await embedDocumentos(entrada, { provider: base });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith([
        'Robótica educacional no IF',
        'Energia solar fotovoltaica',
        'Hortas comunitárias',
      ]);

      expect(resultado).toHaveLength(entrada.length);
      expect(resultado[0]).toEqual(resultado[2]);
      expect(resultado[1]).toEqual(resultado[4]);
      expect(resultado[0]).not.toEqual(resultado[1]);
      expect(resultado[3]).not.toEqual(resultado[0]);
      resultado.forEach((v) => expect(v).toHaveLength(64));
    });

    test('array vazio retorna [] sem chamar o provider', async () => {
      const providerFake = {
        info: { provider: 'mock', model: 'm', dim: 64 },
        embedDocuments: jest.fn(),
      };

      const resultado = await embedDocumentos([], { provider: providerFake });

      expect(resultado).toEqual([]);
      expect(providerFake.embedDocuments).not.toHaveBeenCalled();
    });

    test('lança TypeError para entrada não-array, item não-string ou item vazio após trim', async () => {
      const provider = criarMockEmbeddingProvider();

      await expect(embedDocumentos('não é array', { provider })).rejects.toThrow(TypeError);
      await expect(embedDocumentos(['ok', '   '], { provider })).rejects.toThrow(TypeError);
      await expect(embedDocumentos(['ok', ''], { provider })).rejects.toThrow(TypeError);
      await expect(embedDocumentos(['ok', 123], { provider })).rejects.toThrow(TypeError);
      await expect(embedDocumentos(['ok', null], { provider })).rejects.toThrow(TypeError);
    });

    test('lança ProvedorIndisponivelError se o vetor retornado tiver tamanho diferente de provider.info.dim', async () => {
      const providerDimErrada = {
        info: { provider: 'gemini', model: 'gemini-embedding-001', dim: 4 },
        embedDocuments: jest.fn().mockResolvedValue([[1, 2]]), // 2 != 4
      };

      await expect(
        embedDocumentos(['texto válido'], { provider: providerDimErrada })
      ).rejects.toThrow(ProvedorIndisponivelError);
    });
  });

  describe('embedPergunta', () => {
    test('segunda chamada igual (mesmo com caixa/espaços diferentes) usa cache e NÃO chama o provider', async () => {
      const base = criarMockEmbeddingProvider();
      const spy = jest.spyOn(base, 'embedQuery');

      const v1 = await embedPergunta('Projetos de Robótica', { provider: base });
      const v2 = await embedPergunta('  projetos   de   robótica  ', { provider: base });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(v1).toEqual(v2);
    });

    test('modelos diferentes não compartilham entrada de cache', async () => {
      const providerA = {
        info: { provider: 'mock', model: 'modelo-a', dim: 4 },
        embedQuery: jest.fn().mockResolvedValue([1, 0, 0, 0]),
      };
      const providerB = {
        info: { provider: 'mock', model: 'modelo-b', dim: 4 },
        embedQuery: jest.fn().mockResolvedValue([0, 1, 0, 0]),
      };

      const rA = await embedPergunta('mesma pergunta', { provider: providerA });
      const rB = await embedPergunta('mesma pergunta', { provider: providerB });

      expect(providerA.embedQuery).toHaveBeenCalledTimes(1);
      expect(providerB.embedQuery).toHaveBeenCalledTimes(1);
      expect(rA).toEqual([1, 0, 0, 0]);
      expect(rB).toEqual([0, 1, 0, 0]);
    });

    test('erro do provider NÃO é cacheado e propaga para o chamador', async () => {
      const providerInstavel = {
        info: { provider: 'gemini', model: 'm', dim: 4 },
        embedQuery: jest
          .fn()
          .mockRejectedValueOnce(new ProvedorIndisponivelError('falha temporária', { provedor: 'gemini', status: 503 }))
          .mockResolvedValueOnce([0, 0, 1, 0]),
      };

      await expect(
        embedPergunta('pergunta teste', { provider: providerInstavel })
      ).rejects.toThrow(ProvedorIndisponivelError);

      const ok = await embedPergunta('pergunta teste', { provider: providerInstavel });
      expect(ok).toEqual([0, 0, 1, 0]);
      expect(providerInstavel.embedQuery).toHaveBeenCalledTimes(2);
    });

    test('expira entrada por TTL usando relógio injetado', async () => {
      let tempoAtual = 1000;
      const cache = criarCacheLru({ max: 10, ttlMs: 500, agora: () => tempoAtual });

      const provider = {
        info: { provider: 'mock', model: 'm', dim: 2 },
        embedQuery: jest.fn().mockResolvedValue([1, 0]),
      };

      await embedPergunta('pergunta ttl', { provider, cache });
      expect(provider.embedQuery).toHaveBeenCalledTimes(1);

      tempoAtual = 1499;
      await embedPergunta('pergunta ttl', { provider, cache });
      expect(provider.embedQuery).toHaveBeenCalledTimes(1);

      tempoAtual = 1500; // Exatamente ttlMs após a criação
      await embedPergunta('pergunta ttl', { provider, cache });
      expect(provider.embedQuery).toHaveBeenCalledTimes(2);
    });

    test('remove a entrada mais antiga (LRU) ao ultrapassar o limite max', async () => {
      let tempoAtual = 0;
      const cache = criarCacheLru({ max: 2, ttlMs: 60000, agora: () => tempoAtual });

      const provider = {
        info: { provider: 'mock', model: 'm', dim: 2 },
        embedQuery: jest.fn().mockImplementation(async (t) => [t.length, 0]),
      };

      await embedPergunta('um', { provider, cache });
      await embedPergunta('dois', { provider, cache });
      // Acessa 'um' novamente para torná-lo o mais recentemente usado; 'dois' passa a ser o mais antigo
      await embedPergunta('um', { provider, cache });
      expect(provider.embedQuery).toHaveBeenCalledTimes(2);

      // Adiciona 'tres', deve evictar 'dois'
      await embedPergunta('tres', { provider, cache });
      expect(provider.embedQuery).toHaveBeenCalledTimes(3);

      // 'um' ainda está no cache
      await embedPergunta('um', { provider, cache });
      expect(provider.embedQuery).toHaveBeenCalledTimes(3);

      // 'dois' foi removido e precisa chamar o provider novamente
      await embedPergunta('dois', { provider, cache });
      expect(provider.embedQuery).toHaveBeenCalledTimes(4);
    });
  });
});

