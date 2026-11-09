const { criarMockEmbeddingProvider } = require('../../src/services/agente/providers/embedding/mock');

function produtoEscalar(a, b) {
  return a.reduce((soma, val, i) => soma + val * b[i], 0);
}

function norma(v) {
  return Math.sqrt(v.reduce((soma, val) => soma + val * val, 0));
}

describe('Provedor Mock de Embedding (providers/embedding/mock.js)', () => {
  const provider = criarMockEmbeddingProvider();

  test('possui dimensão 64 e informações corretas', () => {
    expect(provider.info.provider).toBe('mock');
    expect(provider.info.dim).toBe(64);
  });

  test('retorna vetores determinísticos para a mesma entrada', async () => {
    const texto = 'Pesquisa sobre energias renováveis e sustentabilidade no IF';
    const v1 = await provider.embedQuery(texto);
    const v2 = await provider.embedQuery(texto);

    expect(v1).toHaveLength(64);
    expect(v1).toEqual(v2);
  });

  test('todos os vetores gerados possuem norma L2 próxima de 1', async () => {
    const texto = 'Computação quântica e inteligência artificial';
    const v = await provider.embedQuery(texto);
    const n = norma(v);

    expect(n).toBeCloseTo(1, 5);
  });

  test('textos parecidos possuem similaridade de cosseno maior do que textos diferentes', async () => {
    const query = 'projetos de robótica e automação';
    const docParecido = 'Iniciação científica com robótica educacional e automação de sistemas';
    const docDiferente = 'Culinária tradicional e história da arte barroca colonial';

    const vQuery = await provider.embedQuery(query);
    const [vParecido, vDiferente] = await provider.embedDocuments([docParecido, docDiferente]);

    // Como ambos são normalizados L2, o produto escalar é o cosseno
    const cossenoParecido = produtoEscalar(vQuery, vParecido);
    const cossenoDiferente = produtoEscalar(vQuery, vDiferente);

    expect(cossenoParecido).toBeGreaterThan(cossenoDiferente);
  });
});

