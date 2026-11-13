const { processarCitacoes } = require('../../src/services/agente/generation/citacoes');

describe('Processamento de Citações (generation/citacoes.js)', () => {
  test('7. mantém marcadores válidos, remove inválidos e preserva ordem de refsCitadas sem duplicatas', () => {
    const texto = 'Segundo a publicação [1], os resultados são positivos [2]. O projeto [9] foi cancelado. Fontes adicionais [1, 9, 2].';
    const refsValidas = [1, 2];

    const { texto: textoProcessado, refsCitadas } = processarCitacoes(texto, refsValidas);

    expect(textoProcessado).toBe(
      'Segundo a publicação [1], os resultados são positivos [2]. O projeto foi cancelado. Fontes adicionais [1, 2].'
    );
    expect(refsCitadas).toEqual([1, 2]);
  });

  test('8. limpeza de espaços duplicados e pontuação após remover marcadores', () => {
    const texto1 = 'O artigo foi finalizado [99] . Já a campanha começou bem [50] , com apoio local.';
    const res1 = processarCitacoes(texto1, []);
    expect(res1.texto).toBe('O artigo foi finalizado. Já a campanha começou bem, com apoio local.');
    expect(res1.refsCitadas).toEqual([]);

    const texto2 = 'Muitos voluntários [12] , [14] participaram do evento [15] .';
    const res2 = processarCitacoes(texto2, []);
    expect(res2.texto).toBe('Muitos voluntários participaram do evento.');
  });

  test('9. texto sem marcadores retorna o texto limpo e refsCitadas vazias', () => {
    const texto = 'Não foram encontrados projetos para essa pesquisa.';
    const res = processarCitacoes(texto, [1, 2, 3]);
    expect(res.texto).toBe(texto);
    expect(res.refsCitadas).toEqual([]);
  });

  test('10. entrada null, undefined ou vazia retorna { texto: "", refsCitadas: [] }', () => {
    expect(processarCitacoes(null, [1])).toEqual({ texto: '', refsCitadas: [] });
    expect(processarCitacoes(undefined, [1])).toEqual({ texto: '', refsCitadas: [] });
    expect(processarCitacoes('', [1])).toEqual({ texto: '', refsCitadas: [] });
  });

  test('11. aceita Set ou valores nulos/undefined em refsValidas', () => {
    const comSet = processarCitacoes('Fonte [1] e [2].', new Set([2]));
    expect(comSet).toEqual({ texto: 'Fonte e [2].', refsCitadas: [2] });

    const comNull = processarCitacoes('Fonte [1].', null);
    expect(comNull).toEqual({ texto: 'Fonte.', refsCitadas: [] });
  });
});

