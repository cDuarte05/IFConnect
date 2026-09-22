const { Article, User, Category } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

const INCLUDE_AUTOR_CATEGORIA = [
  { model: User, as: 'autor', attributes: ['id', 'nome', 'tipo', 'instituicao'] },
  { model: Category, as: 'categoria' },
];

// Lista publicações públicas, com filtros opcionais por tipo (formato de
// conteúdo), categoria (assunto), tema e busca textual (título + palavras-chave).
exports.listar = asyncHandler(async (req, res) => {
  const { tipo, categoryId, tema, busca } = req.query;
  const where = { status: 'publicado' };
  if (tipo) where.tipo = tipo;
  if (categoryId) where.categoryId = categoryId;
  if (tema) where.tema = tema;

  const artigos = await Article.findAll({
    where,
    include: INCLUDE_AUTOR_CATEGORIA,
    order: [['createdAt', 'DESC']],
  });

  const filtrados = busca
    ? artigos.filter(
        (a) =>
          a.titulo.toLowerCase().includes(busca.toLowerCase()) ||
          (a.palavrasChave || '').toLowerCase().includes(busca.toLowerCase())
      )
    : artigos;

  res.json(filtrados);
});

exports.obterPorId = asyncHandler(async (req, res) => {
  const artigo = await Article.findByPk(req.params.id, { include: INCLUDE_AUTOR_CATEGORIA });
  if (!artigo) return res.status(404).json({ erro: true, mensagem: 'Publicação não encontrada' });
  artigo.visualizacoes += 1;
  await artigo.save();
  res.json(artigo);
});

exports.criar = asyncHandler(async (req, res) => {
  const { titulo, resumo, conteudo, tipo, categoryId, tema, palavrasChave, imagemCapaUrl } = req.body;
  if (!titulo || !resumo || !conteudo || !tipo) {
    return res.status(400).json({ erro: true, mensagem: 'Campos obrigatórios ausentes' });
  }
  const artigo = await Article.create({
    titulo,
    resumo,
    conteudo,
    tipo,
    categoryId: categoryId || null,
    tema: tema || null,
    palavrasChave,
    imagemCapaUrl,
    autorId: req.usuario.id,
    // professores publicam direto; demais perfis entram em revisão (moderação leve)
    status: req.usuario.tipo === 'professor_moderador' ? 'publicado' : 'em_revisao',
  });
  res.status(201).json(artigo);
});

exports.meusArtigos = asyncHandler(async (req, res) => {
  const artigos = await Article.findAll({
    where: { autorId: req.usuario.id },
    include: [{ model: Category, as: 'categoria' }],
    order: [['createdAt', 'DESC']],
  });
  res.json(artigos);
});

// Fila de moderação: publicações aguardando aprovação de um professor_moderador.
exports.pendentes = asyncHandler(async (req, res) => {
  const artigos = await Article.findAll({
    where: { status: 'em_revisao' },
    include: INCLUDE_AUTOR_CATEGORIA,
    order: [['createdAt', 'ASC']],
  });
  res.json(artigos);
});

// Edição: só o próprio autor pode editar. Uma vez publicada, a publicação já passou
// pela moderação e não pode mais ser editada por este endpoint — evita reabrir o
// conteúdo aprovado sem uma nova revisão. Professores moderadores, que publicam
// direto, também podem seguir editando suas próprias publicações já publicadas.
exports.atualizar = asyncHandler(async (req, res) => {
  const artigo = await Article.findByPk(req.params.id);
  if (!artigo) return res.status(404).json({ erro: true, mensagem: 'Publicação não encontrada' });
  if (artigo.autorId !== req.usuario.id) {
    return res.status(403).json({ erro: true, mensagem: 'Você só pode editar suas próprias publicações' });
  }
  const podeEditarPublicada = req.usuario.tipo === 'professor_moderador';
  if (artigo.status === 'publicado' && !podeEditarPublicada) {
    return res.status(403).json({ erro: true, mensagem: 'Publicações já aprovadas não podem mais ser editadas' });
  }

  const { titulo, resumo, conteudo, tipo, categoryId, tema, palavrasChave, imagemCapaUrl } = req.body;
  if (titulo !== undefined) artigo.titulo = titulo;
  if (resumo !== undefined) artigo.resumo = resumo;
  if (conteudo !== undefined) artigo.conteudo = conteudo;
  if (tipo !== undefined) artigo.tipo = tipo;
  if (categoryId !== undefined) artigo.categoryId = categoryId || null;
  if (tema !== undefined) artigo.tema = tema || null;
  if (palavrasChave !== undefined) artigo.palavrasChave = palavrasChave;
  if (imagemCapaUrl !== undefined) artigo.imagemCapaUrl = imagemCapaUrl;

  // Publicação recusada que o autor edita volta para revisão (resubmissão).
  if (artigo.status === 'recusado') artigo.status = 'em_revisao';

  await artigo.save();
  res.json(artigo);
});

// Moderação: só professor_moderador pode aprovar/recusar publicações
exports.moderar = asyncHandler(async (req, res) => {
  const { status } = req.body; // publicado | recusado
  const artigo = await Article.findByPk(req.params.id);
  if (!artigo) return res.status(404).json({ erro: true, mensagem: 'Publicação não encontrada' });
  artigo.status = status;
  await artigo.save();
  res.json(artigo);
});
