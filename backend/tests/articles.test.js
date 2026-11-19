const request = require('supertest');
require('./setup');
const app = require('../src/app');
const { Article } = require('../src/models');
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
      .send({ titulo: 'Publicação original', resumo: 'Resumo original', conteudo: 'Conteúdo original', tipo: 'texto' });
    expect(res.status).toBe(201);
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

describe('Publicações — exclusão', () => {
  let autorToken;
  let artigoId;

  beforeAll(async () => {
    const { token } = await registrarEstudante('estudante.exclusao@escola.edu.br');
    autorToken = token;
    const res = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${autorToken}`)
      .send({ titulo: 'Publicação para excluir', resumo: 'Resumo', conteudo: 'Conteúdo', tipo: 'texto' });
    artigoId = res.body.id;
  });

  test('exige autenticação para excluir', async () => {
    const res = await request(app).delete(`/api/artigos/${artigoId}`);
    expect(res.status).toBe(401);
  });

  test('outro usuário não pode excluir a publicação', async () => {
    const { token: outroToken } = await registrarEstudante('estudante.exclusaointruso@escola.edu.br');
    const res = await request(app)
      .delete(`/api/artigos/${artigoId}`)
      .set('Authorization', `Bearer ${outroToken}`);
    expect(res.status).toBe(403);
  });

  test('retorna 404 para publicação inexistente', async () => {
    const res = await request(app)
      .delete('/api/artigos/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${autorToken}`);
    expect(res.status).toBe(404);
  });

  test('autor exclui a própria publicação', async () => {
    const res = await request(app)
      .delete(`/api/artigos/${artigoId}`)
      .set('Authorization', `Bearer ${autorToken}`);
    expect(res.status).toBe(204);

    const consulta = await request(app).get(`/api/artigos/${artigoId}`);
    expect(consulta.status).toBe(404);
  });
});

