require('../setup');
const crypto = require('crypto');
const { Article, Campaign, Category, AgentChunk } = require('../../src/models');
const { criarProfessor } = require('../helpers');
const {
  reindexarTudo,
  codigoDeSaida,
  parseArgs,
} = require('../../src/services/agente/ingest/reindex');
const { criarMockEmbeddingProvider } = require('../../src/services/agente/providers/embedding/mock');
const embedder = require('../../src/services/agente/ingest/embedder');
const { EmbeddingNaoConfiguradoError } = embedder;
const { ProvedorIndisponivelError } = require('../../src/services/agente/providers/errors');

describe('Reindexação em lote do RAG (services/agente/ingest/reindex.js)', () => {
  const envOriginal = { ...process.env };
  let professor;
  let categoria;
  let artigos;
  let campanhas;

  beforeAll(async () => {
    professor = await criarProfessor({ nome: 'Professora Reindex' });
    categoria = await Category.create({ nome: 'Ciências e Tecnologia' });
  });

  beforeEach(async () => {
    process.env = { ...envOriginal };
    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'mock';
    // Flags desligadas propositalmente para confirmar que reindexarTudo não depende delas
    process.env.AGENTE_IA_ENABLED = 'false';
    process.env.AGENTE_RAG_ENABLED = 'false';

    await AgentChunk.destroy({ where: {} });
    await Article.destroy({ where: {} });
    await Campaign.destroy({ where: {} });

    const baseArtigo = {
      resumo: 'Resumo padrão',
      conteudo: 'Conteúdo científico para indexação em lote.',
      tipo: 'artigo_cientifico',
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    };

    const artPub1 = await Article.create({
      ...baseArtigo,
      titulo: 'Artigo Publicado Um',
      status: 'publicado',
    });
    const artPub2 = await Article.create({
      ...baseArtigo,
      titulo: 'Artigo Publicado Dois',
      status: 'publicado',
    });
    const artRev = await Article.create({
      ...baseArtigo,
      titulo: 'Artigo Em Revisão Secreto',
      status: 'em_revisao',
    });

    const baseCampanha = {
      descricao: 'Descrição do projeto comunitário.',
      metaFinanceira: 1000,
      valorArrecadado: 500,
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    };

    const campAtiva = await Campaign.create({
      ...baseCampanha,
      titulo: 'Campanha Ativa Um',
      status: 'ativa',
    });
    const campFinanciada = await Campaign.create({
      ...baseCampanha,
      titulo: 'Campanha Financiada Dois',
      status: 'financiada',
    });
    const campEncerrada = await Campaign.create({
      ...baseCampanha,
      titulo: 'Campanha Encerrada Secreta',
      status: 'encerrada',
    });

    artigos = { artPub1, artPub2, artRev };
    campanhas = { campAtiva, campFinanciada, campEncerrada };
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  test('1. 1ª execução: indexados = 4 (2 artigos + 2 campanhas), nenhum chunk das fontes não públicas', async () => {
    const provider = criarMockEmbeddingProvider();
    const resumo = await reindexarTudo({ provider });

    expect(resumo.indexados).toBe(4);
    expect(resumo.inalterados).toBe(0);
    expect(resumo.falhas).toEqual([]);
    expect(codigoDeSaida(resumo)).toBe(0);

    const chunksPub = await AgentChunk.count({
      where: { sourceId: [artigos.artPub1.id, artigos.artPub2.id, campanhas.campAtiva.id, campanhas.campFinanciada.id] },
    });
    expect(chunksPub).toBe(4);

    const chunksNaoPub = await AgentChunk.count({
      where: { sourceId: [artigos.artRev.id, campanhas.campEncerrada.id] },
    });
    expect(chunksNaoPub).toBe(0);
  });

  test('2. 2ª execução: indexados = 0, inalterados = 4, zero chamadas a embedDocuments (spy)', async () => {
    const provider = criarMockEmbeddingProvider();
    await reindexarTudo({ provider });

    const spyEmbed = jest.spyOn(embedder, 'embedDocumentos');
    const resumo2 = await reindexarTudo({ provider });

    expect(resumo2.indexados).toBe(0);
    expect(resumo2.inalterados).toBe(4);
    expect(spyEmbed).not.toHaveBeenCalled();
    spyEmbed.mockRestore();
  });

  test('3. artigo passa a recusado + campanha apagada: próxima execução remove seus chunks e o count final bate', async () => {
    const provider = criarMockEmbeddingProvider();
    await reindexarTudo({ provider });
    expect(await AgentChunk.count()).toBe(4);

    artigos.artPub1.status = 'recusado';
    await artigos.artPub1.save();
    await campanhas.campAtiva.destroy();

    const resumo = await reindexarTudo({ provider });

    expect(resumo.orfaosRemovidos + resumo.removidos).toBe(2);
    expect(resumo.inalterados).toBe(2);
    expect(await AgentChunk.count()).toBe(2);
    expect(await AgentChunk.count({ where: { sourceId: artigos.artPub1.id } })).toBe(0);
    expect(await AgentChunk.count({ where: { sourceId: campanhas.campAtiva.id } })).toBe(0);
  });

  test('4. chunks "fantasma" criados à mão para sourceId inexistente são removidos como órfãos', async () => {
    const provider = criarMockEmbeddingProvider();
    const idFantasma = crypto.randomUUID();

    await AgentChunk.create({
      sourceType: 'artigo',
      sourceId: idFantasma,
      chunkIndex: 0,
      texto: 'Chunk fantasma sem fonte no banco',
      contentHash: 'a'.repeat(64),
      embedding: new Array(64).fill(0.1),
      embeddingModel: provider.info.model,
      dim: 64,
    });

    const resumo = await reindexarTudo({ provider });

    expect(resumo.indexados).toBe(4);
    expect(resumo.orfaosRemovidos).toBe(1);
    expect(await AgentChunk.count({ where: { sourceId: idFantasma } })).toBe(0);
    expect(await AgentChunk.count()).toBe(4);
  });

  test('5. force:true reembeda tudo (spy chamado para todas as fontes)', async () => {
    const provider = criarMockEmbeddingProvider();
    await reindexarTudo({ provider });

    const spyEmbed = jest.spyOn(embedder, 'embedDocumentos');
    const resumo = await reindexarTudo({ provider, force: true });

    expect(resumo.indexados).toBe(4);
    expect(resumo.inalterados).toBe(0);
    expect(spyEmbed).toHaveBeenCalledTimes(4);
    spyEmbed.mockRestore();
  });

  test('6. trocar o modelo do provider (info.model novo) reembeda todas as fontes (CA-16)', async () => {
    const providerV1 = criarMockEmbeddingProvider({ rag: { embeddingModel: 'modelo-v1' } });
    await reindexarTudo({ provider: providerV1 });

    const providerV2 = criarMockEmbeddingProvider({ rag: { embeddingModel: 'modelo-v2' } });
    const resumo = await reindexarTudo({ provider: providerV2 });

    expect(resumo.indexados).toBe(4);
    expect(resumo.modelo).toBe('modelo-v2');

    const chunks = await AgentChunk.findAll();
    expect(chunks).toHaveLength(4);
    for (const c of chunks) {
      expect(c.embeddingModel).toBe('modelo-v2');
    }
  });

  test('7. dryRun: o banco fica idêntico (mesmo count e mesmos updatedAt) e o embedding não é chamado', async () => {
    const provider = criarMockEmbeddingProvider();
    await reindexarTudo({ provider });

    // Adiciona um órfão para garantir que dryRun também não apaga órfãos
    const idOrfao = crypto.randomUUID();
    await AgentChunk.create({
      sourceType: 'campanha',
      sourceId: idOrfao,
      chunkIndex: 0,
      texto: 'Órfão em dry-run',
      contentHash: 'b'.repeat(64),
      embedding: new Array(64).fill(0.1),
      embeddingModel: provider.info.model,
      dim: 64,
    });

    const antes = await AgentChunk.findAll({ order: [['id', 'ASC']] });
    const snapshotAntes = antes.map((c) => ({ id: c.id, updatedAt: c.updatedAt.toISOString() }));

    const spyEmbed = jest.spyOn(embedder, 'embedDocumentos');
    const resumo = await reindexarTudo({ provider, force: true, dryRun: true });

    expect(spyEmbed).not.toHaveBeenCalled();
    spyEmbed.mockRestore();
    expect(resumo.dryRun).toBe(true);
    expect(resumo.indexados).toBe(4);
    expect(resumo.orfaosRemovidos).toBe(1);

    const depois = await AgentChunk.findAll({ order: [['id', 'ASC']] });
    const snapshotDepois = depois.map((c) => ({ id: c.id, updatedAt: c.updatedAt.toISOString() }));
    expect(snapshotDepois).toEqual(snapshotAntes);
  });

  test('8. provider que falha para UMA fonte específica: execução termina, demais são indexadas, falhas.length === 1 e codigoDeSaida === 2', async () => {
    const base = criarMockEmbeddingProvider();
    let chamadas = 0;
    const providerInstavel = {
      info: base.info,
      async embedDocuments(textos) {
        chamadas += 1;
        if (chamadas === 2) {
          throw new ProvedorIndisponivelError('Falha na segunda fonte', { provedor: 'mock', status: 503 });
        }
        return base.embedDocuments(textos);
      },
    };

    const resumo = await reindexarTudo({ provider: providerInstavel });

    expect(resumo.indexados).toBe(3);
    expect(resumo.falhas).toHaveLength(1);
    expect(resumo.falhas[0]).toMatchObject({
      sourceType: 'artigo',
      sourceId: artigos.artPub2.id,
      mensagem: 'Falha na segunda fonte',
    });
    expect(codigoDeSaida(resumo)).toBe(2);
    expect(await AgentChunk.count()).toBe(3);
  });

  test('9. delayMs é respeitado entre fontes (sleep injetado)', async () => {
    const provider = criarMockEmbeddingProvider();
    const sleepMock = jest.fn().mockResolvedValue();

    await reindexarTudo({
      provider,
      delayMs: 250,
      sleep: sleepMock,
    });

    // Com 4 fontes, há 3 intervalos entre fontes (n - 1)
    expect(sleepMock).toHaveBeenCalledTimes(3);
    expect(sleepMock).toHaveBeenNthCalledWith(1, 250);
    expect(sleepMock).toHaveBeenNthCalledWith(2, 250);
    expect(sleepMock).toHaveBeenNthCalledWith(3, 250);
  });

  test('10. sem chave (provider gemini sem key): reindexarTudo lança EmbeddingNaoConfiguradoError', async () => {
    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'gemini';
    delete process.env.AGENTE_RAG_EMBEDDING_API_KEY;
    delete process.env.AGENTE_IA_API_KEY;

    await expect(reindexarTudo()).rejects.toThrow(EmbeddingNaoConfiguradoError);
  });

  test('parseArgs interpreta flags --dry-run, --force e --delay-ms com fallback 300', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, force: false, delayMs: 300 });
    expect(parseArgs(['--dry-run', '--force', '--delay-ms=150'])).toEqual({
      dryRun: true,
      force: true,
      delayMs: 150,
    });
    expect(parseArgs(['--delay-ms=abc'])).toEqual({ dryRun: false, force: false, delayMs: 300 });
    expect(parseArgs(['--delay-ms=-10'])).toEqual({ dryRun: false, force: false, delayMs: 300 });
  });
});
