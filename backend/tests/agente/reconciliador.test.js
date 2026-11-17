require('../setup');
const { Article, Campaign, Category, AgentChunk } = require('../../src/models');
const { criarProfessor } = require('../helpers');
const {
  reconciliarAgora,
  iniciarReconciliacao,
} = require('../../src/services/agente/ingest/reconciliador');
const reconciliador = require('../../src/services/agente/ingest/reconciliador');
const reindexModule = require('../../src/services/agente/ingest/reindex');
const { reindexarTudo } = reindexModule;
const { criarMockEmbeddingProvider } = require('../../src/services/agente/providers/embedding/mock');

describe('Reconciliador automático do RAG (services/agente/ingest/reconciliador.js)', () => {
  const envOriginal = { ...process.env };
  let professor;
  let categoria;

  beforeAll(async () => {
    professor = await criarProfessor({ nome: 'Professora Reconciliadora' });
    categoria = await Category.create({ nome: 'Robótica e Inteligência' });
  });

  beforeEach(async () => {
    process.env = { ...envOriginal };
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_RAG_ENABLED = 'true';
    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'mock';

    await AgentChunk.destroy({ where: {} });
    await Article.destroy({ where: {} });
    await Campaign.destroy({ where: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...envOriginal };
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  test('a) banco com 3 fontes públicas e índice vazio -> reconciliarAgora indexa as 3; segunda chamada -> 0 indexados', async () => {
    await Article.create({
      titulo: 'Artigo Público Um',
      resumo: 'Resumo 1',
      conteudo: 'Conteúdo relevante para o artigo público 1.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });
    await Article.create({
      titulo: 'Artigo Público Dois',
      resumo: 'Resumo 2',
      conteudo: 'Conteúdo relevante para o artigo público 2.',
      tipo: 'artigo_cientifico',
      status: 'publicado',
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });
    await Campaign.create({
      titulo: 'Campanha Ativa Três',
      descricao: 'Descrição do projeto comunitário ativo.',
      status: 'ativa',
      metaFinanceira: 3000,
      valorArrecadado: 1200,
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });

    const logMock = jest.fn();
    const r1 = await reconciliarAgora({ log: logMock });

    expect(r1).not.toBeNull();
    expect(r1.indexados).toBe(3);
    expect(r1.inalterados).toBe(0);
    expect(r1.falhas).toEqual([]);
    expect(await AgentChunk.count()).toBe(3);
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0][0]).toContain('[agente:reconciliar] indexados=3 inalterados=0');

    // 2ª chamada: tudo inalterado -> silêncio
    const logMock2 = jest.fn();
    const r2 = await reconciliarAgora({ log: logMock2 });

    expect(r2).not.toBeNull();
    expect(r2.indexados).toBe(0);
    expect(r2.inalterados).toBe(3);
    expect(logMock2).not.toHaveBeenCalled();
  });

  test('b) fonte que virou recusada -> chunks removidos; fonte apagada -> órfãos removidos', async () => {
    const art1 = await Article.create({
      titulo: 'Artigo que será recusado',
      resumo: 'Resumo',
      conteudo: 'Conteúdo que deixará de ser público.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });
    const camp1 = await Campaign.create({
      titulo: 'Campanha que será excluída',
      descricao: 'Descrição do projeto que será destruído.',
      status: 'ativa',
      metaFinanceira: 1000,
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });

    // Indexa as duas inicialmente
    const r1 = await reconciliarAgora();
    expect(r1.indexados).toBe(2);
    expect(await AgentChunk.count()).toBe(2);

    // art1 vira recusado; camp1 é destruída do banco
    art1.status = 'recusado';
    await art1.save();
    await camp1.destroy();

    const r2 = await reconciliarAgora();
    expect(r2).not.toBeNull();
    expect(r2.removidos + r2.orfaosRemovidos).toBe(2);
    expect(await AgentChunk.count()).toBe(0);
  });

  test('c) flags desligadas ou sem chave -> retorna null e o spy de reindexar não é chamado', async () => {
    const spyReindex = jest.fn();

    // 1. AGENTE_IA_ENABLED=false
    process.env.AGENTE_IA_ENABLED = 'false';
    const resOff = await reconciliarAgora({ reindexar: spyReindex });
    expect(resOff).toBeNull();
    expect(spyReindex).not.toHaveBeenCalled();

    // 2. AGENTE_RAG_ENABLED=false
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_RAG_ENABLED = 'false';
    const resRagOff = await reconciliarAgora({ reindexar: spyReindex });
    expect(resRagOff).toBeNull();
    expect(spyReindex).not.toHaveBeenCalled();

    // 3. Provedor gemini sem chave
    process.env.AGENTE_RAG_ENABLED = 'true';
    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'gemini';
    delete process.env.AGENTE_RAG_EMBEDDING_API_KEY;
    delete process.env.AGENTE_IA_API_KEY;

    const resSemChave = await reconciliarAgora({ reindexar: spyReindex });
    expect(resSemChave).toBeNull();
    expect(spyReindex).not.toHaveBeenCalled();
  });

  test('d) reindexar lançando erro -> reconciliarAgora resolve sem lançar', async () => {
    const reindexComErro = jest.fn().mockRejectedValue(new Error('Conexão perdida com o banco'));

    await expect(reconciliarAgora({ reindexar: reindexComErro })).resolves.toBeNull();
    expect(reindexComErro).toHaveBeenCalledTimes(1);
  });

  test('e) duas chamadas simultâneas -> reindexar chamado uma vez', async () => {
    const reindexarLento = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        indexados: 1,
        inalterados: 0,
        removidos: 0,
        orfaosRemovidos: 0,
        falhas: [],
      };
    });

    const [p1, p2] = await Promise.all([
      reconciliarAgora({ reindexar: reindexarLento }),
      reconciliarAgora({ reindexar: reindexarLento }),
    ]);

    expect(reindexarLento).toHaveBeenCalledTimes(1);
    expect([p1, p2]).toContain(null);
    expect([p1, p2]).toContainEqual(expect.objectContaining({ indexados: 1 }));
  });

  test('f) iniciarReconciliacao com intervalo 10 min: dispara de novo com fake timers, parar() interrompe, intervalo 0 não cria timer, NODE_ENV=test não faz nada', async () => {
    // 1. NODE_ENV === 'test' -> não faz nada
    const spyReconciliar = jest.spyOn(reconciliador, 'reconciliarAgora').mockResolvedValue(null);
    const subTest = iniciarReconciliacao({ intervaloMin: 10 });
    expect(spyReconciliar).not.toHaveBeenCalled();
    subTest.parar();

    // 2. Em ambiente de execução real (simulado fora de 'test')
    process.env.NODE_ENV = 'development';
    jest.useFakeTimers();

    // 2a. intervaloMin = 0 -> dispara apenas no início, nenhum intervalo periódico
    spyReconciliar.mockClear();
    const subZero = iniciarReconciliacao({ intervaloMin: 0 });
    expect(spyReconciliar).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(30 * 60 * 1000);
    expect(spyReconciliar).toHaveBeenCalledTimes(1);
    subZero.parar();

    // 2b. intervaloMin = 10 -> dispara no início e a cada 10 minutos
    spyReconciliar.mockClear();
    const subDez = iniciarReconciliacao({ intervaloMin: 10 });
    expect(spyReconciliar).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(spyReconciliar).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(spyReconciliar).toHaveBeenCalledTimes(3);

    // parar() interrompe o agendamento
    subDez.parar();
    jest.advanceTimersByTime(30 * 60 * 1000);
    expect(spyReconciliar).toHaveBeenCalledTimes(3);

    spyReconciliar.mockRestore();
    jest.useRealTimers();
    process.env.NODE_ENV = 'test';
  });

  test('g) reindexarTudo com 5 fontes inalteradas não aguarda delayMs (teste com sleep injetado)', async () => {
    for (let i = 1; i <= 5; i++) {
      await Article.create({
        titulo: `Artigo Fonte ${i}`,
        resumo: `Resumo ${i}`,
        conteudo: `Conteúdo da fonte número ${i}.`,
        tipo: 'noticia_escolar',
        status: 'publicado',
        autorId: professor.usuario.id,
        categoryId: categoria.id,
      });
    }

    const provider = criarMockEmbeddingProvider();
    // 1ª execução indexa as 5 fontes
    const r1 = await reindexarTudo({ provider });
    expect(r1.indexados).toBe(5);

    // 2ª execução com as 5 fontes inalteradas
    const sleepMock = jest.fn().mockResolvedValue();
    const r2 = await reindexarTudo({
      provider,
      delayMs: 300,
      sleep: sleepMock,
    });

    expect(r2.indexados).toBe(0);
    expect(r2.inalterados).toBe(5);
    expect(sleepMock).not.toHaveBeenCalled();
  });
});
