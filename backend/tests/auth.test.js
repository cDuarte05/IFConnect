const request = require('supertest');
require('./setup');
const app = require('../src/app');

describe('Autenticação — POST /api/auth/registrar', () => {
  test('cadastra um estudante com sucesso e retorna token', async () => {
    const res = await request(app).post('/api/auth/registrar').send({
      nome: 'Ana Estudante',
      email: 'ana@escola.edu.br',
      senha: 'senha123',
      tipo: 'estudante',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.tipo).toBe('estudante');
  });

  test('rejeita cadastro público com tipo professor_moderador (autoatribuição de privilégio)', async () => {
    const res = await request(app).post('/api/auth/registrar').send({
      nome: 'Falso Professor',
      email: 'falso.professor@escola.edu.br',
      senha: 'senha123',
      tipo: 'professor_moderador',
    });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBe(true);
  });

  test('rejeita cadastro com email já existente', async () => {
    await request(app).post('/api/auth/registrar').send({
      nome: 'Primeiro',
      email: 'duplicado@escola.edu.br',
      senha: 'senha123',
    });
    const res = await request(app).post('/api/auth/registrar').send({
      nome: 'Segundo',
      email: 'duplicado@escola.edu.br',
      senha: 'outrasenha',
    });
    expect(res.status).toBe(409);
  });

  test('rejeita cadastro com email inválido', async () => {
    const res = await request(app).post('/api/auth/registrar').send({
      nome: 'Alguém',
      email: 'nao-e-um-email',
      senha: 'senha123',
    });
    expect(res.status).toBe(400);
  });

  test('rejeita cadastro com senha curta', async () => {
    const res = await request(app).post('/api/auth/registrar').send({
      nome: 'Alguém',
      email: 'senha-curta@escola.edu.br',
      senha: '123',
    });
    expect(res.status).toBe(400);
  });
});

describe('Autenticação — POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/registrar').send({
      nome: 'Login Teste',
      email: 'login.teste@escola.edu.br',
      senha: 'senha123',
    });
  });

  test('autentica com credenciais corretas', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login.teste@escola.edu.br',
      senha: 'senha123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('rejeita senha incorreta', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login.teste@escola.edu.br',
      senha: 'senhaerrada',
    });
    expect(res.status).toBe(401);
  });

  test('rejeita email inexistente', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nao.existe@escola.edu.br',
      senha: 'senha123',
    });
    expect(res.status).toBe(401);
  });
});

describe('Perfil — GET/PATCH /api/auth/perfil', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/registrar').send({
      nome: 'Perfil Teste',
      email: 'perfil.teste@escola.edu.br',
      senha: 'senha123',
    });
    token = res.body.token;
  });

  test('exige autenticação', async () => {
    const res = await request(app).get('/api/auth/perfil');
    expect(res.status).toBe(401);
  });

  test('retorna o próprio perfil sem o hash de senha', async () => {
    const res = await request(app).get('/api/auth/perfil').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('perfil.teste@escola.edu.br');
    expect(res.body.senhaHash).toBeUndefined();
  });

  test('permite atualizar instituição e bio', async () => {
    const res = await request(app)
      .patch('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`)
      .send({ instituicao: 'IFSP Campus Piracicaba', bio: 'Gosto de robótica.' });
    expect(res.status).toBe(200);
    expect(res.body.instituicao).toBe('IFSP Campus Piracicaba');
  });
});
