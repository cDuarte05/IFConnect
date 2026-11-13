const request = require('supertest');
require('./setup');
const app = require('../src/app');
const { Comment } = require('../src/models');
const { criarProfessor } = require('./helpers');

let estudante1Token; // Autor do artigo/projeto
let estudante2Token; // Autor do comentário
let estudante3Token; // Terceiro usuário (sem permissão)
let artigoId;
let campanhaId;

async function registrar(email) {
  const res = await request(app).post('/api/auth/registrar').send({
    nome: 'Usuário Teste',
    email,
    senha: 'senhaForte123',
    tipo: 'estudante',
  });
  return res.body;
}

beforeAll(async () => {
  const u1 = await registrar(`autor.post.${Date.now()}@teste.com`);
  estudante1Token = u1.token;

  const u2 = await registrar(`autor.comentario.${Date.now()}@teste.com`);
  estudante2Token = u2.token;

  const u3 = await registrar(`outro.usuario.${Date.now()}@teste.com`);
  estudante3Token = u3.token;

  // Criar publicação pelo estudante 1
  const artRes = await request(app)
    .post('/api/artigos')
    .set('Authorization', `Bearer ${estudante1Token}`)
    .send({
      titulo: 'Publicação sobre Astronomia',
      resumo: 'Resumo sobre telescópios e observações',
      conteudo: 'Conteúdo científico detalhado sobre telescópios',
      tipo: 'artigo_cientifico',
    });
  artigoId = artRes.body.id;

  // Criar projeto / campanha pelo estudante 1
  const campRes = await request(app)
    .post('/api/campanhas')
    .set('Authorization', `Bearer ${estudante1Token}`)
    .send({
      titulo: 'Construção de Robô Seguidor de Linha',
      descricao: 'Projeto de robótica para feira estudantil',
      metaFinanceira: 1500,
    });
  campanhaId = campRes.body.id;
});

describe('Sistema de Comentários — Criação e Leitura', () => {
  test('exige autenticação para criar comentário', async () => {
    const res = await request(app)
      .post(`/api/artigos/${artigoId}/comentarios`)
      .send({ conteudo: 'Tentando comentar sem login' });
    expect(res.status).toBe(401);
  });

  test('rejeita comentário com conteúdo vazio', async () => {
    const res = await request(app)
      .post(`/api/artigos/${artigoId}/comentarios`)
      .set('Authorization', `Bearer ${estudante2Token}`)
      .send({ conteudo: '    ' });
    expect(res.status).toBe(400);
  });

  test('usuário autenticado cria comentário em publicação', async () => {
    const res = await request(app)
      .post(`/api/artigos/${artigoId}/comentarios`)
      .set('Authorization', `Bearer ${estudante2Token}`)
      .send({ conteudo: 'Excelente artigo sobre astronomia!' });

    expect(res.status).toBe(201);
    expect(res.body.conteudo).toBe('Excelente artigo sobre astronomia!');
    expect(res.body.autor).toBeDefined();
    expect(res.body.autor.nome).toBe('Usuário Teste');
  });

  test('usuário autenticado cria comentário em projeto (campanha)', async () => {
    const res = await request(app)
      .post(`/api/campanhas/${campanhaId}/comentarios`)
      .set('Authorization', `Bearer ${estudante2Token}`)
      .send({ conteudo: 'Projeto incrível, parabéns à equipe!' });

    expect(res.status).toBe(201);
    expect(res.body.conteudo).toBe('Projeto incrível, parabéns à equipe!');
    expect(res.body.autor).toBeDefined();
  });

  test('lista comentários de publicação', async () => {
    const res = await request(app).get(`/api/artigos/${artigoId}/comentarios`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].conteudo).toBe('Excelente artigo sobre astronomia!');
  });

  test('lista comentários de projeto', async () => {
    const res = await request(app).get(`/api/campanhas/${campanhaId}/comentarios`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].conteudo).toBe('Projeto incrível, parabéns à equipe!');
  });
});

describe('Sistema de Comentários — Edição (limite de 15 minutos)', () => {
  let comentarioId;

  beforeEach(async () => {
    const res = await request(app)
      .post(`/api/artigos/${artigoId}/comentarios`)
      .set('Authorization', `Bearer ${estudante2Token}`)
      .send({ conteudo: 'Comentário original para teste de edição' });
    comentarioId = res.body.id;
  });

  test('autor do comentário edita dentro de 15 minutos com sucesso', async () => {
    const res = await request(app)
      .put(`/api/comentarios/${comentarioId}`)
      .set('Authorization', `Bearer ${estudante2Token}`)
      .send({ conteudo: 'Comentário editado com sucesso dentro do prazo' });

    expect(res.status).toBe(200);
    expect(res.body.conteudo).toBe('Comentário editado com sucesso dentro do prazo');
    expect(res.body.editado).toBe(true);
  });

  test('outro usuário não pode editar o comentário', async () => {
    const res = await request(app)
      .put(`/api/comentarios/${comentarioId}`)
      .set('Authorization', `Bearer ${estudante3Token}`)
      .send({ conteudo: 'Tentativa de alteração indevida' });

    expect(res.status).toBe(403);
    expect(res.body.mensagem).toMatch(/Apenas a pessoa que escreveu o comentário/i);
  });

  test('autor do post não pode editar comentário de outro usuário', async () => {
    const res = await request(app)
      .put(`/api/comentarios/${comentarioId}`)
      .set('Authorization', `Bearer ${estudante1Token}`)
      .send({ conteudo: 'Autor do post tentando alterar texto de outro' });

    expect(res.status).toBe(403);
    expect(res.body.mensagem).toMatch(/Apenas a pessoa que escreveu o comentário/i);
  });

  test('autor não pode editar comentário após 15 minutos', async () => {
    // Simula comentário criado há 16 minutos
    const dezesseisMinutosAtras = new Date(Date.now() - 16 * 60 * 1000);
    await Comment.update(
      { createdAt: dezesseisMinutosAtras },
      { where: { id: comentarioId }, silent: true }
    );

    const res = await request(app)
      .put(`/api/comentarios/${comentarioId}`)
      .set('Authorization', `Bearer ${estudante2Token}`)
      .send({ conteudo: 'Tentando editar após prazo expirado' });

    expect(res.status).toBe(403);
    expect(res.body.mensagem).toMatch(/em até 15 minutos/i);
  });
});

