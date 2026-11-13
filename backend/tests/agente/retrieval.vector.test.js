require('../setup');
const crypto = require('crypto');
const { AgentChunk } = require('../../src/models');
const { semearChunk, criarProvider } = require('./_fixtures');
const { invalidarIndice } = require('../../src/services/agente/retrieval/indice');
const { criarVectorStoreSqlite } = require('../../src/services/agente/retrieval/vectorStore');
const { buscarVetorial } = require('../../src/services/agente/retrieval/vector');
const {
  EmbeddingNaoConfiguradoError,
  limparCache,
} = require('../../src/services/agente/ingest/embedder');
const { criarMockEmbeddingProvider } = require('../../src/services/agente/providers/embedding/mock');
const { ProvedorIndisponivelError } = require('../../src/services/agente/providers/errors');

describe('Recuperação Vetorial e VectorStore (T9)', () => {
  const envOriginal = { ...process.env };
  let provider;

  beforeAll(() => {
    provider = criarProvider();
  });

  beforeEach(async () => {
    process.env = { ...envOriginal };
    await AgentChunk.destroy({ where: {} });
    invalidarIndice();
    limparCache();
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  test('1. resultado ordenado por cosseno; chunk com palavras em comum vem primeiro; score em [-1,1]; k respeitado', async () => {
    const cDiferente = await semearChunk({
      texto: 'Título: Literatura Colonial\nPoemas e crônicas do século XVII.',
      provider,
    });
    const cParecido = await semearChunk({
      texto: 'Título: Robótica e Automação\nConstrução de braços robóticos com arduino e sensores.',
      provider,
    });
    await semearChunk({
      texto: 'Título: Educação Ambiental\nReciclagem de resíduos sólidos na escola.',
      provider,
    });

    const resultados = await buscarVetorial('projetos de robótica com arduino', {
      provider,
      k: 2,
    });

    expect(resultados).toHaveLength(2);
    expect(resultados[0].chunkId).toBe(cParecido.id);
    expect(resultados[0].chunkId).not.toBe(cDiferente.id);

    for (const r of resultados) {
      expect(r.score).toBeGreaterThanOrEqual(-1);
      expect(r.score).toBeLessThanOrEqual(1);
    }
    expect(resultados[0].score).toBeGreaterThanOrEqual(resultados[1].score);
  });

  test('2. chunks gravados com outro embeddingModel OU outra dim são ignorados (CA-16/RN-09)', async () => {
    const providerOutroModelo = criarMockEmbeddingProvider({
      rag: { embeddingModel: 'modelo-antigo' },
    });
    const providerOutraDim = {
      info: { provider: 'mock', model: provider.info.model, dim: 4 },
      async embedDocuments(textos) {
        return textos.map(() => [1, 0, 0, 0]);
      },
    };

    const chunkValido = await semearChunk({
      texto: 'Título: Energia Solar\nPainéis fotovoltaicos no campus.',
      provider,
    });
    const chunkModeloAntigo = await semearChunk({
      texto: 'Título: Energia Solar Antiga\nPainéis fotovoltaicos.',
      provider: providerOutroModelo,
    });
    const chunkDimDiferente = await semearChunk({
      texto: 'Título: Energia Solar Dim 4\nPainéis fotovoltaicos.',
      provider: providerOutraDim,
    });

    const resultados = await buscarVetorial('energia solar', { provider });

    expect(resultados).toHaveLength(1);
    expect(resultados[0].chunkId).toBe(chunkValido.id);
    expect(resultados.map((r) => r.chunkId)).not.toContain(chunkModeloAntigo.id);
    expect(resultados.map((r) => r.chunkId)).not.toContain(chunkDimDiferente.id);
  });

  test('3. índice vazio -> []', async () => {
    const resultados = await buscarVetorial('qualquer pergunta', { provider });
    expect(resultados).toEqual([]);
  });

  test('4. mesma pergunta duas vezes chama provider.embedQuery uma única vez (cache da T5)', async () => {
    await semearChunk({
      texto: 'Título: Astronomia Amadora\nObservação de planetas.',
      provider,
    });

    const spyQuery = jest.spyOn(provider, 'embedQuery');
    await buscarVetorial('Observação de planetas', { provider });
    await buscarVetorial('  observação   de  planetas ', { provider });

    expect(spyQuery).toHaveBeenCalledTimes(1);
    spyQuery.mockRestore();
  });

  test('5. 2ª busca não recarrega do banco: spy em AgentChunk.findAll não é chamado para recarga na segunda vez', async () => {
    await semearChunk({
      texto: 'Título: Química Verde\nSíntese sustentável em laboratório.',
      provider,
    });

    const spyFindAll = jest.spyOn(AgentChunk, 'findAll');
    const recargasCompletas = () =>
      spyFindAll.mock.calls.filter(([opts]) => !opts?.limit && !opts?.plain).length;

    await buscarVetorial('química sustentável', { provider });
    expect(recargasCompletas()).toBe(1);

    await buscarVetorial('laboratório verde', { provider });
    expect(recargasCompletas()).toBe(1);

    spyFindAll.mockRestore();
  });

  test('6. provider que lança ProvedorIndisponivelError propaga; gemini sem chave lança EmbeddingNaoConfiguradoError', async () => {
    const providerFalho = {
      info: { provider: 'gemini', model: 'gemini-embedding-001', dim: 64 },
      embedQuery: jest
        .fn()
        .mockRejectedValue(new ProvedorIndisponivelError('API fora do ar', { provedor: 'gemini', status: 503 })),
    };

    await expect(
      buscarVetorial('teste falha', { provider: providerFalho })
    ).rejects.toThrow(ProvedorIndisponivelError);

    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'gemini';
    delete process.env.AGENTE_RAG_EMBEDDING_API_KEY;
    delete process.env.AGENTE_IA_API_KEY;

    await expect(buscarVetorial('teste sem chave')).rejects.toThrow(
      EmbeddingNaoConfiguradoError
    );
  });

  test('7. store customizado (objeto fake com .buscar) é usado quando passado', async () => {
    const retornoFake = [
      {
        chunkId: crypto.randomUUID(),
        sourceType: 'artigo',
        sourceId: crypto.randomUUID(),
        chunkIndex: 0,
        texto: 'Título: Fake Store\nConteúdo simulado.',
        score: 0.99,
      },
    ];
    const storeFake = {
      buscar: jest.fn().mockResolvedValue(retornoFake),
    };

    const resultados = await buscarVetorial('pergunta qualquer', {
      provider,
      k: 5,
      store: storeFake,
    });

    expect(storeFake.buscar).toHaveBeenCalledTimes(1);
    const [vetorPassado, opcoesPassadas] = storeFake.buscar.mock.calls[0];
    expect(vetorPassado).toHaveLength(64);
    expect(opcoesPassadas).toEqual({
      k: 5,
      embeddingModel: provider.info.model,
      dim: provider.info.dim,
    });
    expect(resultados).toEqual(retornoFake);
  });

  test('vectorStore lança Error claro se o vetor de consulta tiver dimensão diferente de dim', async () => {
    const store = criarVectorStoreSqlite();
    await expect(
      store.buscar([1, 0, 0], { k: 5, embeddingModel: 'm', dim: 64 })
    ).rejects.toThrow(/dimensão/i);
  });
});

