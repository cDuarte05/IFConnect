require('../setup');
const crypto = require('crypto');
const { Article, Campaign, Category, AgentChunk } = require('../../src/models');
const { criarProfessor } = require('../helpers');
const { semearChunk, criarProvider } = require('./_fixtures');
const { invalidarIndice } = require('../../src/services/agente/retrieval/indice');
const { limparCache } = require('../../src/services/agente/ingest/embedder');
const {
  RRF_K,
  CANDIDATOS_POR_RAMO,
  MAX_CHUNKS_POR_DOCUMENTO,
  fundirRrf,
  recuperar,
} = require('../../src/services/agente/retrieval/hybrid');
const { ProvedorIndisponivelError } = require('../../src/services/agente/providers/errors');

describe('fundirRrf (unitário)', () => {
  test('constantes exportadas', () => {
    expect(RRF_K).toBe(60);
    expect(CANDIDATOS_POR_RAMO).toBe(20);
    expect(MAX_CHUNKS_POR_DOCUMENTO).toBe(2);
  });

  test('item presente nas duas listas supera item presente em uma só; valores exatos', () => {
    const l1 = [{ chunkId: 'a' }, { chunkId: 'b' }];
    const l2 = [{ chunkId: 'b' }, { chunkId: 'c' }];
    const mapa = fundirRrf([l1, l2], { rrfK: 60 });

    expect(mapa.get('a').rrf).toBeCloseTo(1 / 61, 12);
    expect(mapa.get('b').rrf).toBeCloseTo(1 / 62 + 1 / 61, 12);
    expect(mapa.get('c').rrf).toBeCloseTo(1 / 62, 12);
    expect(mapa.get('b').rrf).toBeGreaterThan(mapa.get('a').rrf);
    expect(mapa.get('b').posicoes).toEqual([2, 1]);
    expect(mapa.get('a').posicoes).toEqual([1, null]);
  });

  test('aceita listas nulas ou vazias', () => {
    expect(fundirRrf([null, []]).size).toBe(0);
    expect(fundirRrf(null).size).toBe(0);
    const mapa = fundirRrf([null, [{ chunkId: 'x' }]]);
    expect(mapa.get('x').rrf).toBeCloseTo(1 / 61, 12);
  });
});

