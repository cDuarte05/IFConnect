require('../../setup');
const { criarProvider } = require('../_fixtures');
const { executarAvaliacao } = require('./runner');
const { ehPerguntaDeNavegacao } = require('../../../src/services/agente/generation/intencao');
const dataset = require('./dataset.json');

describe('Avaliação offline do RAG (tests/agente/eval/runner.js)', () => {
  let relatorio;

  beforeAll(async () => {
    const provider = criarProvider();
    relatorio = await executarAvaliacao({ provider, k: 4, log: () => {} });
  });

  test('1. executarAvaliacao roda sem lançar exceção e retorna modos lexical, vetorial e hibrido', () => {
    expect(relatorio).toBeDefined();
    expect(relatorio.modos).toHaveProperty('lexical');
    expect(relatorio.modos).toHaveProperty('vetorial');
    expect(relatorio.modos).toHaveProperty('hibrido');
    expect(Array.isArray(relatorio.varreduraLimiar)).toBe(true);
    expect(relatorio.varreduraLimiar.length).toBeGreaterThan(0);
  });

  test('2. relatorio.isolamentoOk === true (assert estrito)', () => {
    expect(relatorio.isolamentoOk).toBe(true);
    expect(relatorio.ocorrenciasIsolamento).toEqual([]);
  });

  test('3. perguntas de isolamento e negativas sem overlap retornam 0 fontes; sem vazamento', () => {
    // Perguntas de isolamento estrito (Q22, Q23) e pergunta sem sobreposição vocabular (Q21)
    expect(relatorio.detalhePorPergunta.Q21.hibrido).toEqual([]);
    expect(relatorio.detalhePorPergunta.Q22.hibrido).toEqual([]);
    expect(relatorio.detalhePorPergunta.Q23.hibrido).toEqual([]);

    // Q20 tem palavra comum no vocabulário ('escola'), mas nunca pode vazar documentos não públicos
    const docsQ20 = relatorio.detalhePorPergunta.Q20.hibrido;
    const idsNaoPublicos = ['N1', 'N2', 'N3', 'N4'];
    for (const id of docsQ20) {
      expect(idsNaoPublicos).not.toContain(id);
    }

    expect(relatorio.negativasEisolamento.vazioIsolamento).toBe(1);
  });

  test('4. Q13 (corpo, 2º trecho de A7) e Q18 (distrator A8) estão no topo-k do modo lexical', () => {
    expect(relatorio.detalhePorPergunta.Q13.lexical).toContain('A7');
    expect(relatorio.detalhePorPergunta.Q18.lexical).toContain('A8');
  });

  test('5. ehPerguntaDeNavegacao: Q24 e Q25 verdadeiras; Q20 e Q21 falsas', () => {
    const porId = new Map(dataset.perguntas.map((p) => [p.id, p.pergunta]));

    expect(ehPerguntaDeNavegacao(porId.get('Q24'))).toBe(true);
    expect(ehPerguntaDeNavegacao(porId.get('Q25'))).toBe(true);
    expect(ehPerguntaDeNavegacao(porId.get('Q20'))).toBe(false);
    expect(ehPerguntaDeNavegacao(porId.get('Q21'))).toBe(false);
  });
});

