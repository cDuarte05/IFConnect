const request = require('supertest');
require('./setup');
const app = require('../src/app');
const { criarProfessor } = require('./helpers');

async function registrarEstudante(email) {
  const res = await request(app).post('/api/auth/registrar').send({
    nome: 'Estudante Projeto',
    email,
    senha: 'senha123',
  });
  return res.body.token;
}

describe('Projetos (vitrine) — POST /api/campanhas', () => {
  test('usuário autenticado cadastra projeto, que entra em análise (não aparece na vitrine ainda)', async () => {
    const token = await registrarEstudante('estudante.projeto1@escola.edu.br');
    const categoria = await request(app)
      .post('/api/categorias')
      .set('Authorization', `Bearer ${(await criarProfessor({ email: 'professor.categoria1@ifsp.edu.br' })).token}`)
      .send({ nome: 'Meteorologia' });

    const res = await request(app)
      .post('/api/campanhas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: 'Estação meteorológica escolar',
        descricao: 'Projeto para montar uma estação meteorológica de baixo custo.',
        categoryId: categoria.body.id,
        tema: 'cientifico',
        palavrasChave: 'meteorologia, arduino',
        metaFinanceira: 1000,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('em_analise');
    expect(res.body.categoryId).toBe(categoria.body.id);

    const vitrinePublica = await request(app).get('/api/campanhas');
    expect(vitrinePublica.body.find((c) => c.id === res.body.id)).toBeUndefined();
  });

  test('rejeita meta financeira inválida (zero ou negativa)', async () => {
    const token = await registrarEstudante('estudante.metainvalida@escola.edu.br');
    const res = await request(app)
      .post('/api/campanhas')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'x', descricao: 'x', metaFinanceira: 0 });
    expect(res.status).toBe(400);
  });

  test('rejeita categoryId que não é um UUID válido', async () => {
    const token = await registrarEstudante('estudante.categoriainvalida@escola.edu.br');
    const res = await request(app)
      .post('/api/campanhas')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'x', descricao: 'x', metaFinanceira: 10, categoryId: 'nao-e-um-uuid' });
    expect(res.status).toBe(400);
  });

  test('rejeita tema fora da lista fixa', async () => {
    const token = await registrarEstudante('estudante.temainvalido@escola.edu.br');
    const res = await request(app)
      .post('/api/campanhas')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'x', descricao: 'x', metaFinanceira: 10, tema: 'tema_que_nao_existe' });
    expect(res.status).toBe(400);
  });

  test('exige autenticação para cadastrar projeto', async () => {
    const res = await request(app).post('/api/campanhas').send({ titulo: 'x', descricao: 'x', metaFinanceira: 10 });
    expect(res.status).toBe(401);
  });
});

