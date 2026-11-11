const request = require('supertest');
require('../setup');
const app = require('../../src/app');
const { Article, AgentChunk } = require('../../src/models');
const { criarProfessor } = require('../helpers');
const { semearChunk, criarProvider } = require('./_fixtures');
const { invalidarIndice } = require('../../src/services/agente/retrieval/indice');
const { limparCache } = require('../../src/services/agente/ingest/embedder');

const envOriginal = { ...process.env };
const fetchOriginal = global.fetch;

describe('Rotas do Agente — /api/agente/* (T13)', () => {
  let professor;
  let provider;

  beforeAll(async () => {
    professor = await criarProfessor({ email: 'professor.rota@ifsp.edu.br' });
    provider = criarProvider();
  });

  beforeEach(async () => {
    process.env = { ...envOriginal };
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_RAG_ENABLED = 'false';
    process.env.AGENTE_IA_API_KEY = '';
    process.env.AGENTE_IA_RATE_LIMIT = '50';
    process.env.TRUST_PROXY = '';
    global.fetch = jest.fn();

    await AgentChunk.destroy({ where: {} });
    invalidarIndice();
    limparCache();
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  test('1. CA-13: AGENTE_IA_ENABLED != "true" -> POST /consulta = 503; GET /api/saude continua 200; nenhum fetch chamado', async () => {
    process.env.AGENTE_IA_ENABLED = 'false';

    const resConsulta = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'Tem algo sobre robótica?' });

    expect(resConsulta.status).toBe(503);
    expect(resConsulta.body).toEqual({
      erro: true,
      mensagem: 'O assistente está temporariamente indisponível.',
    });
    expect(global.fetch).not.toHaveBeenCalled();

    const resSaude = await request(app).get('/api/saude');
    expect(resSaude.status).toBe(200);
  });

  test('2. CA-11: validação da pergunta (ausente, vazia, 1 char, 501 chars, tipos inválidos -> 400; 2 chars -> 200)', async () => {
    const invalidos = [
      {},
      { pergunta: '' },
      { pergunta: '   ' },
      { pergunta: 'a' },
      { pergunta: 'x'.repeat(501) },
      { pergunta: 12345 },
      { pergunta: { texto: 'oi' } },
      { pergunta: ['oi'] },
    ];

    for (const payload of invalidos) {
      const res = await request(app).post('/api/agente/consulta').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.erro).toBe(true);
      expect(typeof res.body.mensagem).toBe('string');
      expect(res.body.mensagem.length).toBeGreaterThan(0);
    }

    const resValida = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'ok' });
    expect(resValida.status).toBe(200);
  });

  test('3. CA-12: AGENTE_IA_RATE_LIMIT=3 -> 3x 200 e 4ª = 429; valor inválido ("abc") cai no padrão 10', async () => {
    // Primeiro subcaso: AGENTE_IA_RATE_LIMIT=3
    jest.resetModules();
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_IA_RATE_LIMIT = '3';
    process.env.AGENTE_RAG_ENABLED = 'false';
    const appLim3 = require('../../src/app');
    const { sequelize: seqLim3 } = require('../../src/models');
    await seqLim3.sync({ force: true });

    try {
      for (let i = 0; i < 3; i++) {
        const res = await request(appLim3)
          .post('/api/agente/consulta')
          .send({ pergunta: 'Pergunta de teste' });
        expect(res.status).toBe(200);
      }

      const res429 = await request(appLim3)
        .post('/api/agente/consulta')
        .send({ pergunta: 'Quarta pergunta' });
      expect(res429.status).toBe(429);
      expect(res429.body).toEqual({
        erro: true,
        mensagem: 'Muitas perguntas em pouco tempo. Aguarde um instante.',
      });
    } finally {
      await seqLim3.close();
    }

    // Segundo subcaso: valor inválido ('abc') cai no padrão 10
    jest.resetModules();
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_IA_RATE_LIMIT = 'abc';
    process.env.AGENTE_RAG_ENABLED = 'false';
    const appPadrao = require('../../src/app');
    const { sequelize: seqPadrao } = require('../../src/models');
    await seqPadrao.sync({ force: true });

    try {
      for (let i = 0; i < 10; i++) {
        const res = await request(appPadrao)
          .post('/api/agente/consulta')
          .send({ pergunta: 'Pergunta padrão' });
        expect(res.status).toBe(200);
      }

      const res11 = await request(appPadrao)
        .post('/api/agente/consulta')
        .send({ pergunta: 'Décima primeira pergunta' });
      expect(res11.status).toBe(429);
    } finally {
      await seqPadrao.close();
    }
  });

  test('4. GET /api/agente/status: reflete flag sem autenticação e sem consumir o limite da consulta', async () => {
    jest.resetModules();
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_IA_RATE_LIMIT = '2';
    process.env.AGENTE_IA_API_KEY = '';
    process.env.AGENTE_RAG_ENABLED = 'false';

    const appStatus = require('../../src/app');
    const { sequelize: seqStatus } = require('../../src/models');
    await seqStatus.sync({ force: true });

    try {
      for (let i = 0; i < 20; i++) {
        const res = await request(appStatus).get('/api/agente/status');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ habilitado: true });
      }

      process.env.AGENTE_IA_ENABLED = 'false';
      const resDesligado = await request(appStatus).get('/api/agente/status');
      expect(resDesligado.status).toBe(200);
      expect(resDesligado.body).toEqual({ habilitado: false });

      // Ainda consegue consultar até o limite (2x) após 21 chamadas a /status
      process.env.AGENTE_IA_ENABLED = 'true';
      for (let i = 0; i < 2; i++) {
        const resConsulta = await request(appStatus)
          .post('/api/agente/consulta')
          .send({ pergunta: 'Consulta após status' });
        expect(resConsulta.status).toBe(200);
      }
      const res3 = await request(appStatus)
        .post('/api/agente/consulta')
        .send({ pergunta: 'Terceira consulta' });
      expect(res3.status).toBe(429);
    } finally {
      await seqStatus.close();
    }
  });

  test('5. Com AGENTE_RAG_ENABLED=true e embedding "mock": POST /consulta devolve { resposta, fontes, modo } 200', async () => {
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_RAG_ENABLED = 'true';
    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'mock';
    process.env.AGENTE_IA_PROVIDER = 'groq';
    process.env.AGENTE_IA_API_KEY = 'chave-teste';

    const artigo = await Article.create({
      titulo: 'Foguete de Garrafa PET',
      resumo: 'Oficina de física aplicada.',
      conteudo: 'Lançamento oblíquo e pressão hidrostática.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
    });
    await semearChunk({
      sourceId: artigo.id,
      texto: 'Título: Foguete de Garrafa PET\nLançamento oblíquo e pressão hidrostática.',
      provider,
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'A oficina aborda lançamento oblíquo [1].' } }],
      }),
    });

    const res = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'Como funciona o foguete?' });

    expect(res.status).toBe(200);
    expect(res.body.modo).toBe('rag');
    expect(res.body.resposta).toBe('A oficina aborda lançamento oblíquo [1].');
    expect(Array.isArray(res.body.fontes)).toBe(true);
    expect(res.body.fontes).toHaveLength(1);
    expect(res.body.fontes[0].id).toBe(artigo.id);
  });

  test('6. TRUST_PROXY=1: rate limit contabiliza por IP de X-Forwarded-For', async () => {
    jest.resetModules();
    process.env.TRUST_PROXY = '1';
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_IA_RATE_LIMIT = '2';
    process.env.AGENTE_RAG_ENABLED = 'false';

    const appProxy = require('../../src/app');
    const { sequelize: seqProxy } = require('../../src/models');
    await seqProxy.sync({ force: true });

    try {
      // IP A faz 2 requisições -> 200; 3ª -> 429
      for (let i = 0; i < 2; i++) {
        const resA = await request(appProxy)
          .post('/api/agente/consulta')
          .set('X-Forwarded-For', '203.0.113.10')
          .send({ pergunta: 'Pergunta do IP A' });
        expect(resA.status).toBe(200);
      }
      const resA3 = await request(appProxy)
        .post('/api/agente/consulta')
        .set('X-Forwarded-For', '203.0.113.10')
        .send({ pergunta: 'Terceira do IP A' });
      expect(resA3.status).toBe(429);

      // IP B ainda consegue fazer requisição -> 200 (não compartilha contagem com IP A)
      const resB = await request(appProxy)
        .post('/api/agente/consulta')
        .set('X-Forwarded-For', '203.0.113.20')
        .send({ pergunta: 'Pergunta do IP B' });
      expect(resB.status).toBe(200);
    } finally {
      await seqProxy.close();
    }
  });
});