describe('Sistema de Comentários — Exclusão', () => {
  test('autor do post que recebeu os comentários pode excluir qualquer comentário', async () => {
    // Estudante 2 comenta no artigo do Estudante 1
    const criacao = await request(app)
      .post(`/api/artigos/${artigoId}/comentarios`)
      .set('Authorization', `Bearer ${estudante2Token}`)
      .send({ conteudo: 'Comentário a ser moderado pelo autor do artigo' });
    const id = criacao.body.id;

    // Estudante 1 (autor do artigo) exclui o comentário
    const res = await request(app)
      .delete(`/api/comentarios/${id}`)
      .set('Authorization', `Bearer ${estudante1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);

    const check = await Comment.findByPk(id);
    expect(check).toBeNull();
  });

  test('autor do projeto que recebeu os comentários pode excluir qualquer comentário', async () => {
    // Estudante 2 comenta no projeto do Estudante 1
    const criacao = await request(app)
      .post(`/api/campanhas/${campanhaId}/comentarios`)
      .set('Authorization', `Bearer ${estudante2Token}`)
      .send({ conteudo: 'Comentário no projeto a ser moderado pelo autor do projeto' });
    const id = criacao.body.id;

    // Estudante 1 (autor do projeto) exclui o comentário
    const res = await request(app)
      .delete(`/api/comentarios/${id}`)
      .set('Authorization', `Bearer ${estudante1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);

    const check = await Comment.findByPk(id);
    expect(check).toBeNull();
  });

  test('a pessoa que escreveu o comentário pode apagar a qualquer momento (mesmo após 15 minutos)', async () => {
    const criacao = await request(app)
      .post(`/api/artigos/${artigoId}/comentarios`)
      .set('Authorization', `Bearer ${estudante2Token}`)
      .send({ conteudo: 'Comentário antigo que o autor decide apagar' });
    const id = criacao.body.id;

    // Simula comentário criado há 3 dias
    const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await Comment.update(
      { createdAt: tresDiasAtras },
      { where: { id }, silent: true }
    );

    // Estudante 2 apaga seu próprio comentário
    const res = await request(app)
      .delete(`/api/comentarios/${id}`)
      .set('Authorization', `Bearer ${estudante2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);

    const check = await Comment.findByPk(id);
    expect(check).toBeNull();
  });

  test('usuário terceiro que não é autor do comentário nem do post NÃO pode excluir', async () => {
    const criacao = await request(app)
      .post(`/api/artigos/${artigoId}/comentarios`)
      .set('Authorization', `Bearer ${estudante2Token}`)
      .send({ conteudo: 'Comentário protegido de terceiros' });
    const id = criacao.body.id;

    // Estudante 3 tenta apagar
    const res = await request(app)
      .delete(`/api/comentarios/${id}`)
      .set('Authorization', `Bearer ${estudante3Token}`);

    expect(res.status).toBe(403);
    expect(res.body.mensagem).toMatch(/não tem permissão/i);

    const check = await Comment.findByPk(id);
    expect(check).not.toBeNull();
  });

  test('professor_moderador pode excluir qualquer comentário como moderação', async () => {
    const { token: professorToken } = await criarProfessor({ email: 'prof.mod.comentarios@ifsp.edu.br' });

    const criacao = await request(app)
      .post(`/api/artigos/${artigoId}/comentarios`)
      .set('Authorization', `Bearer ${estudante2Token}`)
      .send({ conteudo: 'Comentário com conteúdo ofensivo' });
    const id = criacao.body.id;

    const res = await request(app)
      .delete(`/api/comentarios/${id}`)
      .set('Authorization', `Bearer ${professorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);

    const check = await Comment.findByPk(id);
    expect(check).toBeNull();
  });
});

describe('Sistema de Comentários — Stream em Tempo Real (SSE)', () => {
  test('retorna 404 se a publicação para o stream não existir', async () => {
    const res = await request(app).get('/api/artigos/00000000-0000-0000-0000-000000000000/comentarios/stream');
    expect(res.status).toBe(404);
  });

  test('abre stream SSE com Content-Type text/event-stream e evento conectado', (done) => {
    const http = require('http');
    const server = app.listen(0, () => {
      const port = server.address().port;
      const clientReq = http.get(`http://127.0.0.1:${port}/api/artigos/${artigoId}/comentarios/stream`, (res) => {
        expect(res.headers['content-type']).toMatch(/text\/event-stream/);
        res.on('data', (chunk) => {
          const str = chunk.toString();
          if (str.includes('event: conectado')) {
            clientReq.destroy();
            server.close(done);
          }
        });
      });
      clientReq.on('error', () => {
        // Encerramento esperado do socket ao término do teste
      });
    });
  });
});
