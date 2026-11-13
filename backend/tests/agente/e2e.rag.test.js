const request = require('supertest');
require('../setup');
const app = require('../../src/app');
const { AgentChunk } = require('../../src/models');
const { criarProfessor } = require('../helpers');
const { aguardarPendentes } = require('../../src/services/agente/ingest/indexer');
const { invalidarIndice } = require('../../src/services/agente/retrieval/indice');
const { limparCache } = require('../../src/services/agente/ingest/embedder');

const envOriginal = { ...process.env };
const fetchOriginal = global.fetch;

const respostaGroqFixa = () => ({
  ok: true,
  status: 200,
  json: async () => ({
    choices: [{ message: { content: 'Encontrei informações relevantes sobre isso [1].' } }],
  }),
});

const contextoEnviadoAoLlm = (chamadaIndex = 0) => {
  const [, opt] = global.fetch.mock.calls[chamadaIndex];
  const msgUser = JSON.parse(opt.body).messages.find((m) => m.role === 'user').content;
  const match = msgUser.match(/<contexto>([\s\S]*)<\/contexto>/);
  return JSON.parse(match[1]);
};

describe('E2E RAG — Ciclo de vida completo via HTTP (T16)', () => {
  let professor;
  let estudanteToken;
  let artigoId;
  let campanhaId;

  const tituloArtigo = 'Experimento zyxquark de óptica aplicada';
  const tituloCampanha = 'Laboratório wombatflux de energia limpa';

  beforeAll(async () => {
    professor = await criarProfessor({
      nome: 'Professora E2E',
      email: 'professor.e2e@ifsp.edu.br',
    });

    const resEstudante = await request(app).post('/api/auth/registrar').send({
      nome: 'Estudante E2E',
      email: 'estudante.e2e@ifsp.edu.br',
      senha: 'senhaEstudante123',
      tipo: 'estudante',
    });
    expect(resEstudante.status).toBe(201);
    estudanteToken = resEstudante.body.token;
  });

  beforeEach(() => {
    process.env = { ...envOriginal };
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_RAG_ENABLED = 'true';
    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'mock';
    process.env.AGENTE_IA_PROVIDER = 'groq';
    process.env.AGENTE_IA_API_KEY = 'chave-falsa-e2e-groq';
    process.env.AGENTE_IA_RATE_LIMIT = '100';
    delete process.env.AGENTE_RAG_MIN_SCORE;

    global.fetch = jest.fn().mockImplementation(async () => respostaGroqFixa());
    invalidarIndice();
    limparCache();
  });

  afterEach(async () => {
    await aguardarPendentes();
    global.fetch = fetchOriginal;
  });

  afterAll(async () => {
    await aguardarPendentes();
    process.env = envOriginal;
    global.fetch = fetchOriginal;
  });

  test('1. estudante cria artigo com termo único ("zyxquark") -> em_revisao não aparece em fontes nem no corpo enviado ao fetch (CA-01)', async () => {
    const resCriar = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${estudanteToken}`)
      .send({
        titulo: tituloArtigo,
        resumo: 'Resumo sobre zyxquark.',
        conteudo: 'Conteúdo detalhado de pesquisa com zyxquark em laboratório.',
        tipo: 'artigo_cientifico',
      });

    expect(resCriar.status).toBe(201);
    expect(resCriar.body.status).toBe('em_revisao');
    artigoId = resCriar.body.id;

    await aguardarPendentes();

    const resConsulta = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'O que há sobre zyxquark?' });

    expect(resConsulta.status).toBe(200);
    expect(resConsulta.body.fontes.map((f) => f.id)).not.toContain(artigoId);
    expect(resConsulta.body.fontes).toEqual([]);
    expect(JSON.stringify(resConsulta.body)).not.toContain(tituloArtigo);
    for (const [, opt] of global.fetch.mock.calls) {
      expect(opt.body).not.toContain(tituloArtigo);
    }
  });

  test('2. professor aprova o artigo -> mesma pergunta retorna o artigo em fontes com url /publicacoes/:id', async () => {
    const resModerar = await request(app)
      .patch(`/api/artigos/${artigoId}/moderar`)
      .set('Authorization', `Bearer ${professor.token}`)
      .send({ status: 'publicado' });

    expect(resModerar.status).toBe(200);
    expect(resModerar.body.status).toBe('publicado');

    await aguardarPendentes();

    const resConsulta = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'O que há sobre zyxquark?' });

    expect(resConsulta.status).toBe(200);
    expect(resConsulta.body.modo).toBe('rag');
    expect(resConsulta.body.fontes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipo: 'publicacao',
          id: artigoId,
          titulo: tituloArtigo,
          url: `/publicacoes/${artigoId}`,
        }),
      ])
    );
  });

  test('3. professor recusa o artigo -> some das fontes e agente_chunks não tem mais chunks dele (CA-04)', async () => {
    const resRecusar = await request(app)
      .patch(`/api/artigos/${artigoId}/moderar`)
      .set('Authorization', `Bearer ${professor.token}`)
      .send({ status: 'recusado' });

    expect(resRecusar.status).toBe(200);
    expect(resRecusar.body.status).toBe('recusado');

    await aguardarPendentes();

    const chunksRestantes = await AgentChunk.count({
      where: { sourceType: 'artigo', sourceId: artigoId },
    });
    expect(chunksRestantes).toBe(0);

    const resConsulta = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'O que há sobre zyxquark?' });

    expect(resConsulta.status).toBe(200);
    expect(resConsulta.body.fontes.map((f) => f.id)).not.toContain(artigoId);
    expect(resConsulta.body.fontes).toEqual([]);
  });

  test('4. campanha: em_analise não aparece -> ativa aparece -> doação para financiada reflete arrecadado atualizado (CA-15) -> encerrar remove', async () => {
    // 4a. Criar campanha -> em_analise
    const resCriar = await request(app)
      .post('/api/campanhas')
      .set('Authorization', `Bearer ${estudanteToken}`)
      .send({
        titulo: tituloCampanha,
        descricao: 'Projeto comunitário usando wombatflux para geração sustentável.',
        tema: 'cientifico',
        metaFinanceira: 500,
      });

    expect(resCriar.status).toBe(201);
    expect(resCriar.body.status).toBe('em_analise');
    campanhaId = resCriar.body.id;

    await aguardarPendentes();

    const resAnalise = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'Tem projeto sobre wombatflux?' });
    expect(resAnalise.status).toBe(200);
    expect(resAnalise.body.fontes).toEqual([]);

    // 4b. Aprovar ('ativa') -> aparece
    const resAprovar = await request(app)
      .patch(`/api/campanhas/${campanhaId}/moderar`)
      .set('Authorization', `Bearer ${professor.token}`)
      .send({ status: 'ativa' });
    expect(resAprovar.status).toBe(200);

    await aguardarPendentes();

    const resAtiva = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'Tem projeto sobre wombatflux?' });
    expect(resAtiva.status).toBe(200);
    expect(resAtiva.body.modo).toBe('rag');
    expect(resAtiva.body.fontes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipo: 'projeto',
          id: campanhaId,
          titulo: tituloCampanha,
          url: `/vitrine/${campanhaId}`,
        }),
      ])
    );

    // 4c. Doação que leva a 'financiada' -> continua aparecendo com arrecadado atualizado no contexto do LLM (CA-15)
    global.fetch.mockClear();
    const resDoacao = await request(app)
      .post(`/api/doacoes/${campanhaId}`)
      .set('Authorization', `Bearer ${estudanteToken}`)
      .send({ valor: 500, mensagemApoio: 'Apoio total ao laboratório!' });
    expect(resDoacao.status).toBe(201);

    const resFinanciada = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'Tem projeto sobre wombatflux?' });

    expect(resFinanciada.status).toBe(200);
    expect(resFinanciada.body.modo).toBe('rag');
    expect(resFinanciada.body.fontes.map((f) => f.id)).toContain(campanhaId);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const contexto = contextoEnviadoAoLlm(0);
    expect(contexto.fontes[0]).toMatchObject({
      tipo: 'projeto',
      titulo: tituloCampanha,
      status: 'financiada',
      meta: 500,
      arrecadado: 500,
    });

    // 4d. Encerrar -> remove das fontes e limpa agente_chunks
    const resEncerrar = await request(app)
      .patch(`/api/campanhas/${campanhaId}/moderar`)
      .set('Authorization', `Bearer ${professor.token}`)
      .send({ status: 'encerrada' });
    expect(resEncerrar.status).toBe(200);

    await aguardarPendentes();

    expect(
      await AgentChunk.count({ where: { sourceType: 'campanha', sourceId: campanhaId } })
    ).toBe(0);

    const resEncerrada = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'Tem projeto sobre wombatflux?' });
    expect(resEncerrada.status).toBe(200);
    expect(resEncerrada.body.fontes).toEqual([]);
  });

  test('5. provedor de LLM retornando erro (fetch rejeitado) mantém status 200 e modo "busca" (CA-06)', async () => {
    const resArtigo = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${professor.token}`)
      .send({
        titulo: 'Pesquisa de fotônica integrada quasarx',
        resumo: 'Resumo sobre fotônica quasarx.',
        conteudo: 'Conteúdo publicado sobre fotônica quasarx para teste de fallback.',
        tipo: 'noticia_escolar',
      });
    expect(resArtigo.status).toBe(201);

    await aguardarPendentes();

    global.fetch.mockRejectedValueOnce(new Error('Falha de rede ou timeout do LLM'));

    const resConsulta = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'Existe conteúdo sobre quasarx?' });

    expect(resConsulta.status).toBe(200);
    expect(resConsulta.body.modo).toBe('busca');
    expect(resConsulta.body.fontes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: resArtigo.body.id,
          url: `/publicacoes/${resArtigo.body.id}`,
        }),
      ])
    );
  });

  test('6. rota com AGENTE_IA_ENABLED=false responde 503 sem chamar provedor (CA-13)', async () => {
    process.env.AGENTE_IA_ENABLED = 'false';

    const res = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'Tem projeto sobre quasarx?' });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      erro: true,
      mensagem: 'O assistente está temporariamente indisponível.',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

