const request = require('supertest');
require('./setup');
const app = require('../src/app');
const { criarProfessor } = require('./helpers');

describe('Categorias — GET/POST /api/categorias', () => {
  test('lista categorias sem exigir autenticação', async () => {
    const res = await request(app).get('/api/categorias');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('exige autenticação para criar categoria', async () => {
    const res = await request(app).post('/api/categorias').send({ nome: 'Biologia' });
    expect(res.status).toBe(401);
  });

  test('usuário comum não pode criar categoria', async () => {
    const registro = await request(app).post('/api/auth/registrar').send({
      nome: 'Estudante Categoria',
      email: 'estudante.categoria@escola.edu.br',
      senha: 'senha123',
    });
    const res = await request(app)
      .post('/api/categorias')
      .set('Authorization', `Bearer ${registro.body.token}`)
      .send({ nome: 'Biologia' });
    expect(res.status).toBe(403);
  });

  test('professor_moderador cria categoria com sucesso', async () => {
    const { token } = await criarProfessor({ email: 'professor.criacategoria@ifsp.edu.br' });
    const res = await request(app)
      .post('/api/categorias')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Biologia', descricao: 'Ciências biológicas' });
    expect(res.status).toBe(201);
    expect(res.body.nome).toBe('Biologia');

    const lista = await request(app).get('/api/categorias');
    expect(lista.body.find((c) => c.nome === 'Biologia')).toBeDefined();
  });

  test('rejeita categoria com nome duplicado', async () => {
    const { token } = await criarProfessor({ email: 'professor.duplicatacategoria@ifsp.edu.br' });
    await request(app).post('/api/categorias').set('Authorization', `Bearer ${token}`).send({ nome: 'Química' });
    const res = await request(app)
      .post('/api/categorias')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Química' });
    expect(res.status).toBe(409);
  });
});