describe('Projetos — edição e moderação', () => {
  let autorToken;
  let campanhaId;

  beforeAll(async () => {
    autorToken = await registrarEstudante('estudante.projetoedicao@escola.edu.br');
    const res = await request(app)
      .post('/api/campanhas')
      .set('Authorization', `Bearer ${autorToken}`)
      .send({ titulo: 'Projeto original', descricao: 'Descrição original', metaFinanceira: 500 });
    campanhaId = res.body.id;
  });

  test('outro usuário não pode editar o projeto', async () => {
    const outroToken = await registrarEstudante('estudante.projetointruso@escola.edu.br');
    const res = await request(app)
      .put(`/api/campanhas/${campanhaId}`)
      .set('Authorization', `Bearer ${outroToken}`)
      .send({ titulo: 'Alterado por outro' });
    expect(res.status).toBe(403);
  });

  test('autor pode editar o projeto enquanto em análise', async () => {
    const res = await request(app)
      .put(`/api/campanhas/${campanhaId}`)
      .set('Authorization', `Bearer ${autorToken}`)
      .send({ titulo: 'Projeto revisado' });
    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe('Projeto revisado');
  });

  test('usuário comum não pode moderar projetos', async () => {
    const res = await request(app)
      .patch(`/api/campanhas/${campanhaId}/moderar`)
      .set('Authorization', `Bearer ${autorToken}`)
      .send({ status: 'ativa' });
    expect(res.status).toBe(403);
  });

  test('fila de moderação de projetos (pendentes) é restrita a professor_moderador', async () => {
    const semPermissao = await request(app)
      .get('/api/campanhas/moderacao/pendentes')
      .set('Authorization', `Bearer ${autorToken}`);
    expect(semPermissao.status).toBe(403);
  });

  test('professor_moderador aprova o projeto, que passa a listar na vitrine', async () => {
    const { token: professorToken } = await criarProfessor({ email: 'professor.projeto1@ifsp.edu.br' });
    const res = await request(app)
      .patch(`/api/campanhas/${campanhaId}/moderar`)
      .set('Authorization', `Bearer ${professorToken}`)
      .send({ status: 'ativa' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ativa');

    const vitrinePublica = await request(app).get('/api/campanhas');
    expect(vitrinePublica.body.find((c) => c.id === campanhaId)).toBeDefined();
  });

  test('projeto já aprovado não pode mais ser editado pelo autor', async () => {
    const res = await request(app)
      .put(`/api/campanhas/${campanhaId}`)
      .set('Authorization', `Bearer ${autorToken}`)
      .send({ titulo: 'Tentando editar depois de aprovado' });
    expect(res.status).toBe(403);
  });
});

describe('Doações — POST /api/doacoes/:campaignId', () => {
  let campanhaId;
  let apoiadorToken;

  beforeAll(async () => {
    const autorToken = await registrarEstudante('estudante.doacao@escola.edu.br');
    const criacao = await request(app)
      .post('/api/campanhas')
      .set('Authorization', `Bearer ${autorToken}`)
      .send({ titulo: 'Projeto para doação', descricao: 'x', metaFinanceira: 100 });
    campanhaId = criacao.body.id;

    const { token: professorToken } = await criarProfessor({ email: 'professor.doacao@ifsp.edu.br' });
    await request(app)
      .patch(`/api/campanhas/${campanhaId}/moderar`)
      .set('Authorization', `Bearer ${professorToken}`)
      .send({ status: 'ativa' });

    apoiadorToken = await registrarEstudante('estudante.apoiador@escola.edu.br');
  });

  test('exige autenticação para doar', async () => {
    const res = await request(app).post(`/api/doacoes/${campanhaId}`).send({ valor: 50 });
    expect(res.status).toBe(401);
  });

  test('rejeita valor de doação inválido', async () => {
    const res = await request(app)
      .post(`/api/doacoes/${campanhaId}`)
      .set('Authorization', `Bearer ${apoiadorToken}`)
      .send({ valor: 0 });
    expect(res.status).toBe(400);
  });

  test('registra doação e atualiza o total arrecadado da campanha', async () => {
    const res = await request(app)
      .post(`/api/doacoes/${campanhaId}`)
      .set('Authorization', `Bearer ${apoiadorToken}`)
      .send({ valor: 60, mensagemApoio: 'Boa sorte com o projeto!' });
    expect(res.status).toBe(201);

    const campanha = await request(app).get(`/api/campanhas/${campanhaId}`);
    expect(Number(campanha.body.valorArrecadado)).toBe(60);
    expect(campanha.body.status).toBe('ativa');
  });

  test('quando o total arrecadado atinge a meta, a campanha muda para financiada', async () => {
    await request(app)
      .post(`/api/doacoes/${campanhaId}`)
      .set('Authorization', `Bearer ${apoiadorToken}`)
      .send({ valor: 40 });

    const campanha = await request(app).get(`/api/campanhas/${campanhaId}`);
    expect(Number(campanha.body.valorArrecadado)).toBe(100);
    expect(campanha.body.status).toBe('financiada');
  });
});
