require('../setup');
const { Article, Campaign, Category, AgentChunk } = require('../../src/models');
const { criarProfessor } = require('../helpers');
const {
  reconciliarAgora,
  iniciarReconciliacao,
} = require('../../src/services/agente/ingest/reconciliador');
const reindexModulo = require('../../src/services/agente/ingest/reindex');
const { invalidarIndice } = require('../../src/services/agente/retrieval/indice');
const { limparCache } = require('../../src/services/agente/ingest/embedder');

describe('Reconciliação Automática do Índice RAG (ingest/reconciliador.js)', () => {
  const envOriginal = { ...process.env };
  let professor;
  let categoria;

  beforeAll(async () => {
    professor = await criarProfessor({
      nome: 'Prof Reconciliador',
      email: 'prof.reconciliador@ifsp.edu.br',
    });
    categoria = await Category.create({ nome: 'Categoria Reconciliador' });
  });

  beforeEach(async () => {
    process.env = { ...envOriginal };
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_RAG_ENABLED = 'true';
    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'mock';
    process.env.AGENTE_RAG_EMBEDDING_API_KEY = 'mock-key';

    await AgentChunk.destroy({ where: {} });
    await Article.destroy({ where: {} });
    await Campaign.destroy({ where: {} });
    invalidarIndice();
    limparCache();
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  test('a) banco com 3 fontes públicas e índice vazio -> reconciliarAgora indexa as 3; segunda chamada -> 0 indexados', async () => {
    const art1 = await Article.create({
      titulo: 'Artigo Um Reconciliacao',
      resumo: 'Resumo 1',
      conteudo: 'Conteúdo do artigo 1',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });
    const art2 = await Article.create({
      titulo: 'Artigo Dois Reconciliacao',
      resumo: 'Resumo 2',
      conteudo: 'Conteúdo do artigo 2',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });
    const camp = await Campaign.create({
      titulo: 'Campanha Reconciliacao',
      descricao: 'Descrição da campanha',
      status: 'ativa',
      metaFinanceira: 500,
      valorArrecadado: 50,
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });

    // 1ª execução
    const r1 = await reconciliarAgora();
    expect(r1).toBeDefined();
    expect(r1.indexados).toBe(3);
    expect(r1.inalterados).toBe(0);
    expect(await AgentChunk.count()).toBe(3);

    // 2ª execução idempotente
    const r2 = await reconciliarAgora();
    expect(r2).toBeDefined();
    expect(r2.indexados).toBe(0);
    expect(r2.inalterados).toBe(3);
    expect(await AgentChunk.count()).toBe(3);
  });

  test('b) fonte que virou recusada -> chunks removidos; fonte apagada -> órfãos removidos', async () => {
    const art = await Article.create({
      titulo: 'Artigo para Recusar',
      resumo: 'Resumo',
      conteudo: 'Conteudo',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });
    const camp = await Campaign.create({
      titulo: 'Campanha para Apagar',
      descricao: 'Descricao',
      status: 'ativa',
      metaFinanceira: 1000,
      valorArrecadado: 0,
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });

    await reconciliarAgora();
    expect(await AgentChunk.count()).toBe(2);

    // Artigo passa a recusado e campanha é apagada do banco
    art.status = 'recusado';
    await art.save();
    await camp.destroy();

    const r = await reconciliarAgora();
    expect(r.removidos + r.orfaosRemovidos).toBe(2);
    expect(await AgentChunk.count()).toBe(0);
  });

  test('c) flags desligadas ou sem chave -> retorna null e o spy de reindexar não é chamado', async () => {
    const spyReindex = jest.spyOn(reindexModulo, 'reindexarTudo');

    // 1. Assistente desligado
    const r1 = await reconciliarAgora({
      config: {
        enabled: false,
        rag: { enabled: true, embeddingProvider: 'mock', embeddingApiKey: 'k' },
      },
    });
    expect(r1).toBeNull();
    expect(spyReindex).not.toHaveBeenCalled();

    // 2. RAG desligado
    const r2 = await reconciliarAgora({
      config: {
        enabled: true,
        rag: { enabled: false, embeddingProvider: 'mock', embeddingApiKey: 'k' },
      },
    });
    expect(r2).toBeNull();
    expect(spyReindex).not.toHaveBeenCalled();

    // 3. Provedor gemini sem chave
    const r3 = await reconciliarAgora({
      config: {
        enabled: true,
        rag: { enabled: true, embeddingProvider: 'gemini', embeddingApiKey: null },
      },
    });
    expect(r3).toBeNull();
    expect(spyReindex).not.toHaveBeenCalled();

    spyReindex.mockRestore();
  });

  test('d) reindexar lançando erro -> reconciliarAgora resolve sem lançar', async () => {
    const reindexComErro = jest.fn().mockRejectedValue(new Error('Erro de I/O no banco'));

    await expect(reconciliarAgora({ reindexar: reindexComErro })).resolves.toBeNull();
    expect(reindexComErro).toHaveBeenCalled();
  });

  test('e) duas chamadas simultâneas -> reindexar chamado uma vez', async () => {
    let resolverReindex;
    const reindexLento = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverReindex = resolve;
        })
    );

    const p1 = reconciliarAgora({ reindexar: reindexLento });
    const p2 = reconciliarAgora({ reindexar: reindexLento });

    resolverReindex({
      indexados: 1,
      inalterados: 0,
      removidos: 0,
      orfaosRemovidos: 0,
      falhas: [],
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(reindexLento).toHaveBeenCalledTimes(1);
    expect(r1).toBeDefined();
    expect(r1.indexados).toBe(1);
    expect(r2).toBeNull();
  });

  test('f) iniciarReconciliacao com intervalo 10 min: dispara no início e a cada intervalo; parar() o interrompe; intervalo 0 não cria timer; em NODE_ENV=test não faz nada', async () => {
    // 1. Em NODE_ENV === 'test' não faz nada
    const recMockTest = jest.fn().mockResolvedValue();
    const ctrlTest = iniciarReconciliacao({ reconciliar: recMockTest });
    expect(recMockTest).not.toHaveBeenCalled();
    ctrlTest.parar();

    // 2. Com intervalo 10 min (simulando NODE_ENV !== 'test')
    jest.useFakeTimers();
    const envOriginalNode = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const recMock = jest.fn().mockResolvedValue();
      const ctrl = iniciarReconciliacao({
        intervaloMin: 10,
        reconciliar: recMock,
      });

      // Dispara imediatamente sem await
      expect(recMock).toHaveBeenCalledTimes(1);

      // Avança 10 minutos (600_000 ms)
      jest.advanceTimersByTime(600_000);
      expect(recMock).toHaveBeenCalledTimes(2);

      // Avança mais 10 minutos
      jest.advanceTimersByTime(600_000);
      expect(recMock).toHaveBeenCalledTimes(3);

      // parar() cancela o timer
      ctrl.parar();
      jest.advanceTimersByTime(600_000);
      expect(recMock).toHaveBeenCalledTimes(3);

      // 3. Com intervalo 0 min: dispara na inicialização mas não cria intervalo
      const recMockZero = jest.fn().mockResolvedValue();
      const ctrlZero = iniciarReconciliacao({
        intervaloMin: 0,
        reconciliar: recMockZero,
      });
      expect(recMockZero).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1_000_000);
      expect(recMockZero).toHaveBeenCalledTimes(1);
      ctrlZero.parar();
    } finally {
      process.env.NODE_ENV = envOriginalNode;
      jest.useRealTimers();
    }
  });
});
