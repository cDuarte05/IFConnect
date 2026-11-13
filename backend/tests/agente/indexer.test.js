require('../setup');
const request = require('supertest');
const app = require('../../src/app');
const { Article, Campaign, Category, AgentChunk } = require('../../src/models');
const { criarProfessor } = require('../helpers');
const {
  indexarFonte,
  removerFonte,
  indexarFonteSeguro,
  aguardarPendentes,
} = require('../../src/services/agente/ingest/indexer');
const embedder = require('../../src/services/agente/ingest/embedder');
const { ProvedorIndisponivelError } = require('../../src/services/agente/providers/errors');

const envOriginal = { ...process.env };
const fetchOriginal = global.fetch;

describe('Indexador do RAG (services/agente/ingest/indexer.js)', () => {
  let professor;
  let categoria;

  beforeAll(async () => {
    professor = await criarProfessor({ nome: 'Professora Indexadora' });
    categoria = await Category.create({ nome: 'Engenharia e Tecnologia' });
  });

  beforeEach(() => {
    process.env = { ...envOriginal };
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_RAG_ENABLED = 'true';
    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'mock';
  });

  afterEach(async () => {
    global.fetch = fetchOriginal;
    process.env = { ...envOriginal };
    await aguardarPendentes();
  });

  afterAll(async () => {
    process.env = envOriginal;
  });

  test('1. artigo publicado -> N chunks gravados com embeddingModel e dim de provider.info, vetor 64, texto com "Título:"', async () => {
    const artigo = await Article.create({
      titulo: 'Desenvolvimento de Satélites Educacionais',
      resumo: 'Construção de CubeSats no Instituto Federal.',
      conteudo: 'Conteúdo detalhado sobre sensores, telemetria e montagem mecânica de nanossatélites.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });

    const res = await indexarFonte('artigo', artigo.id);
    expect(res.acao).toBe('indexado');
    expect(res.chunks).toBeGreaterThan(0);

    const chunks = await AgentChunk.findAll({
      where: { sourceType: 'artigo', sourceId: artigo.id },
      order: [['chunkIndex', 'ASC']],
    });

    expect(chunks.length).toBe(res.chunks);
    for (const c of chunks) {
      expect(c.embeddingModel).toBe('gemini-embedding-001'); // ou mock-embedding definido no provider
      expect(c.dim).toBe(64);
      expect(Array.isArray(c.embedding)).toBe(true);
      expect(c.embedding).toHaveLength(64);
      expect(c.texto.startsWith('Título: Desenvolvimento de Satélites Educacionais')).toBe(true);
    }
  });

  test('2. segunda chamada -> "inalterado" e spy de embedDocuments NÃO é chamado de novo', async () => {
    const artigo = await Article.create({
      titulo: 'Robótica Móvel Autônoma',
      resumo: 'Pesquisa com robôs seguidores de linha.',
      conteudo: 'Algoritmos PID e controle de motores DC.',
      tipo: 'artigo_cientifico',
      status: 'publicado',
      autorId: professor.usuario.id,
      categoryId: categoria.id,
    });

    const res1 = await indexarFonte('artigo', artigo.id);
    expect(res1.acao).toBe('indexado');

    const spyEmbed = jest.spyOn(embedder, 'embedDocumentos');
    const res2 = await indexarFonte('artigo', artigo.id);
    expect(res2.acao).toBe('inalterado');
    expect(res2.chunks).toBe(res1.chunks);
    expect(spyEmbed).not.toHaveBeenCalled();
    spyEmbed.mockRestore();
  });

  test('3. alterar conteúdo para ficar menor -> reindexa e não sobram chunks antigos', async () => {
    const artigo = await Article.create({
      titulo: 'Artigo Extenso que vai encolher',
      resumo: 'Resumo preliminar',
      conteudo: 'Parágrafo 1. '.repeat(50) + '\n\n' + 'Parágrafo 2. '.repeat(50),
      tipo: 'artigo_cientifico',
      status: 'publicado',
      autorId: professor.usuario.id,
    });

    const res1 = await indexarFonte('artigo', artigo.id);
    expect(res1.chunks).toBeGreaterThan(1);

    artigo.conteudo = 'Apenas uma frase curta.';
    await artigo.save();

    const res2 = await indexarFonte('artigo', artigo.id);
    expect(res2.acao).toBe('indexado');
    expect(res2.chunks).toBe(1);

    const contagem = await AgentChunk.count({
      where: { sourceType: 'artigo', sourceId: artigo.id },
    });
    expect(contagem).toBe(1);
  });

  test('4. force:true reindexa mesmo com hash igual', async () => {
    const artigo = await Article.create({
      titulo: 'Forçar reindexação',
      resumo: 'Resumo forçado',
      conteudo: 'Conteúdo forçado para teste.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
    });

    await indexarFonte('artigo', artigo.id);

    const spyEmbed = jest.spyOn(embedder, 'embedDocumentos');
    const res = await indexarFonte('artigo', artigo.id, { force: true });
    expect(res.acao).toBe('indexado');
    expect(spyEmbed).toHaveBeenCalledTimes(1);
    spyEmbed.mockRestore();
  });

  test('5. artigo em_revisao, rascunho, recusado -> nenhum chunk; se status mudou -> removidos', async () => {
    const artigo = await Article.create({
      titulo: 'Artigo que será despublicado',
      resumo: 'Resumo inicial',
      conteudo: 'Conteúdo que deixará de ser público.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
    });

    await indexarFonte('artigo', artigo.id);
    let chunks = await AgentChunk.count({ where: { sourceType: 'artigo', sourceId: artigo.id } });
    expect(chunks).toBeGreaterThan(0);

    artigo.status = 'recusado';
    await artigo.save();

    const resRecusado = await indexarFonte('artigo', artigo.id);
    expect(resRecusado.acao).toBe('removido');
    chunks = await AgentChunk.count({ where: { sourceType: 'artigo', sourceId: artigo.id } });
    expect(chunks).toBe(0);

    artigo.status = 'em_revisao';
    await artigo.save();
    const resRevisao = await indexarFonte('artigo', artigo.id);
    expect(resRevisao.acao).toBe('ignorado');
    expect(resRevisao.motivo).toBe('sem_chunks');
  });

  test('6. campanha ativa e financiada indexadas; em_analise e encerrada removidas/ignoradas', async () => {
    const campanha = await Campaign.create({
      titulo: 'Campanha de Financiamento Coletivo de Robótica',
      descricao: 'Aquisição de motores e sensores para a equipe de competição.',
      status: 'ativa',
      metaFinanceira: 5000,
      valorArrecadado: 1000,
      autorId: professor.usuario.id,
    });

    const resAtiva = await indexarFonte('campanha', campanha.id);
    expect(resAtiva.acao).toBe('indexado');

    campanha.status = 'financiada';
    await campanha.save();
    const resFinanciada = await indexarFonte('campanha', campanha.id);
    expect(resFinanciada.acao).toBe('inalterado');

    campanha.status = 'encerrada';
    await campanha.save();
    const resEncerrada = await indexarFonte('campanha', campanha.id);
    expect(resEncerrada.acao).toBe('removido');

    campanha.status = 'em_analise';
    await campanha.save();
    const resAnalise = await indexarFonte('campanha', campanha.id);
    expect(resAnalise.acao).toBe('ignorado');
  });

  test('7. mudar o modelo do provider (info.model diferente) -> reindexa', async () => {
    const artigo = await Article.create({
      titulo: 'Mudança de Modelo de Embedding',
      resumo: 'Resumo do modelo',
      conteudo: 'Texto para teste de upgrade de embedding model.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
    });

    const providerV1 = {
      info: { provider: 'mock', model: 'mock-v1', dim: 64 },
      embedDocuments: jest.fn().mockResolvedValue([new Array(64).fill(0.1)]),
    };
    const providerV2 = {
      info: { provider: 'mock', model: 'mock-v2', dim: 64 },
      embedDocuments: jest.fn().mockResolvedValue([new Array(64).fill(0.2)]),
    };

    const res1 = await indexarFonte('artigo', artigo.id, { provider: providerV1 });
    expect(res1.acao).toBe('indexado');

    const res2 = await indexarFonte('artigo', artigo.id, { provider: providerV2 });
    expect(res2.acao).toBe('indexado');

    const chunk = await AgentChunk.findOne({ where: { sourceType: 'artigo', sourceId: artigo.id } });
    expect(chunk.embeddingModel).toBe('mock-v2');
  });

  test('8. provider que lança ProvedorIndisponivelError -> indexarFonte rejeita, chunks preservados; indexarFonteSeguro resolve', async () => {
    const artigo = await Article.create({
      titulo: 'Resiliência contra Falha de Provedor',
      resumo: 'Resumo seguro',
      conteudo: 'Texto que já tem chunks salvos no banco.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
    });

    await indexarFonte('artigo', artigo.id);
    const chunksAntes = await AgentChunk.findAll({ where: { sourceType: 'artigo', sourceId: artigo.id } });
    expect(chunksAntes.length).toBeGreaterThan(0);

    const providerFalho = {
      info: { provider: 'gemini', model: 'gemini-embedding-001', dim: 64 },
      embedDocuments: jest.fn().mockRejectedValue(new ProvedorIndisponivelError('API timeout', { provedor: 'gemini' })),
    };

    // indexarFonte deve rejeitar
    await expect(
      indexarFonte('artigo', artigo.id, { provider: providerFalho, force: true })
    ).rejects.toThrow(ProvedorIndisponivelError);

    // Chunks antigos preservados
    const chunksDepois = await AgentChunk.findAll({ where: { sourceType: 'artigo', sourceId: artigo.id } });
    expect(chunksDepois.length).toBe(chunksAntes.length);

    // indexarFonteSeguro deve capturar e resolver sem lançar
    const resultadoSeguro = await indexarFonteSeguro('artigo', artigo.id, { provider: providerFalho, force: true });
    expect(resultadoSeguro.acao).toBe('falha');
  });

  test('9. sem chave de embedding (provider gemini sem key) -> "ignorado/embedding_nao_configurado" e chunks preservados', async () => {
    const artigo = await Article.create({
      titulo: 'Artigo sem chave de embedding',
      resumo: 'Resumo',
      conteudo: 'Texto com chunks pré-existentes.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
    });

    await indexarFonte('artigo', artigo.id);
    const totalAntes = await AgentChunk.count({ where: { sourceType: 'artigo', sourceId: artigo.id } });
    expect(totalAntes).toBeGreaterThan(0);

    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'gemini';
    delete process.env.AGENTE_RAG_EMBEDDING_API_KEY;
    delete process.env.AGENTE_IA_API_KEY;

    const res = await indexarFonte('artigo', artigo.id, { force: true });
    expect(res.acao).toBe('ignorado');
    expect(res.motivo).toBe('embedding_nao_configurado');

    const totalDepois = await AgentChunk.count({ where: { sourceType: 'artigo', sourceId: artigo.id } });
    expect(totalDepois).toBe(totalAntes);
  });

  test('10. dryRun não grava nem chama embedding', async () => {
    const artigo = await Article.create({
      titulo: 'Teste de Dry Run',
      resumo: 'Resumo dry run',
      conteudo: 'Conteúdo que não deve ser gravado nem embedado.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
    });

    const spyEmbed = jest.spyOn(embedder, 'embedDocumentos');
    const res = await indexarFonte('artigo', artigo.id, { dryRun: true });
    expect(res.acao).toBe('indexado');
    expect(spyEmbed).not.toHaveBeenCalled();

    const count = await AgentChunk.count({ where: { sourceType: 'artigo', sourceId: artigo.id } });
    expect(count).toBe(0);
    spyEmbed.mockRestore();
  });

  test('11. Promise.all de duas indexações da mesma fonte -> sem erro de constraint e sem duplicatas', async () => {
    const artigo = await Article.create({
      titulo: 'Concorrência de Indexação',
      resumo: 'Teste de corrida',
      conteudo: 'Conteúdo para validar a fila de serialização por chave.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
    });

    const [r1, r2] = await Promise.all([
      indexarFonteSeguro('artigo', artigo.id, { force: true }),
      indexarFonteSeguro('artigo', artigo.id, { force: true }),
    ]);

    expect(['indexado', 'inalterado']).toContain(r1.acao);
    expect(['indexado', 'inalterado']).toContain(r2.acao);

    const count = await AgentChunk.count({ where: { sourceType: 'artigo', sourceId: artigo.id } });
    expect(count).toBeGreaterThan(0);
    // Garantir que não há duplicidade de chunkIndex
    const chunks = await AgentChunk.findAll({ where: { sourceType: 'artigo', sourceId: artigo.id } });
    const indices = chunks.map((c) => c.chunkIndex);
    expect(new Set(indices).size).toBe(chunks.length);
  });

  test('12. conteúdo indexado não contém o nome do autor nem metaFinanceira/valorArrecadado', async () => {
    const autorSecreto = await criarProfessor({ nome: 'Autor Ultrassecreto Da Silva' });
    const campanha = await Campaign.create({
      titulo: 'Campanha de Privacidade e Sigilo',
      descricao: 'Descrição detalhada dos objetivos do projeto comunitário.',
      status: 'ativa',
      metaFinanceira: 98765,
      valorArrecadado: 43210,
      autorId: autorSecreto.usuario.id,
    });

    await indexarFonte('campanha', campanha.id);
    const chunks = await AgentChunk.findAll({ where: { sourceType: 'campanha', sourceId: campanha.id } });

    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.texto).not.toContain('Autor Ultrassecreto Da Silva');
      expect(c.texto).not.toContain('98765');
      expect(c.texto).not.toContain('43210');
    }
  });

  test('13. HOOKS via supertest: criação professor, moderação recusa/aprova, estudante em revisão, campanha ativa/encerrada', async () => {
    // 13a. Professor cria artigo -> status publicado direto -> chunks criados
    const resCriarProf = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${professor.token}`)
      .send({
        titulo: 'Artigo Criado por Professor',
        resumo: 'Resumo prof',
        conteudo: 'Conteúdo que já nasce publicado e indexado.',
        tipo: 'noticia_escolar',
      });
    expect(resCriarProf.status).toBe(201);
    const artigoId = resCriarProf.body.id;

    await aguardarPendentes();
    let countArtigo = await AgentChunk.count({ where: { sourceType: 'artigo', sourceId: artigoId } });
    expect(countArtigo).toBeGreaterThan(0);

    // 13b. Professor recusa o artigo -> status recusado -> chunks removidos
    const resRecusar = await request(app)
      .patch(`/api/artigos/${artigoId}/moderar`)
      .set('Authorization', `Bearer ${professor.token}`)
      .send({ status: 'recusado' });
    expect(resRecusar.status).toBe(200);

    await aguardarPendentes();
    countArtigo = await AgentChunk.count({ where: { sourceType: 'artigo', sourceId: artigoId } });
    expect(countArtigo).toBe(0);

    // 13c. Professor aprova de novo -> status publicado -> chunks voltam
    const resAprovar = await request(app)
      .patch(`/api/artigos/${artigoId}/moderar`)
      .set('Authorization', `Bearer ${professor.token}`)
      .send({ status: 'publicado' });
    expect(resAprovar.status).toBe(200);

    await aguardarPendentes();
    countArtigo = await AgentChunk.count({ where: { sourceType: 'artigo', sourceId: artigoId } });
    expect(countArtigo).toBeGreaterThan(0);

    // 13d. Estudante cria artigo -> status em_revisao -> nenhum chunk
    const resEstudanteAuth = await request(app)
      .post('/api/auth/registrar')
      .send({
        nome: 'Estudante RAG',
        email: `estudante.${Date.now()}@ifsp.edu.br`,
        senha: 'senhaEstudante123',
        tipo: 'estudante',
      });
    const estudanteToken = resEstudanteAuth.body.token;

    const resCriarEstudante = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${estudanteToken}`)
      .send({
        titulo: 'Artigo de Estudante em Revisão',
        resumo: 'Resumo est',
        conteudo: 'Aguardando avaliação pedagógica.',
        tipo: 'noticia_escolar',
      });
    expect(resCriarEstudante.status).toBe(201);
    const artigoEstudanteId = resCriarEstudante.body.id;

    await aguardarPendentes();
    const countEstudante = await AgentChunk.count({ where: { sourceType: 'artigo', sourceId: artigoEstudanteId } });
    expect(countEstudante).toBe(0);

    // 13e. Campanha aprovada (status 'ativa') -> chunks; depois 'encerrada' -> removidos
    const campanha = await Campaign.create({
      titulo: 'Campanha para Validação de Hook',
      descricao: 'Descrição da campanha.',
      status: 'em_analise',
      metaFinanceira: 2000,
      autorId: professor.usuario.id,
    });

    const resModerarCampanha = await request(app)
      .patch(`/api/campanhas/${campanha.id}/moderar`)
      .set('Authorization', `Bearer ${professor.token}`)
      .send({ status: 'ativa' });
    expect(resModerarCampanha.status).toBe(200);

    await aguardarPendentes();
    let countCamp = await AgentChunk.count({ where: { sourceType: 'campanha', sourceId: campanha.id } });
    expect(countCamp).toBeGreaterThan(0);

    const resEncerrarCampanha = await request(app)
      .patch(`/api/campanhas/${campanha.id}/moderar`)
      .set('Authorization', `Bearer ${professor.token}`)
      .send({ status: 'encerrada' });
    expect(resEncerrarCampanha.status).toBe(200);

    await aguardarPendentes();
    countCamp = await AgentChunk.count({ where: { sourceType: 'campanha', sourceId: campanha.id } });
    expect(countCamp).toBe(0);
  });

  test('14. HOOK não quebra a rota: com provider gemini + chave fake e global.fetch mockado para falhar, rota responde 200', async () => {
    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'gemini';
    process.env.AGENTE_RAG_EMBEDDING_API_KEY = 'chave-gemini-fake';

    global.fetch = jest.fn().mockRejectedValue(new Error('Falha de conexão com a API Gemini'));

    const artigo = await Article.create({
      titulo: 'Artigo com IA fora do ar',
      resumo: 'Resumo',
      conteudo: 'Conteúdo moderação.',
      tipo: 'noticia_escolar',
      status: 'em_revisao',
      autorId: professor.usuario.id,
    });

    const res = await request(app)
      .patch(`/api/artigos/${artigo.id}/moderar`)
      .set('Authorization', `Bearer ${professor.token}`)
      .send({ status: 'publicado' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('publicado');

    await aguardarPendentes();
  });

  test('15. Com flags desligadas (padrão), nenhum chunk é criado', async () => {
    process.env.AGENTE_IA_ENABLED = 'false';
    process.env.AGENTE_RAG_ENABLED = 'false';

    const res = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${professor.token}`)
      .send({
        titulo: 'Artigo com RAG desligado',
        resumo: 'Resumo com flags off',
        conteudo: 'Nenhum chunk deve ser gerado pelo hook.',
        tipo: 'noticia_escolar',
      });
    expect(res.status).toBe(201);

    await aguardarPendentes();
    const count = await AgentChunk.count({ where: { sourceType: 'artigo', sourceId: res.body.id } });
    expect(count).toBe(0);
  });
});

