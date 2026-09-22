const request = require('supertest');
require('./setup');
const app = require('../src/app');
const { criarProfessor } = require('./helpers');

async function registrarEstudante(email) {
  const res = await request(app).post('/api/auth/registrar').send({
    nome: 'Estudante Artigo',
    email,
    senha: 'senha123',
    tipo: 'estudante',
  });
  return { token: res.body.token, usuario: res.body.usuario };
}

describe('Publicações — POST /api/artigos', () => {
  test('estudante cria publicação e ela entra em revisão (não fica pública direto)', async () => {
    const { token } = await registrarEstudante('estudante.artigo1@escola.edu.br');
    const res = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: 'Feira de ciências do 3º ano',
        resumo: 'Um resumo curto sobre a feira.',
        conteudo: 'Conteúdo completo da publicação.',
        tipo: 'noticia_escolar',
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('em_revisao');

    const listaPublica = await request(app).get('/api/artigos');
    expect(listaPublica.body.find((a) => a.id === res.body.id)).toBeUndefined();
  });

  test('professor_moderador cria publicação e ela já sai publicada', async () => {
    const { token } = await criarProfessor({ email: 'professor.publica@ifsp.edu.br' });
    const res = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: 'Comunicado da coordenação',
        resumo: 'Resumo do comunicado.',
        conteudo: 'Conteúdo do comunicado.',
        tipo: 'noticia_global',
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('publicado');
  });

  test('exige autenticação para publicar', async () => {
    const res = await request(app).post('/api/artigos').send({
      titulo: 'Sem login',
      resumo: 'x',
      conteudo: 'x',
      tipo: 'texto',
    });
    expect(res.status).toBe(401);
  });

  test('rejeita tipo de publicação inválido', async () => {
    const { token } = await registrarEstudante('estudante.tipoinvalido@escola.edu.br');
    const res = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: 'x', resumo: 'x', conteudo: 'x', tipo: 'tipo_que_nao_existe' });
    expect(res.status).toBe(400);
  });
});

describe('Publicações — edição e moderação', () => {
  let autorToken;
  let artigoId;

  beforeAll(async () => {
    const { token } = await registrarEstudante('estudante.edicao@escola.edu.br');
    autorToken = token;
    const res = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${autorToken}`)
      .send({ titulo: 'Original', resumo: 'Resumo original', conteudo: 'Conteúdo original', tipo: 'texto' });
    artigoId = res.body.id;
  });

  test('outro usuário não pode editar a publicação', async () => {
    const { token: outroToken } = await registrarEstudante('estudante.intruso@escola.edu.br');
    const res = await request(app)
      .put(`/api/artigos/${artigoId}`)
      .set('Authorization', `Bearer ${outroToken}`)
      .send({ titulo: 'Alterado por outro' });
    expect(res.status).toBe(403);
  });

  test('autor pode editar sua publicação em revisão', async () => {
    const res = await request(app)
      .put(`/api/artigos/${artigoId}`)
      .set('Authorization', `Bearer ${autorToken}`)
      .send({ titulo: 'Título revisado pelo autor' });
    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe('Título revisado pelo autor');
  });

  test('usuário comum não pode moderar (aprovar) publicações', async () => {
    const res = await request(app)
      .patch(`/api/artigos/${artigoId}/moderar`)
      .set('Authorization', `Bearer ${autorToken}`)
      .send({ status: 'publicado' });
    expect(res.status).toBe(403);
  });

  test('professor_moderador aprova a publicação, que passa a listar publicamente', async () => {
    const { token: professorToken } = await criarProfessor({ email: 'professor.moderador1@ifsp.edu.br' });
    const res = await request(app)
      .patch(`/api/artigos/${artigoId}/moderar`)
      .set('Authorization', `Bearer ${professorToken}`)
      .send({ status: 'publicado' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('publicado');

    const listaPublica = await request(app).get('/api/artigos');
    expect(listaPublica.body.find((a) => a.id === artigoId)).toBeDefined();
  });

  test('autor não pode mais editar a publicação depois de aprovada', async () => {
    const res = await request(app)
      .put(`/api/artigos/${artigoId}`)
      .set('Authorization', `Bearer ${autorToken}`)
      .send({ titulo: 'Tentando editar depois de aprovado' });
    expect(res.status).toBe(403);
  });

  test('fila de moderação (pendentes) é restrita a professor_moderador', async () => {
    const semPermissao = await request(app)
      .get('/api/artigos/moderacao/pendentes')
      .set('Authorization', `Bearer ${autorToken}`);
    expect(semPermissao.status).toBe(403);

    const { token: professorToken } = await criarProfessor({ email: 'professor.fila@ifsp.edu.br' });
    const comPermissao = await request(app)
      .get('/api/artigos/moderacao/pendentes')
      .set('Authorization', `Bearer ${professorToken}`);
    expect(comPermissao.status).toBe(200);
    expect(Array.isArray(comPermissao.body)).toBe(true);
  });
});