describe('Publicações — visibilidade, visualizações e comentários em não publicadas', () => {
  let autorToken;
  let autorId;
  let outroEstudanteToken;
  let moderadorToken;
  let rascunhoId;
  let emRevisaoId;
  let recusadoId;
  let publicadoId;

  beforeAll(async () => {
    const autor = await registrarEstudante('estudante.vis.autor@escola.edu.br');
    autorToken = autor.token;
    autorId = autor.usuario.id;

    const outro = await registrarEstudante('estudante.vis.outro@escola.edu.br');
    outroEstudanteToken = outro.token;

    const mod = await criarProfessor({ email: 'professor.vis.mod@ifsp.edu.br' });
    moderadorToken = mod.token;

    const rascunho = await Article.create({
      titulo: 'Rascunho de estudo científico',
      resumo: 'Resumo de rascunho',
      conteudo: 'Conteúdo de rascunho privado',
      tipo: 'artigo_cientifico',
      status: 'rascunho',
      autorId,
    });
    rascunhoId = rascunho.id;

    const emRevRes = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${autorToken}`)
      .send({
        titulo: 'Artigo em revisão editorial',
        resumo: 'Resumo em revisão',
        conteudo: 'Conteúdo aguardando revisão',
        tipo: 'noticia_escolar',
      });
    emRevisaoId = emRevRes.body.id;

    const recRes = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${autorToken}`)
      .send({
        titulo: 'Artigo que será recusado',
        resumo: 'Resumo recusado',
        conteudo: 'Conteúdo recusado na revisão',
        tipo: 'texto',
      });
    recusadoId = recRes.body.id;
    await request(app)
      .patch(`/api/artigos/${recusadoId}/moderar`)
      .set('Authorization', `Bearer ${moderadorToken}`)
      .send({ status: 'recusado' });

    const pubRes = await request(app)
      .post('/api/artigos')
      .set('Authorization', `Bearer ${autorToken}`)
      .send({
        titulo: 'Artigo publicado para todos',
        resumo: 'Resumo público',
        conteudo: 'Conteúdo visível publicamente',
        tipo: 'artigo_cientifico',
      });
    publicadoId = pubRes.body.id;
    await request(app)
      .patch(`/api/artigos/${publicadoId}/moderar`)
      .set('Authorization', `Bearer ${moderadorToken}`)
      .send({ status: 'publicado' });

    // Comentário pré-existente criado pelo próprio autor em item não publicado
    await request(app)
      .post(`/api/artigos/${emRevisaoId}/comentarios`)
      .set('Authorization', `Bearer ${autorToken}`)
      .send({ conteudo: 'Nota do autor durante a revisão' });
  });

  test('visitante recebe 404 com mensagem padrão para rascunho, em_revisao e recusado', async () => {
    for (const id of [rascunhoId, emRevisaoId, recusadoId]) {
      const res = await request(app).get(`/api/artigos/${id}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ erro: true, mensagem: 'Publicação não encontrada' });
    }
  });

  test('outro estudante recebe 404 para rascunho, em_revisao e recusado', async () => {
    for (const id of [rascunhoId, emRevisaoId, recusadoId]) {
      const res = await request(app)
        .get(`/api/artigos/${id}`)
        .set('Authorization', `Bearer ${outroEstudanteToken}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ erro: true, mensagem: 'Publicação não encontrada' });
    }
  });

  test('autor recebe 200 para rascunho, em_revisao e recusado sem incrementar visualizacoes', async () => {
    for (const id of [rascunhoId, emRevisaoId, recusadoId]) {
      const res = await request(app)
        .get(`/api/artigos/${id}`)
        .set('Authorization', `Bearer ${autorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.visualizacoes).toBe(0);
    }
  });

  test('professor_moderador recebe 200 para rascunho, em_revisao e recusado sem incrementar visualizacoes', async () => {
    for (const id of [rascunhoId, emRevisaoId, recusadoId]) {
      const res = await request(app)
        .get(`/api/artigos/${id}`)
        .set('Authorization', `Bearer ${moderadorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.visualizacoes).toBe(0);
    }
  });

  test('publicação publicada devolve 200 para todos e incrementa visualizacoes apenas quando publicada', async () => {
    const resVisitante = await request(app).get(`/api/artigos/${publicadoId}`);
    expect(resVisitante.status).toBe(200);
    expect(resVisitante.body.visualizacoes).toBe(1);

    const resOutro = await request(app)
      .get(`/api/artigos/${publicadoId}`)
      .set('Authorization', `Bearer ${outroEstudanteToken}`);
    expect(resOutro.status).toBe(200);
    expect(resOutro.body.visualizacoes).toBe(2);

    const resAutor = await request(app)
      .get(`/api/artigos/${publicadoId}`)
      .set('Authorization', `Bearer ${autorToken}`);
    expect(resAutor.status).toBe(200);
    expect(resAutor.body.visualizacoes).toBe(3);

    const resMod = await request(app)
      .get(`/api/artigos/${publicadoId}`)
      .set('Authorization', `Bearer ${moderadorToken}`);
    expect(resMod.status).toBe(200);
    expect(resMod.body.visualizacoes).toBe(4);
  });

  test('comentários de publicação não publicada seguem a mesma regra de visibilidade', async () => {
    for (const id of [rascunhoId, emRevisaoId, recusadoId]) {
      const visLista = await request(app).get(`/api/artigos/${id}/comentarios`);
      expect(visLista.status).toBe(404);

      const visStream = await request(app).get(`/api/artigos/${id}/comentarios/stream`);
      expect(visStream.status).toBe(404);

      const outroLista = await request(app)
        .get(`/api/artigos/${id}/comentarios`)
        .set('Authorization', `Bearer ${outroEstudanteToken}`);
      expect(outroLista.status).toBe(404);

      const outroComenta = await request(app)
        .post(`/api/artigos/${id}/comentarios`)
        .set('Authorization', `Bearer ${outroEstudanteToken}`)
        .send({ conteudo: 'Tentando comentar em artigo não publicado' });
      expect(outroComenta.status).toBe(404);

      const autorLista = await request(app)
        .get(`/api/artigos/${id}/comentarios`)
        .set('Authorization', `Bearer ${autorToken}`);
      expect(autorLista.status).toBe(200);

      const modLista = await request(app)
        .get(`/api/artigos/${id}/comentarios`)
        .set('Authorization', `Bearer ${moderadorToken}`);
      expect(modLista.status).toBe(200);
    }

    const pubLista = await request(app).get(`/api/artigos/${publicadoId}/comentarios`);
    expect(pubLista.status).toBe(200);
  });
});