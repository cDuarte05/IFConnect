const request = require('supertest');
require('../setup');
const app = require('../../src/app');
const { Article, AgentChunk } = require('../../src/models');
const { criarProfessor } = require('../helpers');
const { semearChunk, criarProvider } = require('./_fixtures');
const { invalidarIndice } = require('../../src/services/agente/retrieval/indice');
const { limparCache } = require('../../src/services/agente/ingest/embedder');
const { limparTexto } = require('../../src/services/agente/generation/textoSimples');
const { SYSTEM_PROMPT_RAG } = require('../../src/services/agente/generation/prompt');
const { GUIA_SECOES, formatarSecoes } = require('../../src/services/agente/generation/guia');
const { responder } = require('../../src/services/agenteService');
const { consultarRag } = require('../../src/services/agente/ragService');

describe('limparTexto — normalização pura para texto simples (generation/textoSimples.js)', () => {
  const casos = [
    // Ênfase e citações
    ['negrito com asteriscos duplos', '**Olá** mundo', 'Olá mundo'],
    ['itálico com asterisco simples preservando [1]', 'Veja *este* projeto [1]', 'Veja este projeto [1]'],
    ['citação envolta em negrito **[1]**', '**[1]**', '[1]'],
    ['citação múltipla [1, 2] intacta', 'Fontes confirmadas [1, 2].', 'Fontes confirmadas [1, 2].'],
    ['negrito com sublinhados duplos __x__', 'Texto __importante__ aqui', 'Texto importante aqui'],
    ['itálico com sublinhado simples _x_ e 1 caractere', 'Item _x_ e *y* no texto (_nota_)', 'Item x e y no texto (nota)'],
    ['negrito + itálico combinados ***x***', 'Destaque ***muito forte***!', 'Destaque muito forte!'],

    // Links e imagens Markdown
    ['link Markdown [texto](url)', 'Acesse o [site](https://x.com) oficial', 'Acesse o site oficial'],
    ['link Markdown ao lado de citação [1]', 'Veja [1] no [portal](https://if.edu.br)', 'Veja [1] no portal'],
    ['imagem Markdown ![alt](url) e link vazio', '![Gráfico solar](https://x.com/g.png) [](https://x.com)', 'Gráfico solar'],

    // Títulos, citações em bloco e linhas horizontais
    ['título # no início da linha', '# Título\ntexto', 'Título\ntexto'],
    ['título ###### nível 6 com indentação', '  ###### Subtítulo seis\nCorpo', 'Subtítulo seis\nCorpo'],
    ['sete cerquilhas não são título Markdown', '####### Não é título', '####### Não é título'],
    ['citação em bloco > no início de linha', '> citação importante\n> > aninhada', 'citação importante\naninhada'],
    ['linha horizontal isolada ---', '---', ''],
    ['linhas horizontais *** e ___ entre parágrafos', 'Acima\n  ***  \nMeio\n____\nAbaixo', 'Acima\nMeio\nAbaixo'],
    ['dois traços ou traços com texto não são linha horizontal', '--\n--- texto\ntexto ---', '--\n--- texto\ntexto ---'],

    // Listas e numeração
    ['listas com -, * e + viram marcador • ', '- item um\n* item dois\n  + item três', '• item um\n• item dois\n• item três'],
    ['lista numerada 1. permanece intacta', '1. passo inicial\n2. passo final', '1. passo inicial\n2. passo final'],

    // Crases e blocos de código
    ['crases simples inline mantêm conteúdo', 'Clique em `Publicar` ou `Vitrine científica`', 'Clique em Publicar ou Vitrine científica'],
    ['bloco de código com crases triplas remove linguagem e mantém conteúdo', '```javascript\nconst total = 10;\n```', 'const total = 10;'],
    ['dois blocos de código seguidos e bloco sem quebra final', '```py\nx = 1\n```\nmeio\n```sql\nSELECT 1```', 'x = 1\nmeio\nSELECT 1'],

    // Tabelas
    [
      'tabela Markdown remove separador e troca pipes internos por travessão',
      '| Projeto | Meta |\n| --- | :---: |\n| Robótica | R$ 500,00 |',
      'Projeto — Meta\nRobótica — R$ 500,00',
    ],
    [
      'pipes sem traço ou texto com traço não são descartados como separador',
      '| : |\n| A - B | C |\n- :',
      ':\nA - B — C\n• :',
    ],

    // Barras de caminho vs barras legítimas
    ['barra escapada \\/vitrine fica sem barra', '\\/vitrine', 'vitrine'],
    ['barra precedida por espaço " /vitrine" e início "/publicar"', '/publicar ou visite /vitrine', 'publicar ou visite vitrine'],
    ['barra entre parênteses "(/entrar)" e raiz isolada "(/)" / "( / )"', 'Página inicial (/) e menu ( / ) ou (/entrar)', 'Página inicial e menu ou (entrar)'],
    ['barras entre palavras, datas e URLs permanecem intactas', 'Use e/ou em 10/09/2026 via https://a.com/b', 'Use e/ou em 10/09/2026 via https://a.com/b'],

    // Preservação de snake_case, matemática, moeda, emojis e acentos
    ['snake_case e identificadores com sublinhado permanecem intactos', 'Tipos: noticia_escolar, artigo_cientifico e foo__bar__baz', 'Tipos: noticia_escolar, artigo_cientifico e foo__bar__baz'],
    ['multiplicação "2 * 3" e asteriscos soltos permanecem intactos', 'Calcule 2 * 3 * 4 e 2*3*4 ou a _ b _ c', 'Calcule 2 * 3 * 4 e 2*3*4 ou a _ b _ c'],
    ['valores em reais R$ 1.500,00 intactos', 'Meta de R$ 1.500,00 atingida [1].', 'Meta de R$ 1.500,00 atingida [1].'],
    ['acentos e emojis preservados', 'Ciência, Educação e Robótica 🔬🤖🌱 no 3º ano!', 'Ciência, Educação e Robótica 🔬🤖🌱 no 3º ano!'],

    // HTML, entidades e escapes
    ['entidades HTML decodificadas (&amp;, &lt;, &gt;, &quot;, &#39;, &nbsp;)', 'P&amp;D &quot;IF&quot; &#39;26&#39; A&nbsp;B 1 &lt; 2 &gt; 0', 'P&D "IF" \'26\' A B 1 < 2 > 0'],
    ['tags <br>, <br/> e tags HTML removidas', 'Linha 1<br>Linha 2<br /><b>fim</b> <span class="x">ok</span>', 'Linha 1\nLinha 2\nfim ok'],
    ['escapes Unicode \\u003cb\\u003eolá\\u003c/b\\u003e viram texto limpo', '\\u003cb\\u003eolá\\u003c/b\\u003e e \\u003CBR\\u003Eok', 'olá e\nok'],
    ['quebra de linha literal \\n e escapes de pontuação removidos', 'A\\nB \\"oi\\" e\\/ou \\* \\_ \\# \\[1\\] \\(x\\) \\> \\~ \\| \\-', 'A\nB "oi" e/ou * _ # [1] (x) > ~ — -'],

    // Espaços, CRLF e convergência multi-passada
    ['colapso de espaços, tabs, fim de linha e múltiplas linhas em branco', '  Olá\t\tmundo   \r\n\r\n\r\n\r\nFim   ', 'Olá mundo\n\nFim'],
    ['convergência de múltiplas camadas aninhadas (entidades + tag + título)', '&amp;lt;b&amp;gt;# Título&amp;lt;/b&amp;gt;', 'Título'],
  ];

  test('possui pelo menos 28 casos na tabela de entradas e saídas', () => {
    expect(casos.length).toBeGreaterThanOrEqual(28);
  });

  test.each(casos)('%s', (_nome, entrada, esperado) => {
    const obtido = limparTexto(entrada);
    expect(obtido).toBe(esperado);
    // Garantia estrita de idempotência em todos os casos da tabela
    expect(limparTexto(obtido)).toBe(obtido);
  });

  test('entradas não-string retornam string vazia ""', () => {
    expect(limparTexto(null)).toBe('');
    expect(limparTexto(undefined)).toBe('');
    expect(limparTexto(123)).toBe('');
    expect(limparTexto(0)).toBe('');
    expect(limparTexto(false)).toBe('');
    expect(limparTexto({})).toBe('');
    expect(limparTexto(['texto'])).toBe('');
  });
});

