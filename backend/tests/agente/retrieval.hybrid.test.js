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
  LEXICAL_MAX_DF,
  MIN_CHUNKS_PARA_DF,
  fundirRrf,
  recuperar,
} = require('../../src/services/agente/retrieval/hybrid');
const { ProvedorIndisponivelError } = require('../../src/services/agente/providers/errors');

describe('fundirRrf (unitário)', () => {
  test('constantes exportadas', () => {
    expect(RRF_K).toBe(60);
    expect(CANDIDATOS_POR_RAMO).toBe(20);
    expect(MAX_CHUNKS_POR_DOCUMENTO).toBe(2);
    expect(LEXICAL_MAX_DF).toBe(0.25);
    expect(MIN_CHUNKS_PARA_DF).toBe(8);
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

  test('aceita listas nulas ou vazias, strings, itens inválidos e duplicatas na mesma lista', () => {
    expect(fundirRrf([null, []]).size).toBe(0);
    expect(fundirRrf(null).size).toBe(0);
    const mapa = fundirRrf([null, [{ chunkId: 'x' }]]);
    expect(mapa.get('x').rrf).toBeCloseTo(1 / 61, 12);

    // Strings diretas, itens nulos/indefinidos e chunk repetido na mesma lista (conta só a 1ª posição)
    const mapaMisto = fundirRrf([
      ['s1', null, undefined, { chunkId: null }, { chunkId: 's1' }, 's2'],
    ]);
    expect(mapaMisto.size).toBe(2);
    expect(mapaMisto.get('s1').rrf).toBeCloseTo(1 / 61, 12);
    expect(mapaMisto.get('s1').posicoes).toEqual([1]);
    expect(mapaMisto.get('s2').rrf).toBeCloseTo(1 / 66, 12);
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

  test('12. url, tipo, status, categoria e tema corretos (e null quando ausentes)', async () => {
    const artigo = await novoArtigo({ titulo: 'Rotulo Artigo', categoryId: categoria.id, tema: 'cientifico', tipo: 'poema' });
    const campanha = await novaCampanha({ titulo: 'Rotulo Projeto', categoryId: categoria.id, tema: 'comunitario' });
    const artSemMeta = await novoArtigo({ titulo: 'Artigo Sem Meta', tema: null, categoryId: null });
    const campSemMeta = await novaCampanha({ titulo: 'Campanha Sem Meta', tema: null, categoryId: null });

    await semearChunk({ sourceId: artigo.id, texto: 'Título: Rotulo Artigo\nPalavra heliografia.', provider });
    await semearChunk({ sourceType: 'campanha', sourceId: campanha.id, texto: 'Título: Rotulo Projeto\nPalavra heliografia.', provider });
    await semearChunk({ sourceId: artSemMeta.id, texto: 'Título: Artigo Sem Meta\nPalavra heliografia.', provider });
    await semearChunk({ sourceType: 'campanha', sourceId: campSemMeta.id, texto: 'Título: Campanha Sem Meta\nPalavra heliografia.', provider });

    const { fontes } = await recuperar('heliografia', { provider, k: 10 });
    const fa = fontes.find((f) => f.id === artigo.id);
    const fp = fontes.find((f) => f.id === campanha.id);
    const fa0 = fontes.find((f) => f.id === artSemMeta.id);
    const fp0 = fontes.find((f) => f.id === campSemMeta.id);

    expect(fa.tipo).toBe('publicacao');
    expect(fa.url).toBe(`/publicacoes/${artigo.id}`);
    expect(fa.tipoPublicacao).toBe('poema');
    expect(fa.status).toBe('publicado');
    expect(fa.categoria).toBe('Categoria Hibrida');
    expect(fa.tema).toBe('cientifico');
    expect(fa.meta).toBeUndefined();

    expect(fp.tipo).toBe('projeto');
    expect(fp.url).toBe(`/vitrine/${campanha.id}`);
    expect(fp.categoria).toBe('Categoria Hibrida');
    expect(fp.tema).toBe('comunitario');
    expect(fp.meta).toBe(1000);
    expect(fp.tipoPublicacao).toBeUndefined();

    expect(fa0.categoria).toBeNull();
    expect(fa0.tema).toBeNull();
    expect(fp0.categoria).toBeNull();
    expect(fp0.tema).toBeNull();
  });

  test('13. mutantes RRF, ordenação de trechos, agregação multi-chunk, erro sem message e filtro de queries por tipo', async () => {
    // 13a. Provider rejeita com valor sem .message -> vetorialErro === 'falha desconhecida'
    const artErr = await novoArtigo({ titulo: 'Artigo Fallback Erro' });
    await semearChunk({ sourceId: artErr.id, texto: 'Título: Artigo Fallback Erro\nTermo xenon.', provider });
    const spyCampFindAll = jest.spyOn(Campaign, 'findAll');
    const resErr = await recuperar('xenon', {
      provider: { info: provider.info, embedQuery: jest.fn().mockRejectedValue({}) },
    });
    expect(resErr.diagnostico.vetorialErro).toBe('falha desconhecida');
    expect(resErr.diagnostico.descartadosPorStatus).toBe(0);
    // Só havia artigo nos candidatos: Campaign.findAll não deve ter sido chamado
    expect(spyCampFindAll).not.toHaveBeenCalled();
    spyCampFindAll.mockRestore();

    // Só campanha nos candidatos -> Article.findAll não deve ser chamado
    await AgentChunk.destroy({ where: {} });
    invalidarIndice();
    const campSo = await novaCampanha({ titulo: 'Campanha Unica' });
    await semearChunk({ sourceType: 'campanha', sourceId: campSo.id, texto: 'Título: Campanha Unica\nTermo kripton.', provider });
    const spyArtFindAll = jest.spyOn(Article, 'findAll');
    const resCamp = await recuperar('kripton', { provider });
    expect(resCamp.fontes).toHaveLength(1);
    expect(spyArtFindAll).not.toHaveBeenCalled();
    spyArtFindAll.mockRestore();

    // 13b. Multi-chunk onde chunk 1 pontua MAIS que chunk 0, mais segundo artigo de RRF menor,
    // além de um candidato só vetorial descartado por minScore=null (testa totalAntes - length)
    await AgentChunk.destroy({ where: {} });
    invalidarIndice();
    limparCache();

    // Título com UUID ordenado ao contrário para garantir que a ordem vem do RRF e não do UUID
    const a1 = await novoArtigo({ titulo: 'Artigo Principal' });
    const a2 = await novoArtigo({ titulo: 'Artigo Secundario' });
    const aSoVetor = await novoArtigo({ titulo: 'Artigo So Vetor' });

    // Chunk 0 de a1: tem só 1 ocorrência no corpo (menor BM25 que chunk 1)
    const c0 = await semearChunk({
      sourceId: a1.id,
      chunkIndex: 0,
      texto: 'Título: Artigo Geral\nMenção a magnetohidrodinamica.',
      provider,
    });
    // Chunk 1 de a1: tem o termo NO TÍTULO e várias vezes -> rank #1 lexical e alto cosseno
    const c1 = await semearChunk({
      sourceId: a1.id,
      chunkIndex: 1,
      texto: 'Título: Magnetohidrodinamica Estelar\nMagnetohidrodinamica aplicada e magnetohidrodinamica computacional.',
      provider,
    });
    // Chunk de a2: 1 ocorrência, texto longo diferente para ter menor BM25 e menor cosseno
    await semearChunk({
      sourceId: a2.id,
      chunkIndex: 0,
      texto: 'Título: Texto Muito Longo Sem Relacao Direta\nDiversos assuntos gerais diversos e magnetohidrodinamica citada brevemente.',
      provider,
    });
    // Chunk de aSoVetor: tem stopword "sobre", mas sem o termo buscado -> só entra se store falso ou bucket colidir
    const cVetor = await semearChunk({
      sourceId: aSoVetor.id,
      chunkIndex: 0,
      texto: 'Título: Outro Assunto\nConteúdo sem o termo raro.',
      provider,
    });

    const storeFake = {
      buscar: jest.fn().mockResolvedValue([
        // c1 tem maior cosseno (0.95) que c0 (0.40), cVetor não tem match lexical (cobertura null)
        { chunkId: c1.id, sourceType: 'artigo', sourceId: a1.id, chunkIndex: 1, texto: c1.texto, score: 0.95 },
        { chunkId: c0.id, sourceType: 'artigo', sourceId: a1.id, chunkIndex: 0, texto: c0.texto, score: 0.40 },
        { chunkId: cVetor.id, sourceType: 'artigo', sourceId: aSoVetor.id, chunkIndex: 0, texto: cVetor.texto, score: 0.30 },
      ]),
    };

    const res = await recuperar('magnetohidrodinamica', {
      provider,
      minScore: null,
      k: 10,
      store: storeFake,
    });

    // aSoVetor descartado por relevância (3 -> 2 fontes? 4 candidatos -> 3 passam -> descartados = 1)
    expect(res.diagnostico.descartadosPorRelevancia).toBe(1);
    expect(res.fontes).toHaveLength(2);
    expect(res.fontes[0].id).toBe(a1.id);
    expect(res.fontes[1].id).toBe(a2.id);

    // c1 (pos 1 lexical + pos 1 vetorial -> 2/61) > c0 (1/62 + 1/62 -> 2/62)
    expect(res.fontes[0].rrf).toBeCloseTo(1 / 61 + 1 / 61, 10);
    expect(res.fontes[0].rrf).toBeGreaterThan(res.fontes[1].rrf);
    expect(res.fontes[0].cosseno).toBeCloseTo(0.95, 5);
    expect(res.fontes[0].cobertura).toBe(1);

    // Trechos devem estar em ordem crescente de chunkIndex ([0, 1]) mesmo com c1 pontuando mais que c0!
    expect(res.fontes[0].trechos).toEqual([
      { chunkIndex: 0, texto: c0.texto },
      { chunkIndex: 1, texto: c1.texto },
    ]);

    // Caso extra: chunk com maior rrf (c0) tem cobertura menor (0.5) e cosseno maior (0.90),
    // enquanto c1 tem cobertura maior (1.0) e cosseno menor (0.25)
    const storeInverso = {
      buscar: jest.fn().mockResolvedValue([
        { chunkId: c0.id, sourceType: 'artigo', sourceId: a1.id, chunkIndex: 0, texto: c0.texto, score: 0.90 },
        { chunkId: cVetor.id, sourceType: 'artigo', sourceId: aSoVetor.id, chunkIndex: 0, texto: cVetor.texto, score: 0.50 },
        { chunkId: c1.id, sourceType: 'artigo', sourceId: a1.id, chunkIndex: 1, texto: c1.texto, score: 0.25 },
      ]),
    };
    const resInverso = await recuperar('magnetohidrodinamica computacional', {
      provider,
      minScore: null,
      k: 10,
      store: storeInverso,
    });
    const f1 = resInverso.fontes.find((f) => f.id === a1.id);
    // c0 tem pos 2 lexical (1/62) + pos 1 vetorial (1/61) > c1 pos 1 lexical (1/61) + pos 3 vetorial (1/63)
    expect(f1.cosseno).toBeCloseTo(0.90, 5);
    expect(f1.cobertura).toBe(1);
    expect(f1.trechos.map((t) => t.chunkIndex)).toEqual([0, 1]);
  });
});

describe('Portão de relevância e descarte de termos onipresentes (T10-fix)', () => {
  let provider;
  let professor;

  const novoArtigo = (extra = {}) =>
    Article.create({
      titulo: 'Artigo Escola',
      resumo: 'Resumo',
      conteudo: 'Conteúdo',
      tipo: 'noticia_escolar',
      status: 'publicado',
      autorId: professor.usuario.id,
      ...extra,
    });

  beforeAll(async () => {
    provider = criarProvider();
    professor = await criarProfessor({ nome: 'Prof Escola Teste', email: 'prof.escola.teste@ifsp.edu.br' });
  });

  beforeEach(async () => {
    await AgentChunk.destroy({ where: {} });
    invalidarIndice();
    limparCache();
  });

  test('(a) 10 chunks com "escola" em 8 e "futebol" em nenhum: "campeonato de futebol da escola" -> fontes []', async () => {
    for (let i = 1; i <= 8; i++) {
      const art = await novoArtigo({ titulo: `Artigo Escola ${i}` });
      await semearChunk({
        sourceId: art.id,
        texto: `Título: Artigo Escola ${i}\nConteúdo geral da escola sobre projetos ${i}.`,
        provider,
      });
    }
    for (let i = 9; i <= 10; i++) {
      const art = await novoArtigo({ titulo: `Artigo Outro ${i}` });
      await semearChunk({
        sourceId: art.id,
        texto: `Título: Artigo Outro ${i}\nConteúdo laboratorial sobre astronomia ${i}.`,
        provider,
      });
    }

    const { fontes, diagnostico } = await recuperar('campeonato de futebol da escola', {
      provider,
      minScore: null,
    });

    expect(fontes).toEqual([]);
    expect(diagnostico.descartadosPorTermoGenerico).toBeGreaterThan(0);
    expect(diagnostico.descartadosPorRelevancia).toBeGreaterThan(0);
  });

  test('(b) "robótica na escola" com "robotica" em 1 só chunk -> encontra', async () => {
    let artComRobotica;
    for (let i = 1; i <= 8; i++) {
      const temRobotica = i === 1;
      const art = await novoArtigo({ titulo: `Artigo Escola ${i}` });
      if (temRobotica) artComRobotica = art;
      await semearChunk({
        sourceId: art.id,
        texto: temRobotica
          ? `Título: Artigo Escola ${i}\nOficina de robotica na escola para estudantes.`
          : `Título: Artigo Escola ${i}\nConteúdo geral da escola número ${i}.`,
        provider,
      });
    }
    for (let i = 9; i <= 10; i++) {
      const art = await novoArtigo({ titulo: `Artigo Neutro ${i}` });
      await semearChunk({
        sourceId: art.id,
        texto: `Título: Artigo Neutro ${i}\nConteúdo neutro ${i}.`,
        provider,
      });
    }

    const { fontes, diagnostico } = await recuperar('robótica na escola', {
      provider,
      minScore: null,
    });

    expect(fontes.length).toBeGreaterThanOrEqual(1);
    expect(fontes[0].id).toBe(artComRobotica.id);
    expect(diagnostico.descartadosPorTermoGenerico).toBeGreaterThan(0);
  });

  test('(c) com minScore baixo, chunk só vetorial entra', async () => {
    const art = await novoArtigo({ titulo: 'Artigo Sem Palavras Casadas' });
    const cVetor = await semearChunk({
      sourceId: art.id,
      texto: 'Título: Artigo Sem Palavras Casadas\nTexto sem nenhum termo da busca.',
      provider,
    });

    const storeFake = {
      buscar: jest.fn().mockResolvedValue([
        {
          chunkId: cVetor.id,
          sourceType: 'artigo',
          sourceId: art.id,
          chunkIndex: 0,
          texto: cVetor.texto,
          score: 0.40,
        },
      ]),
    };

    const { fontes } = await recuperar('pergunta totalmente diferente', {
      provider,
      minScore: 0.30,
      store: storeFake,
    });

    expect(fontes).toHaveLength(1);
    expect(fontes[0].id).toBe(art.id);
  });

  test('(d) índice com 3 chunks usa a regra antiga (cobertura > 0)', async () => {
    const artigos = [];
    for (let i = 1; i <= 3; i++) {
      const art = await novoArtigo({ titulo: `Artigo Pequeno ${i}` });
      artigos.push(art);
      await semearChunk({
        sourceId: art.id,
        texto: `Título: Artigo Pequeno ${i}\nAtividades na escola turma ${i}.`,
        provider,
      });
    }

    const { fontes, diagnostico } = await recuperar('futebol na escola', {
      provider,
      minScore: null,
    });

    expect(fontes.length).toBe(3);
    expect(diagnostico.descartadosPorTermoGenerico).toBe(0);
  });
});

