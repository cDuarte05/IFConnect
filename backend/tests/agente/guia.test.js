require('../setup');
const request = require('supertest');
const app = require('../../src/app');
const { criarProfessor } = require('../helpers');
const { LIMITES } = require('../../src/config/limites');
const {
  GUIA_VERSAO,
  GUIA_SECOES,
  formatarSecao,
  formatarSecoes,
  selecionarGuia,
} = require('../../src/services/agente/generation/guia');
const { SYSTEM_PROMPT_RAG } = require('../../src/services/agente/generation/prompt');
const { ehPerguntaDeNavegacao } = require('../../src/services/agente/generation/intencao');
const { consultarRag } = require('../../src/services/agente/ragService');

const fetchOriginal = global.fetch;
const envOriginal = { ...process.env };

const respostaGroq = (content) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});

const corpoLlmDe = (opt) => {
  const parsed = JSON.parse(opt.body);
  const msgUser = parsed.messages.find((m) => m.role === 'user').content;
  const matchGuia = msgUser.match(/<guia>([\s\S]*?)<\/guia>/);
  return {
    mensagemCompleta: msgUser,
    guiaEnviado: matchGuia ? matchGuia[1] : '',
  };
};

describe('Guia do Portal IFConnect — V3-A', () => {
  beforeEach(() => {
    process.env = { ...envOriginal };
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_IA_PROVIDER = 'groq';
    process.env.AGENTE_IA_API_KEY = 'chave-teste-groq';
    process.env.AGENTE_RAG_ENABLED = 'true';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  test('estrutura e versão exportada', () => {
    expect(GUIA_VERSAO).toBe(1);
    expect(Array.isArray(GUIA_SECOES)).toBe(true);
    expect(GUIA_SECOES).toHaveLength(7);
    const idsEsperados = ['conta', 'publicar', 'projeto', 'apoiar', 'buscar', 'editar', 'acompanhar'];
    expect(GUIA_SECOES.map((s) => s.id)).toEqual(idsEsperados);

    for (const secao of GUIA_SECOES) {
      expect(typeof secao.id).toBe('string');
      expect(typeof secao.titulo).toBe('string');
      expect(Array.isArray(secao.palavras)).toBe(true);
      expect(secao.palavras.length).toBeGreaterThan(0);
      expect(Array.isArray(secao.perguntasExemplo)).toBe(true);
      expect(secao.perguntasExemplo.length).toBeGreaterThanOrEqual(3);
      expect(secao.perguntasExemplo.length).toBeLessThanOrEqual(5);
      expect(Array.isArray(secao.passos)).toBe(true);
      expect(secao.passos.length).toBeGreaterThan(0);
      expect(secao.passos.length).toBeLessThanOrEqual(8);
      expect(Array.isArray(secao.observacoes)).toBe(true);
      expect(secao.observacoes.length).toBeGreaterThan(0);
    }
  });

  describe('a) CONTRATO (CA-19): limites.js como fonte única de verdade', () => {
    test('para cada limite numérico e lista de limites.js, o texto do guia o contém', () => {
      const textoCompleto = formatarSecoes(GUIA_SECOES);

      // Limites numéricos essenciais
      const chavesNumericas = [
        'TITULO_MIN',
        'TITULO_MAX',
        'RESUMO_MAX',
        'CONTEUDO_MAX',
        'DESCRICAO_MAX',
        'PALAVRAS_CHAVE_MAX',
        'IMAGEM_MAX',
        'MENSAGEM_APOIO_MAX',
        'SENHA_MIN',
        'SENHA_MAX',
        'NOME_MIN',
        'NOME_MAX',
        'EMAIL_MAX',
        'INSTITUICAO_MAX',
        'BIO_MAX',
      ];

      for (const chave of chavesNumericas) {
        const valor = LIMITES[chave];
        expect(valor).toBeDefined();
        expect(textoCompleto).toContain(String(valor));
      }

      // Tipos de publicação válidos
      for (const tipo of LIMITES.TIPOS_ARTIGO) {
        expect(textoCompleto).toContain(tipo);
      }

      // Temas válidos
      for (const tema of LIMITES.TEMAS) {
        expect(textoCompleto).toContain(tema);
      }
    });

    test('validações reais das rotas usam limites.js e falham se divergirem do texto do guia', async () => {
      const textoCompleto = formatarSecoes(GUIA_SECOES);
      const { token } = await criarProfessor();

      // 1. Rota auth: rejeita nome menor que NOME_MIN e mensagem bate com limites.js e com o guia
      const resNomeCurto = await request(app)
        .post('/api/auth/registrar')
        .send({ nome: 'A', email: 'aluno.contrato@ifsp.edu.br', senha: 'senhaValida123' });
      expect(resNomeCurto.status).toBe(400);
      expect(resNomeCurto.body.mensagem).toBe(`Nome deve ter entre ${LIMITES.NOME_MIN} e ${LIMITES.NOME_MAX} caracteres`);
      expect(textoCompleto).toContain(String(LIMITES.NOME_MIN));
      expect(textoCompleto).toContain(String(LIMITES.NOME_MAX));

      // 2. Rota auth: rejeita senha menor que SENHA_MIN e mensagem bate com limites.js e com o guia
      const resSenhaCurta = await request(app)
        .post('/api/auth/registrar')
        .send({ nome: 'Aluno Valido', email: 'aluno.senha@ifsp.edu.br', senha: '123' });
      expect(resSenhaCurta.status).toBe(400);
      expect(resSenhaCurta.body.mensagem).toBe(`Senha deve ter entre ${LIMITES.SENHA_MIN} e ${LIMITES.SENHA_MAX} caracteres`);
      expect(textoCompleto).toContain(String(LIMITES.SENHA_MIN));
      expect(textoCompleto).toContain(String(LIMITES.SENHA_MAX));

      // 3. Rota artigo: rejeita título menor que TITULO_MIN e mensagem bate com limites.js e com o guia
      const resArtigoCurto = await request(app)
        .post('/api/artigos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          titulo: 'Curto',
          resumo: 'Resumo válido do artigo de teste para validação',
          conteudo: 'Conteúdo completo do artigo de teste para validação de limites',
          tipo: 'noticia_escolar',
        });
      expect(resArtigoCurto.status).toBe(400);
      expect(resArtigoCurto.body.mensagem).toBe(`Título deve ter entre ${LIMITES.TITULO_MIN} e ${LIMITES.TITULO_MAX} caracteres`);
      expect(textoCompleto).toContain(String(LIMITES.TITULO_MIN));
      expect(textoCompleto).toContain(String(LIMITES.TITULO_MAX));

      // 4. Rota campanha: rejeita título menor que TITULO_MIN e mensagem bate com limites.js e com o guia
      const resCampanhaCurta = await request(app)
        .post('/api/campanhas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          titulo: 'Curto',
          descricao: 'Descrição válida do projeto de teste para validação de limites',
          metaFinanceira: 500,
        });
      expect(resCampanhaCurta.status).toBe(400);
      expect(resCampanhaCurta.body.mensagem).toBe(`Título deve ter entre ${LIMITES.TITULO_MIN} e ${LIMITES.TITULO_MAX} caracteres`);

      // 5. Se o guia divergisse da rota (ex: se o guia tivesse um valor diferente de limites.js), a asserção falharia
      expect(textoCompleto.includes(`título (${LIMITES.TITULO_MIN} a ${LIMITES.TITULO_MAX} caracteres)`)).toBe(true);
    });

    test('divergência entre limites.js e texto do guia faz o contrato falhar', () => {
      // Simula uma alteração em limites.js não refletida em um guia estático
      const limitesAlterados = { ...LIMITES, TITULO_MAX: 999 };
      const textoAtual = formatarSecoes(GUIA_SECOES);
      expect(textoAtual.includes(String(limitesAlterados.TITULO_MAX))).toBe(false);
    });
  });

  describe('b) 15+ perguntas de uso (3 por seção principal): com fetch mockado e com fallback sem LLM', () => {
    const perguntasPorSecao = [
      // 1. Conta
      { pergunta: 'Como criar uma conta no portal?', secaoId: 'conta', titulo: 'Criar conta e entrar' },
      { pergunta: 'Como faço login na minha conta do IFConnect?', secaoId: 'conta', titulo: 'Criar conta e entrar' },
      { pergunta: 'Quais os requisitos de senha e email para registrar?', secaoId: 'conta', titulo: 'Criar conta e entrar' },

      // 2. Publicar
      { pergunta: 'Como publicar um artigo ou notícia no portal?', secaoId: 'publicar', titulo: 'Publicar artigos e notícias' },
      { pergunta: 'Como enviar um texto para revisão de publicação?', secaoId: 'publicar', titulo: 'Publicar artigos e notícias' },
      { pergunta: 'Qual o limite de caracteres para o conteúdo da publicação?', secaoId: 'publicar', titulo: 'Publicar artigos e notícias' },

      // 3. Projeto
      { pergunta: 'Como cadastrar um projeto na vitrine científica?', secaoId: 'projeto', titulo: 'Cadastrar projeto na vitrine científica' },
      { pergunta: 'Como criar uma campanha de arrecadação para projeto?', secaoId: 'projeto', titulo: 'Cadastrar projeto na vitrine científica' },
      { pergunta: 'Como divulgar meu projeto para apoio da comunidade?', secaoId: 'projeto', titulo: 'Cadastrar projeto na vitrine científica' },

      // 4. Apoiar
      { pergunta: 'Como apoiar um projeto ativo na vitrine?', secaoId: 'apoiar', titulo: 'Apoiar projetos da vitrine' },
      { pergunta: 'Como doar para uma campanha na vitrine?', secaoId: 'apoiar', titulo: 'Apoiar projetos da vitrine' },
      { pergunta: 'Posso enviar uma mensagem de apoio junto com a contribuição?', secaoId: 'apoiar', titulo: 'Apoiar projetos da vitrine' },

      // 5. Buscar
      { pergunta: 'Como buscar artigos e publicações no portal?', secaoId: 'buscar', titulo: 'Buscar publicações e projetos' },
      { pergunta: 'Como encontrar projetos na vitrine científica?', secaoId: 'buscar', titulo: 'Buscar publicações e projetos' },
      { pergunta: 'Como filtrar publicações por tema e categoria?', secaoId: 'buscar', titulo: 'Buscar publicações e projetos' },

      // 6. Editar
      { pergunta: 'Como editar uma publicação pendente?', secaoId: 'editar', titulo: 'Editar publicações e projetos' },
      { pergunta: 'Quando posso alterar um projeto já cadastrado?', secaoId: 'editar', titulo: 'Editar publicações e projetos' },
      { pergunta: 'Como atualizar meus dados de perfil e bio?', secaoId: 'editar', titulo: 'Editar publicações e projetos' },

      // 7. Acompanhar
      { pergunta: 'Onde vejo o status da minha publicação?', secaoId: 'acompanhar', titulo: 'Acompanhar status e publicações' },
      { pergunta: 'Como acompanhar a análise do meu projeto?', secaoId: 'acompanhar', titulo: 'Acompanhar status e publicações' },
      { pergunta: 'Onde vejo a situação das minhas campanhas cadastradas?', secaoId: 'acompanhar', titulo: 'Acompanhar status e publicações' },
    ];

    test('garante que há ao menos 15 perguntas (3 por seção principal)', () => {
      expect(perguntasPorSecao.length).toBeGreaterThanOrEqual(15);
    });

    for (const { pergunta, secaoId, titulo } of perguntasPorSecao) {
      test(`[${secaoId}] "${pergunta}" com fetch mockado envia <guia> e a seção certa`, async () => {
        global.fetch.mockResolvedValue(respostaGroq(`Resposta orientativa sobre ${secaoId}.`));

        const resultado = await consultarRag(pergunta, {
          recuperarFn: async () => ({ fontes: [] }),
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const opt = global.fetch.mock.calls[0][1];
        const { mensagemCompleta, guiaEnviado } = corpoLlmDe(opt);

        expect(mensagemCompleta).toContain('<guia>');
        expect(mensagemCompleta).toContain('</guia>');
        expect(mensagemCompleta.indexOf('<guia>')).toBeLessThan(mensagemCompleta.indexOf('<contexto>'));
        expect(guiaEnviado).toContain(titulo);

        expect(resultado.modo).toBe('rag');
        expect(resultado.resposta).toBe(`Resposta orientativa sobre ${secaoId}.`);
      });

      test(`[${secaoId}] "${pergunta}" sem LLM devolve o guia daquela seção em modo "busca"`, async () => {
        delete process.env.AGENTE_IA_API_KEY;

        const resultado = await consultarRag(pergunta, {
          recuperarFn: async () => ({ fontes: [] }),
        });

        expect(global.fetch).not.toHaveBeenCalled();
        expect(resultado.modo).toBe('busca');
        expect(resultado.resposta).toContain(titulo);
        expect(resultado.fontes).toEqual([]);
      });
    }
  });

  describe('c) dúvida fora do guia ("como mudo a cor do site?")', () => {
    test('o SYSTEM_PROMPT_RAG contém a regra "não tem essa informação"', () => {
      expect(SYSTEM_PROMPT_RAG).toContain(
        'Para dúvidas de COMO USAR o portal, responda SOMENTE com o <guia>. Se a dúvida não estiver no guia, diga que não tem essa informação; não invente telas, botões ou prazos'
      );
    });

    test('pergunta fora do guia não seleciona seções indevidas', () => {
      const selecao = selecionarGuia('como mudo a cor do site?');
      expect(selecao.texto).toBe('');
      expect(selecao.ids).toEqual([]);
    });
  });

  describe('d) segurança e formatação do guia', () => {
    test('o guia não contém "<" ou ">" fora dos delimitadores XML', () => {
      const textoCompleto = formatarSecoes(GUIA_SECOES);
      expect(textoCompleto).not.toContain('<');
      expect(textoCompleto).not.toContain('>');
    });

    test('o guia não contém nenhum e-mail', () => {
      const textoCompleto = formatarSecoes(GUIA_SECOES);
      const regexEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      expect(regexEmail.test(textoCompleto)).toBe(false);
      expect(textoCompleto).not.toContain('@');
    });

    test('o guia não contém nomes de usuários reais ou simulados', () => {
      const textoCompleto = formatarSecoes(GUIA_SECOES);
      expect(textoCompleto).not.toContain('usuario@');
      expect(textoCompleto).not.toContain('professora');
      expect(textoCompleto).not.toContain('admin');
    });
  });

  describe('e) intencao.js e navegação sem correspondência', () => {
    test('ehPerguntaDeNavegacao reconhece as ações e palavras requeridas', () => {
      const termos = [
        'criar',
        'escrever',
        'publicar',
        'cadastrar',
        'inscrever',
        'enviar',
        'apoiar',
        'doar',
        'editar',
        'entrar',
        'conta',
        'senha',
        'acompanhar',
        'status',
      ];
      for (const t of termos) {
        expect(ehPerguntaDeNavegacao(`Quero saber sobre ${t}`)).toBe(true);
      }
    });

    test('falsos positivos continuam proibidos', () => {
      expect(ehPerguntaDeNavegacao('campeonato de futebol')).toBe(false);
      expect(ehPerguntaDeNavegacao('receita de bolo')).toBe(false);
      expect(ehPerguntaDeNavegacao('robótica')).toBe(false);
      expect(ehPerguntaDeNavegacao('como mudo a cor do site?')).toBe(false);
    });

    test('pergunta de navegação sem correspondência direta retorna seções publicar + buscar', () => {
      const selecao = selecionarGuia('como posso navegar pelas opções?');
      expect(selecao.ids).toEqual(['publicar', 'buscar']);
      expect(selecao.texto).toContain('Publicar artigos e notícias');
      expect(selecao.texto).toContain('Buscar publicações e projetos');
    });
  });
});