describe('Integração CA-20 — texto simples na rota RAG, no fluxo legado, nos prompts e no guia', () => {
  const envOriginal = { ...process.env };
  const fetchOriginal = global.fetch;
  let professor;
  let provider;

  beforeAll(async () => {
    professor = await criarProfessor({ email: 'prof.textosimples@ifsp.edu.br' });
    provider = criarProvider();
  });

  beforeEach(async () => {
    process.env = { ...envOriginal };
    process.env.AGENTE_IA_ENABLED = 'true';
    process.env.AGENTE_IA_PROVIDER = 'groq';
    process.env.AGENTE_IA_API_KEY = 'chave-teste-groq';
    process.env.AGENTE_IA_RATE_LIMIT = '100';
    process.env.AGENTE_RAG_EMBEDDING_PROVIDER = 'mock';
    process.env.AGENTE_RAG_EMBEDDING_MODEL = 'mock-embedding';
    global.fetch = jest.fn();

    await AgentChunk.destroy({ where: {} });
    await Article.destroy({ where: {} });
    invalidarIndice();
    limparCache();
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  test('via rota HTTP (modo "rag"): limpa Markdown e caminhos de rota mantendo citação [1] e fontes', async () => {
    process.env.AGENTE_RAG_ENABLED = 'true';

    const artigo = await Article.create({
      titulo: 'Estação Solar Escolar',
      resumo: 'Energia limpa na escola.',
      conteudo: 'Painéis fotovoltaicos instalados pelos estudantes.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
    });
    await semearChunk({
      sourceId: artigo.id,
      texto: 'Título: Estação Solar Escolar\nPainéis fotovoltaicos instalados pelos estudantes.',
      provider,
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '**Olá** [1] visite /vitrine e (/entrar)' } }],
      }),
    });

    const res = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'Tem algo sobre estação solar fotovoltaicos?' });

    expect(res.status).toBe(200);
    expect(res.body.modo).toBe('rag');
    expect(res.body.resposta).toBe('Olá [1] visite vitrine e (entrar)');
    expect(res.body.fontes).toHaveLength(1);
    expect(res.body.fontes[0]).toMatchObject({
      ref: 1,
      id: artigo.id,
      titulo: 'Estação Solar Escolar',
      url: `/publicacoes/${artigo.id}`,
    });

    // Verifica que o system prompt enviado ao provedor contém a regra de texto simples
    const bodyEnviado = JSON.parse(global.fetch.mock.calls[0][1].body);
    const msgSystem = bodyEnviado.messages.find((m) => m.role === 'system').content;
    expect(msgSystem).toContain('Responda apenas em texto simples: sem Markdown, sem asteriscos, sem # e sem tabelas');
    expect(msgSystem).not.toContain('(/vitrine)');
  });

  test('via fluxo legado (AGENTE_RAG_ENABLED=false, modo "ia"): limpa resposta do provedor e inclui regra no prompt', async () => {
    process.env.AGENTE_RAG_ENABLED = 'false';

    await Article.create({
      titulo: 'Oficina de Astronomia Solar',
      resumo: 'Observação astronômica.',
      conteudo: 'Uso de filtros solares seguros.',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '**Olá** [1] visite /vitrine e (/entrar)' } }],
      }),
    });

    const res = await request(app)
      .post('/api/agente/consulta')
      .send({ pergunta: 'Existe oficina de astronomia?' });

    expect(res.status).toBe(200);
    expect(res.body.modo).toBe('ia');
    expect(res.body.resposta).toBe('Olá [1] visite vitrine e (entrar)');
    expect(res.body.fontes).toHaveLength(1);

    const bodyEnviado = JSON.parse(global.fetch.mock.calls[0][1].body);
    const msgSystem = bodyEnviado.messages.find((m) => m.role === 'system').content;
    expect(msgSystem).toContain('Responda apenas em texto simples: sem Markdown, sem asteriscos, sem # e sem tabelas');
  });

  test('se limparTexto resultar em string vazia (ex.: "---" ou "<b> </b>"), cai no fallback de busca no RAG e no legado', async () => {
    const artigo = await Article.create({
      titulo: 'Biodiversidade no Campus',
      resumo: 'Catálogo de plantas nativas.',
      conteudo: 'Levantamento botânico de biodiversidade.',
      tipo: 'artigo_cientifico',
      status: 'publicado',
      autorId: professor.usuario.id,
    });
    await semearChunk({
      sourceId: artigo.id,
      texto: 'Título: Biodiversidade no Campus\nLevantamento botânico de biodiversidade.',
      provider,
    });

    // 1. Modo RAG com resposta que fica vazia após limpeza
    process.env.AGENTE_RAG_ENABLED = 'true';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '---\n<b>   </b>' } }] }),
    });

    const resRag = await consultarRag('biodiversidade');
    expect(resRag.modo).toBe('busca');
    expect(resRag.fontes).toHaveLength(1);

    // 2. Fluxo legado com resposta que fica vazia após limpeza
    process.env.AGENTE_RAG_ENABLED = 'false';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '---' } }] }),
    });

    const resLegado = await responder('biodiversidade');
    expect(resLegado.modo).toBe('busca');
    expect(resLegado.fontes).toHaveLength(1);
  });

  test('SYSTEM_PROMPT_RAG e guia.js não contêm Markdown, crases nem caminhos de URL', () => {
    expect(SYSTEM_PROMPT_RAG).toContain(
      "Responda apenas em texto simples: sem Markdown, sem asteriscos, sem # e sem tabelas; use frases curtas e, para passos, linhas numeradas '1.', '2.'. Cite menus e botões pelo nome (ex.: Publicar, Vitrine científica, Cadastrar projeto), nunca por caminho de URL."
    );
    expect(SYSTEM_PROMPT_RAG).not.toMatch(/\(\/[a-z]*\)/i);

    const guiaCompleto = formatarSecoes(GUIA_SECOES);
    expect(guiaCompleto).not.toContain('`');
    expect(guiaCompleto).not.toMatch(/(^|[\s(])\/[a-z]/i);
    expect(limparTexto(guiaCompleto)).toBe(guiaCompleto);
  });
});
