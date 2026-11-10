const { Comment, Article, Campaign, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const commentSseService = require('../services/commentSseService');

const INCLUDE_AUTOR = [
  { model: User, as: 'autor', attributes: ['id', 'nome', 'tipo', 'instituicao'] },
];

const LIMITE_EDICAO_MS = 15 * 60 * 1000; // 15 minutos

// Conecta o cliente ao fluxo SSE em tempo real para um artigo
exports.streamArtigo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const artigo = await Article.findByPk(id);
  if (!artigo) {
    return res.status(404).json({ erro: true, mensagem: 'Publicação não encontrada' });
  }

  commentSseService.adicionarCliente(`artigo:${id}`, req, res);
});

// Conecta o cliente ao fluxo SSE em tempo real para uma campanha/projeto
exports.streamCampanha = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const campanha = await Campaign.findByPk(id);
  if (!campanha) {
    return res.status(404).json({ erro: true, mensagem: 'Projeto não encontrado' });
  }

  commentSseService.adicionarCliente(`campanha:${id}`, req, res);
});

// Lista comentários de um artigo
exports.listarPorArtigo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const artigo = await Article.findByPk(id);
  if (!artigo) {
    return res.status(404).json({ erro: true, mensagem: 'Publicação não encontrada' });
  }

  const comentarios = await Comment.findAll({
    where: { articleId: id },
    include: INCLUDE_AUTOR,
    order: [['createdAt', 'ASC']],
  });

  res.json(comentarios);
});

// Adiciona comentário em um artigo
exports.criarPorArtigo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { conteudo } = req.body;

  const artigo = await Article.findByPk(id);
  if (!artigo) {
    return res.status(404).json({ erro: true, mensagem: 'Publicação não encontrada' });
  }

  const comentarioCriado = await Comment.create({
    conteudo,
    autorId: req.usuario.id,
    articleId: id,
  });

  const comentario = await Comment.findByPk(comentarioCriado.id, {
    include: INCLUDE_AUTOR,
  });

  // Emite evento SSE para todos os clientes visualizando o artigo
  commentSseService.emitirEvento(`artigo:${id}`, 'novo_comentario', comentario);

  res.status(201).json(comentario);
});

// Lista comentários de uma campanha/projeto
exports.listarPorCampanha = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const campanha = await Campaign.findByPk(id);
  if (!campanha) {
    return res.status(404).json({ erro: true, mensagem: 'Projeto não encontrado' });
  }

  const comentarios = await Comment.findAll({
    where: { campaignId: id },
    include: INCLUDE_AUTOR,
    order: [['createdAt', 'ASC']],
  });

  res.json(comentarios);
});

// Adiciona comentário em uma campanha/projeto
exports.criarPorCampanha = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { conteudo } = req.body;

  const campanha = await Campaign.findByPk(id);
  if (!campanha) {
    return res.status(404).json({ erro: true, mensagem: 'Projeto não encontrado' });
  }

  const comentarioCriado = await Comment.create({
    conteudo,
    autorId: req.usuario.id,
    campaignId: id,
  });

  const comentario = await Comment.findByPk(comentarioCriado.id, {
    include: INCLUDE_AUTOR,
  });

  // Emite evento SSE para todos os clientes visualizando o projeto
  commentSseService.emitirEvento(`campanha:${id}`, 'novo_comentario', comentario);

  res.status(201).json(comentario);
});

// Edita comentário — apenas o autor do comentário, no máximo 15 minutos após a postagem
exports.atualizar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { conteudo } = req.body;

  const comentario = await Comment.findByPk(id, { include: INCLUDE_AUTOR });
  if (!comentario) {
    return res.status(404).json({ erro: true, mensagem: 'Comentário não encontrado' });
  }

  if (comentario.autorId !== req.usuario.id) {
    return res.status(403).json({
      erro: true,
      mensagem: 'Apenas a pessoa que escreveu o comentário pode editá-lo',
    });
  }

  const tempoDecorrido = Date.now() - new Date(comentario.createdAt).getTime();
  if (tempoDecorrido > LIMITE_EDICAO_MS) {
    return res.status(403).json({
      erro: true,
      mensagem: 'Comentários só podem ser editados em até 15 minutos após a publicação',
    });
  }

  comentario.conteudo = conteudo;
  comentario.editado = true;
  await comentario.save();

  // Emite evento SSE de edição
  const canal = comentario.articleId
    ? `artigo:${comentario.articleId}`
    : `campanha:${comentario.campaignId}`;
  commentSseService.emitirEvento(canal, 'comentario_editado', comentario);

  res.json(comentario);
});

// Exclui comentário — autor do comentário a qualquer momento, OU autor do post que recebeu o comentário, OU moderador
exports.excluir = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const comentario = await Comment.findByPk(id, {
    include: [
      { model: Article, as: 'artigo', attributes: ['id', 'autorId'] },
      { model: Campaign, as: 'campanha', attributes: ['id', 'autorId'] },
    ],
  });

  if (!comentario) {
    return res.status(404).json({ erro: true, mensagem: 'Comentário não encontrado' });
  }

  const ehAutorDoComentario = req.usuario.id === comentario.autorId;
  const ehAutorDoPost =
    (comentario.artigo && comentario.artigo.autorId === req.usuario.id) ||
    (comentario.campanha && comentario.campanha.autorId === req.usuario.id);
  const ehModerador = req.usuario.tipo === 'professor_moderador';

  if (!ehAutorDoComentario && !ehAutorDoPost && !ehModerador) {
    return res.status(403).json({
      erro: true,
      mensagem: 'Você não tem permissão para excluir este comentário',
    });
  }

  const canal = comentario.articleId
    ? `artigo:${comentario.articleId}`
    : `campanha:${comentario.campaignId}`;
  const comentarioIdExcluido = comentario.id;

  await comentario.destroy();

  // Emite evento SSE de exclusão
  commentSseService.emitirEvento(canal, 'comentario_excluido', { id: comentarioIdExcluido });

  res.json({ sucesso: true, mensagem: 'Comentário excluído com sucesso' });
});