describe('recuperar — recuperação híbrida com filtro de segurança (T10)', () => {
  let provider;
  let professor;
  let categoria;

  const novoArtigo = (extra = {}) =>
    Article.create({
      titulo: 'Artigo Base',
      resumo: 'Resumo',
      conteudo: 'Conteúdo',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
      ...extra,
    });

  const novaCampanha = (extra = {}) =>
    Campaign.create({
      titulo: 'Campanha Base',
      descricao: 'Descrição',
      metaFinanceira: 1000,
      valorArrecadado: 100,
      status: 'ativa',
      autorId: professor.usuario.id,
      ...extra,
    });

  beforeAll(async () => {
    provider = criarProvider();
    professor = await criarProfessor({ nome: 'Professora Hibrida Sigilosa', email: 'hibrida.sigilosa@ifsp.edu.br' });
    categoria = await Category.create({ nome: 'Categoria Hibrida' });
  });

  beforeEach(async () => {
    await AgentChunk.destroy({ where: {} });
    invalidarIndice();
    limparCache();
  });

  test('1. artigo em_revisao, rascunho e recusado com chunks fantasma: nunca aparecem (CA-01/CA-02)', async () => {
    const publico = await novoArtigo({ titulo: 'Publico Quimerico' });
    const ocultos = [];
    for (const status of ['em_revisao', 'rascunho', 'recusado']) {
      ocultos.push(await novoArtigo({ titulo: `Oculto ${status}`, status }));
    }
    await semearChunk({ sourceId: publico.id, texto: 'Título: Publico Quimerico\nTema quimerico aberto.', provider });
    for (const a of ocultos) {
      await semearChunk({ sourceId: a.id, texto: `Título: Oculto\nTema quimerico secreto ${a.status}.`, provider });
    }

    const { fontes, diagnostico } = await recuperar('quimerico', { provider, k: 10 });

    expect(fontes.map((f) => f.id)).toEqual([publico.id]);
    for (const a of ocultos) {
      expect(fontes.map((f) => f.id)).not.toContain(a.id);
    }
    expect(diagnostico.descartadosPorStatus).toBe(3);
  });

  test('2. campanha em_analise e encerrada: nunca aparecem', async () => {
    const ativa = await novaCampanha({ titulo: 'Ativa Zeppelin' });
    const analise = await novaCampanha({ titulo: 'Analise Zeppelin', status: 'em_analise' });
    const encerrada = await novaCampanha({ titulo: 'Encerrada Zeppelin', status: 'encerrada' });
    for (const c of [ativa, analise, encerrada]) {
      await semearChunk({ sourceType: 'campanha', sourceId: c.id, texto: 'Título: Campanha\nDirigivel zeppelin.', provider });
    }

    const { fontes } = await recuperar('zeppelin', { provider, k: 10 });
    expect(fontes.map((f) => f.id)).toEqual([ativa.id]);
  });

  test('3. artigo publicado que depois vira recusado (chunks obsoletos): não aparece', async () => {
    const artigo = await novoArtigo();
    await semearChunk({ sourceId: artigo.id, texto: 'Título: Obsoleto\nAssunto anfibologia unica.', provider });

    let r = await recuperar('anfibologia', { provider });
    expect(r.fontes).toHaveLength(1);

    artigo.status = 'recusado';
    await artigo.save();

    r = await recuperar('anfibologia', { provider });
    expect(r.fontes).toEqual([]);
    expect(r.diagnostico.descartadosPorStatus).toBe(1);
  });

  test('4. chunks cujo sourceId não existe mais: não aparecem e contam em descartadosPorStatus', async () => {
    await semearChunk({ sourceId: crypto.randomUUID(), texto: 'Título: Fantasma\nTermo ectoplasma.', provider });
    await semearChunk({ sourceType: 'campanha', sourceId: crypto.randomUUID(), texto: 'Título: Fantasma 2\nTermo ectoplasma.', provider });

    const { fontes, diagnostico } = await recuperar('ectoplasma', { provider });
    expect(fontes).toEqual([]);
    expect(diagnostico.descartadosPorStatus).toBe(2);
  });

  test('5. o objeto devolvido não contém autor, e-mail nem campos de usuário', async () => {
    const artigo = await novoArtigo({ titulo: 'Privacidade Totem' });
    const campanha = await novaCampanha({ titulo: 'Privacidade Totem Campanha' });
    await semearChunk({ sourceId: artigo.id, texto: 'Título: Privacidade Totem\nTexto totem.', provider });
    await semearChunk({ sourceType: 'campanha', sourceId: campanha.id, texto: 'Título: Privacidade Totem Campanha\nTexto totem.', provider });

    const resultado = await recuperar('totem', { provider, k: 10 });
    expect(resultado.fontes).toHaveLength(2);

    const json = JSON.stringify(resultado);
    expect(json).not.toContain('Professora Hibrida Sigilosa');
    expect(json).not.toContain('hibrida.sigilosa@ifsp.edu.br');
    for (const chave of ['autor', 'autorId', 'email', 'senhaHash', 'instituicao']) {
      expect(json).not.toContain(`"${chave}"`);
    }
  });

  test('6. RN-05/CA-15: valores atuais do banco; título atual; campanha financiada continua aparecendo', async () => {
    const campanha = await novaCampanha({ titulo: 'Titulo Antigo', valorArrecadado: 100, metaFinanceira: 1000 });
    await semearChunk({ sourceType: 'campanha', sourceId: campanha.id, texto: 'Título: Titulo Antigo\nMicroscopio eletronico.', provider });

    await Campaign.update(
      { titulo: 'Titulo Novo', valorArrecadado: 750.5, status: 'financiada' },
      { where: { id: campanha.id } }
    );

    const { fontes } = await recuperar('microscopio', { provider });
    expect(fontes).toHaveLength(1);
    expect(fontes[0].titulo).toBe('Titulo Novo');
    expect(fontes[0].arrecadado).toBe(750.5);
    expect(fontes[0].meta).toBe(1000);
    expect(typeof fontes[0].arrecadado).toBe('number');
    expect(fontes[0].status).toBe('financiada');
  });

  test('7. CA-03: termo único só no corpo é encontrado (modo hibrido)', async () => {
    const artigo = await novoArtigo({ titulo: 'Biologia Geral' });
    await semearChunk({ sourceId: artigo.id, texto: 'Título: Biologia Geral\nObservamos bioluminescencia em fungos.', provider });

    const { fontes, diagnostico } = await recuperar('bioluminescencia', { provider });
    expect(diagnostico.modo).toBe('hibrido');
    expect(diagnostico.vetorialErro).toBeNull();
    expect(fontes).toHaveLength(1);
    expect(fontes[0].id).toBe(artigo.id);
  });

  test('8. CA-07: provider com erro -> modo lexical, resultados continuam, sem exceção', async () => {
    const artigo = await novoArtigo();
    await semearChunk({ sourceId: artigo.id, texto: 'Título: Resiliente\nAssunto plasmodio raro.', provider });

    const providerFalho = {
      info: provider.info,
      embedQuery: jest.fn().mockRejectedValue(new ProvedorIndisponivelError('Provedor respondeu 503', { provedor: 'gemini', status: 503 })),
    };

    const { fontes, diagnostico } = await recuperar('plasmodio', { provider: providerFalho });
    expect(diagnostico.modo).toBe('lexical');
    expect(diagnostico.vetorialErro).toBe('Provedor respondeu 503');
    expect(diagnostico.candidatosVetorial).toBeNull();
    expect(fontes).toHaveLength(1);
  });

  test('8b. provedor de embedding não configurado -> modo lexical, sem exceção', async () => {
    const artigo = await novoArtigo();
    await semearChunk({ sourceId: artigo.id, texto: 'Título: Sem Chave\nAssunto pterodactilo.', provider });

    const config = {
      enabled: true,
      rag: { enabled: true, embeddingProvider: 'gemini', embeddingModel: 'm', embeddingDim: 64, embeddingApiKey: '', topK: 4, minScore: null },
    };
    const { fontes, diagnostico } = await recuperar('pterodactilo', { config });
    expect(diagnostico.modo).toBe('lexical');
    expect(diagnostico.vetorialErro).toMatch(/AGENTE_RAG_EMBEDDING_API_KEY/);
    expect(fontes).toHaveLength(1);
  });

  test('9. minScore null descarta chunk só do vetor; minScore baixo o admite', async () => {
    const artigo = await novoArtigo();
    // "para" é stopword: o lexical ignora, mas o mock vetorial compartilha o bucket da palavra
    await semearChunk({ sourceId: artigo.id, texto: 'Título: Aula para todos\nOficina para estudantes', provider });

    const semNota = await recuperar('para', { provider, minScore: null });
    expect(semNota.fontes).toEqual([]);
    expect(semNota.diagnostico.candidatosLexical).toBe(0);
    expect(semNota.diagnostico.candidatosVetorial).toBeGreaterThan(0);
    expect(semNota.diagnostico.descartadosPorRelevancia).toBe(1);

    const comNota = await recuperar('para', { provider, minScore: 0.05 });
    expect(comNota.fontes).toHaveLength(1);
    expect(comNota.fontes[0].id).toBe(artigo.id);
    expect(comNota.fontes[0].cosseno).toBeGreaterThan(0.05);
  });

  test('10. MAX_CHUNKS_POR_DOCUMENTO e k respeitados; refs sequenciais e trechos em ordem', async () => {
    const a = await novoArtigo({ titulo: 'Fonte A' });
    const b = await novoArtigo({ titulo: 'Fonte B' });
    const c = await novoArtigo({ titulo: 'Fonte C' });
    for (let i = 0; i < 4; i++) {
      await semearChunk({ sourceId: a.id, chunkIndex: i, texto: `Título: Fonte A\nParte ${i} sobre fotossintese clorofila.`, provider });
    }
    await semearChunk({ sourceId: b.id, texto: 'Título: Fonte B\nFotossintese em algas.', provider });
    await semearChunk({ sourceId: c.id, texto: 'Título: Fonte C\nFotossintese em musgos.', provider });

    const cheio = await recuperar('fotossintese', { provider, k: 10 });
    expect(cheio.fontes).toHaveLength(3);
    expect(cheio.fontes.map((f) => f.ref)).toEqual([1, 2, 3]);
    for (const f of cheio.fontes) {
      expect(f.trechos.length).toBeLessThanOrEqual(MAX_CHUNKS_POR_DOCUMENTO);
      const indices = f.trechos.map((t) => t.chunkIndex);
      expect(indices).toEqual([...indices].sort((x, y) => x - y));
    }
    const fonteA = cheio.fontes.find((f) => f.id === a.id);
    expect(fonteA.trechos).toHaveLength(2);

    const limitado = await recuperar('fotossintese', { provider, k: 3 });
    const total = limitado.fontes.reduce((s, f) => s + f.trechos.length, 0);
    expect(total).toBe(3);
  });

  test('11. pergunta sem nenhuma correspondência -> fontes [] sem erro', async () => {
    const artigo = await novoArtigo();
    await semearChunk({ sourceId: artigo.id, texto: 'Título: Qualquer\nConteúdo comum.', provider });

    const { fontes } = await recuperar('zzzxyzqq', { provider });
    expect(fontes).toEqual([]);
  });

  test('12. url e tipo corretos para artigo e projeto', async () => {
    const artigo = await novoArtigo({ titulo: 'Rotulo Artigo', categoryId: categoria.id, tema: 'cientifico', tipo: 'poema' });
    const campanha = await novaCampanha({ titulo: 'Rotulo Projeto', categoryId: categoria.id });
    await semearChunk({ sourceId: artigo.id, texto: 'Título: Rotulo Artigo\nPalavra heliografia.', provider });
    await semearChunk({ sourceType: 'campanha', sourceId: campanha.id, texto: 'Título: Rotulo Projeto\nPalavra heliografia.', provider });

    const { fontes } = await recuperar('heliografia', { provider, k: 10 });
    const fa = fontes.find((f) => f.id === artigo.id);
    const fp = fontes.find((f) => f.id === campanha.id);

    expect(fa.tipo).toBe('publicacao');
    expect(fa.url).toBe(`/publicacoes/${artigo.id}`);
    expect(fa.tipoPublicacao).toBe('poema');
    expect(fa.categoria).toBe('Categoria Hibrida');
    expect(fa.tema).toBe('cientifico');
    expect(fa.meta).toBeUndefined();

    expect(fp.tipo).toBe('projeto');
    expect(fp.url).toBe(`/vitrine/${campanha.id}`);
    expect(fp.meta).toBe(1000);
    expect(fp.tipoPublicacao).toBeUndefined();
  });
});

