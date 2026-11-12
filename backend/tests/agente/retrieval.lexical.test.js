require('../setup');
const crypto = require('crypto');
const { AgentChunk } = require('../../src/models');
const { semearChunk, criarProvider } = require('./_fixtures');
const {
  normalizar,
  stem,
  tokenizar,
  tokensConsulta,
} = require('../../src/services/agente/retrieval/texto');
const {
  carregarIndice,
  invalidarIndice,
} = require('../../src/services/agente/retrieval/indice');
const { buscarLexical, dfRatio } = require('../../src/services/agente/retrieval/lexical');

describe('Recuperação Lexical BM25 e Índice em Memória (T8)', () => {
  let provider;

  beforeAll(() => {
    provider = criarProvider();
  });

  beforeEach(async () => {
    await AgentChunk.destroy({ where: {} });
    invalidarIndice();
  });

  test('1. texto: tokenizar remove acentos/stopwords, mantém "luz"/"gas"; stems simétricos; entrada vazia -> []', () => {
    expect(tokenizar('')).toEqual([]);
    expect(tokenizar(null)).toEqual([]);
    expect(tokenizar('   ')).toEqual([]);

    const tokens = tokenizar('A luz do sol e o gás na reação');
    expect(tokens).toContain('luz');
    expect(tokens).toContain('sol');
    expect(tokens).toContain('gas');
    expect(tokens).not.toContain('na');
    expect(tokens).not.toContain('do');

    // Stems simétricos
    expect(stem('sensor')).toBe(stem('sensores'));
    expect(stem('projeto')).toBe(stem('projetos'));
    expect(stem('luz')).toBe(stem('luzes'));
    expect(stem('robotica')).toBe(stem('roboticas'));
    expect(stem('acoes')).toBe(stem('acao'));
    expect(normalizar('Robótica Educacional')).toBe('robotica educacional');
  });

  test('2. índice: detecta chunk novo e exclusão sem invalidarIndice; sem mudanças, 2ª chamada NÃO chama findAll', async () => {
    const c1 = await semearChunk({
      texto: 'Título: Primeiro Chunk\nConteúdo sobre física.',
      provider,
    });

    const spyFindAll = jest.spyOn(AgentChunk, 'findAll');
    // Em Sequelize, findOne delega internamente para findAll com { limit: 1, plain: true };
    // filtramos apenas as chamadas reais de recarga completa (sem limit).
    const recargasCompletas = () =>
      spyFindAll.mock.calls.filter(([opts]) => !opts?.limit && !opts?.plain).length;

    const ind1 = await carregarIndice();
    expect(ind1.entradas).toHaveLength(1);
    expect(recargasCompletas()).toBe(1);

    // 2ª chamada sem mudanças: usa cache e NÃO executa recarga via findAll
    const ind2 = await carregarIndice();
    expect(ind2).toBe(ind1);
    expect(recargasCompletas()).toBe(1);

    // Semear novo chunk -> assinatura muda -> recarrega automaticamente
    await semearChunk({
      texto: 'Título: Segundo Chunk\nConteúdo sobre química.',
      provider,
    });
    const ind3 = await carregarIndice();
    expect(ind3.entradas).toHaveLength(2);
    expect(recargasCompletas()).toBe(2);

    // Apagar chunk -> assinatura muda -> recarrega automaticamente
    await AgentChunk.destroy({ where: { id: c1.id } });
    const ind4 = await carregarIndice();
    expect(ind4.entradas).toHaveLength(1);
    expect(recargasCompletas()).toBe(3);

    spyFindAll.mockRestore();
  });

  test('3. lexical acha um chunk cujo termo único só existe no corpo (CA-03)', async () => {
    await semearChunk({
      texto: 'Título: Projeto de Biologia\nResumo: Estudo geral.\nObservamos bioluminescência em fungos da mata atlântica.',
      provider,
    });
    await semearChunk({
      texto: 'Título: Projeto de Matemática\nCálculo diferencial e integral aplicado.',
      provider,
    });

    const resultados = await buscarLexical('Onde há bioluminescência?');
    expect(resultados).toHaveLength(1);
    expect(resultados[0].texto).toContain('Biologia');
    expect(resultados[0].score).toBeGreaterThan(0);
  });

  test('4. título pesa mais: chunk com termo no título supera outro com termo só no corpo', async () => {
    const cCorpo = await semearChunk({
      sourceId: crypto.randomUUID(),
      texto: 'Título: Oficina de Programação\nDesenvolvemos um módulo de telemetria para experimentos escolares.',
      provider,
    });
    const cTitulo = await semearChunk({
      sourceId: crypto.randomUUID(),
      texto: 'Título: Telemetria Aplicada\nOficina introdutória para estudantes do ensino médio técnico.',
      provider,
    });

    const resultados = await buscarLexical('telemetria');
    expect(resultados).toHaveLength(2);
    expect(resultados[0].chunkId).toBe(cTitulo.id);
    expect(resultados[1].chunkId).toBe(cCorpo.id);
    expect(resultados[0].score).toBeGreaterThan(resultados[1].score);
  });

  test('5. singular/plural e acentuação casam ("sensor" acha "sensores"; "robótica" acha "robotica")', async () => {
    await semearChunk({
      texto: 'Título: Estação Meteorológica\nUtilizamos diversos sensores de umidade e pressão.',
      provider,
    });
    await semearChunk({
      texto: 'Título: Clube de Robotica\nAtividades praticas de montagem.',
      provider,
    });

    const resSensor = await buscarLexical('sensor');
    expect(resSensor).toHaveLength(1);
    expect(resSensor[0].texto).toContain('Meteorológica');

    const resRobotica = await buscarLexical('robótica');
    expect(resRobotica).toHaveLength(1);
    expect(resRobotica[0].texto).toContain('Robotica');
  });

  test('6. termo raro supera termo comum (BM25/idf)', async () => {
    // 3 chunks com "energia" (termo comum); apenas 1 com "hidrogenio" (termo raro)
    const cComum1 = await semearChunk({
      texto: 'Título: Energia Eólica\nGeração de energia limpa com turbinas e energia sustentável.',
      provider,
    });
    await semearChunk({
      texto: 'Título: Energia Solar\nPainéis para geração de energia fotovoltaica.',
      provider,
    });
    const cRaro = await semearChunk({
      texto: 'Título: Combustível Alternativo\nCélula de hidrogênio verde e energia experimental.',
      provider,
    });

    const resultados = await buscarLexical('energia hidrogênio');
    expect(resultados.length).toBeGreaterThanOrEqual(2);
    expect(resultados[0].chunkId).toBe(cRaro.id);
    expect(resultados[0].chunkId).not.toBe(cComum1.id);
  });

  test('7. consulta só com stopwords ou vazia -> []; k limita tamanho; ordem determinística', async () => {
    await semearChunk({ texto: 'Título: Física A\nÓptica geométrica.', provider });
    await semearChunk({ texto: 'Título: Física B\nÓptica ondulatória.', provider });
    await semearChunk({ texto: 'Título: Física C\nÓptica quântica.', provider });

    expect(await buscarLexical('')).toEqual([]);
    expect(await buscarLexical('de para com sobre quais')).toEqual([]);

    const limitados = await buscarLexical('óptica', { k: 2 });
    expect(limitados).toHaveLength(2);

    // Chamadas repetidas devolvem exatamente a mesma ordem determinística
    const repetido = await buscarLexical('óptica', { k: 2 });
    expect(repetido.map((r) => r.chunkId)).toEqual(limitados.map((r) => r.chunkId));
  });

  test('8. cobertura calculada corretamente (2 de 4 termos -> 0.5)', async () => {
    await semearChunk({
      texto: 'Título: Aquaponia Escolar\nIntegração entre cultivo hidropônico e criação de peixes.',
      provider,
    });

    // Consulta com 4 termos válidos distintos: aquaponia, peixes, astronomia, foguete
    const consulta = 'aquaponia peixes astronomia foguete';
    expect(tokensConsulta(consulta)).toHaveLength(4);

    const resultados = await buscarLexical(consulta);
    expect(resultados).toHaveLength(1);
    expect(resultados[0].cobertura).toBeCloseTo(0.5, 5);
  });

  test('9. termosCasados lista os tokens da consulta no chunk e dfRatio calcula a fração no índice (T10-fix)', async () => {
    await semearChunk({ texto: 'Título: Escola A\nAtividades na escola.', provider });
    await semearChunk({ texto: 'Título: Escola B\nMais escola.', provider });
    await semearChunk({ texto: 'Título: Escola C\nClube de robotica na escola.', provider });
    await semearChunk({ texto: 'Título: Laboratorio D\nExperimentos de fisica.', provider });

    const resultados = await buscarLexical('robotica na escola');
    const chunkRobotica = resultados.find((r) => r.texto.includes('robotica'));
    expect(chunkRobotica).toBeDefined();
    expect(chunkRobotica.termosCasados).toEqual(expect.arrayContaining(['robotica', 'escola']));

    expect(dfRatio('escola')).toBeCloseTo(3 / 4, 5);
    expect(dfRatio('robotica')).toBeCloseTo(1 / 4, 5);
    expect(dfRatio('fisica')).toBeCloseTo(1 / 4, 5);
    expect(dfRatio('inexistente')).toBe(0);
    expect(dfRatio('')).toBe(0);
  });
});
