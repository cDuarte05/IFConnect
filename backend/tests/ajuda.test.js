const request = require('supertest');
const app = require('../src/app');
const { GUIA_VERSAO } = require('../src/services/agente/generation/guia');
const { LIMITES } = require('../src/config/limites');

describe('Ajuda — GET /api/ajuda', () => {
  test('retorna 200 sem token, com formato esperado e cabeçalho Cache-Control', async () => {
    const res = await request(app).get('/api/ajuda');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.body).toHaveProperty('versao', GUIA_VERSAO);
    expect(Array.isArray(res.body.secoes)).toBe(true);

    for (const secao of res.body.secoes) {
      expect(typeof secao.id).toBe('string');
      expect(typeof secao.titulo).toBe('string');
      expect(Array.isArray(secao.perguntasExemplo)).toBe(true);
      expect(Array.isArray(secao.passos)).toBe(true);
      expect(Array.isArray(secao.observacoes)).toBe(true);
      expect(secao).not.toHaveProperty('palavras');
    }
  });

  test('inclui todas as seções esperadas do guia', async () => {
    const res = await request(app).get('/api/ajuda');
    const ids = res.body.secoes.map((s) => s.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'conta',
        'publicar',
        'projeto',
        'apoiar',
        'buscar',
        'editar',
        'acompanhar',
      ])
    );
  });

  test('interpola todos os limites de limites.js nos textos e não contém "<" ou ">"', async () => {
    const res = await request(app).get('/api/ajuda');
    const textos = res.body.secoes.flatMap((s) => [
      s.titulo,
      ...s.perguntasExemplo,
      ...s.passos,
      ...s.observacoes,
    ]);
    const textoCompleto = textos.join('\n');

    expect(textoCompleto).not.toMatch(/[<>]/);

    for (const valor of Object.values(LIMITES)) {
      if (Array.isArray(valor)) {
        for (const item of valor) {
          expect(textoCompleto).toContain(String(item));
        }
      } else {
        expect(textoCompleto).toContain(String(valor));
      }
    }
  });
});
