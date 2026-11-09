require('../setup');
const { responder } = require('../../src/services/agenteService');
const { Article, Campaign, Category } = require('../../src/models');

const fetchOriginal = global.fetch;

describe('Regressão de agenteService com provedor Groq e busca', () => {
  const envOriginal = { ...process.env };

  beforeAll(async () => {
    // Popula o SQLite com dados públicos e não públicos
    const cat = await Category.create({ nome: 'Tecnologia da Informação' });
    await Article.create({
      titulo: 'Sistemas Embarcados com Arduino no IF',
      resumo: 'Oficina de hardware livre',
      conteudo: 'Aprenda eletrônica básica e sistemas embarcados no IFConnect.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      categoryId: cat.id,
    });
    await Article.create({
      titulo: 'Rascunho de Embarcados não publicado',
      resumo: 'Rascunho secreto',
      conteudo: 'Conteúdo em revisão',
      tipo: 'noticia_escolar',
      status: 'em_revisao',
      categoryId: cat.id,
    });
    await Campaign.create({
      titulo: 'Laboratório de Robótica Educacional',
      descricao: 'Campanha para aquisição de kits de robótica e arduinos.',
      status: 'ativa',
      metaFinanceira: 1000,
      valorArrecadado: 200,
      categoryId: cat.id,
    });
  });

  beforeEach(() => {
    process.env = { ...envOriginal };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  test('com AGENTE_IA_PROVIDER=groq e chave válida, responder() usa o LLM e retorna modo "ia"', async () => {
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_IA_PROVIDER = 'groq';
    process.env.AGENTE_IA_API_KEY = 'gsk_teste123';
    process.env.AGENTE_IA_MODEL = 'llama-3.3-70b-versatile';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Temos oficinas de arduino e campanha de robótica no portal.',
            },
          },
        ],
      }),
    });

    const resultado = await responder('Quais projetos existem sobre arduino?');

    expect(resultado.modo).toBe('ia');
    expect(resultado.resposta).toBe('Temos oficinas de arduino e campanha de robótica no portal.');
    expect(resultado.fontes.length).toBeGreaterThan(0);
    expect(resultado.fontes.some((f) => f.titulo.includes('Arduino'))).toBe(true);

    // Garante que o fetch foi chamado para o endpoint da Groq
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opt] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(opt.headers.authorization).toBe('Bearer gsk_teste123');
  });

  test('sem chave configurada, responder() entra no modo "busca" sem chamar o LLM', async () => {
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_IA_PROVIDER = 'groq';
    delete process.env.AGENTE_IA_API_KEY;

    const resultado = await responder('Quais projetos existem sobre arduino?');

    expect(resultado.modo).toBe('busca');
    expect(resultado.resposta).toContain('Encontrei estes conteúdos publicados');
    expect(resultado.fontes.length).toBeGreaterThan(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

