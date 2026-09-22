const { Campaign, User, Donation, Category } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

exports.listar = asyncHandler(async (req, res) => {
  const { categoryId, tema, busca } = req.query;
  const where = { status: 'ativa' };
  if (categoryId) where.categoryId = categoryId;
  if (tema) where.tema = tema;

  const campanhas = await Campaign.findAll({
    where,
    include: [
      { model: User, as: 'autor', attributes: ['id', 'nome', 'instituicao'] },
      { model: Category, as: 'categoria' },
    ],
    order: [['createdAt', 'DESC']],
  });

  const filtradas = busca
    ? campanhas.filter(
        (c) =>
          c.titulo.toLowerCase().includes(busca.toLowerCase()) ||
          (c.palavrasChave || '').toLowerCase().includes(busca.toLowerCase())
      )
    : campanhas;

  res.json(filtradas);
});

exports.obterPorId = asyncHandler(async (req, res) => {
  const campanha = await Campaign.findByPk(req.params.id, {
    include: [
      { model: User, as: 'autor', attributes: ['id', 'nome', 'instituicao'] },
      { model: Category, as: 'categoria' },
      { model: Donation, as: 'doacoes', include: [{ model: User, as: 'apoiador', attributes: ['nome'] }] },
    ],
  });
  if (!campanha) return res.status(404).json({ erro: true, mensagem: 'Campanha não encontrada' });
  res.json(campanha);
});

exports.criar = asyncHandler(async (req, res) => {
  const { titulo, descricao, categoryId, tema, palavrasChave, metaFinanceira, imagemCapaUrl, prazoFinal } = req.body;
  if (!titulo || !descricao || !metaFinanceira) {
    return res.status(400).json({ erro: true, mensagem: 'Campos obrigatórios ausentes' });
  }
  const campanha = await Campaign.create({
    titulo,
    descricao,
    categoryId: categoryId || null,
    tema: tema || null,
    palavrasChave,
    metaFinanceira,
    imagemCapaUrl,
    prazoFinal,
    autorId: req.usuario.id,
    status: 'em_analise', // entra em análise antes de ficar visível na vitrine
  });
  res.status(201).json(campanha);
});

exports.minhasCampanhas = asyncHandler(async (req, res) => {
  const campanhas = await Campaign.findAll({
    where: { autorId: req.usuario.id },
    include: [{ model: Category, as: 'categoria' }],
    order: [['createdAt', 'DESC']],
  });
  res.json(campanhas);
});

// Fila de moderação: projetos aguardando aprovação de um professor_moderador.
exports.pendentes = asyncHandler(async (req, res) => {
  const campanhas = await Campaign.findAll({
    where: { status: 'em_analise' },
    include: [
      { model: User, as: 'autor', attributes: ['id', 'nome', 'instituicao'] },
      { model: Category, as: 'categoria' },
    ],
    order: [['createdAt', 'ASC']],
  });
  res.json(campanhas);
});

// Edição: só o próprio autor, e só enquanto o projeto ainda não foi aprovado
// (status 'em_analise'). Depois de ativo/financiado/encerrado, já pode ter
// doações associadas — editar dados como a meta financeira nesse ponto
// exigiria uma regra própria não definida na documentação, então não é permitido.
exports.atualizar = asyncHandler(async (req, res) => {
  const campanha = await Campaign.findByPk(req.params.id);
  if (!campanha) return res.status(404).json({ erro: true, mensagem: 'Campanha não encontrada' });
  if (campanha.autorId !== req.usuario.id) {
    return res.status(403).json({ erro: true, mensagem: 'Você só pode editar seus próprios projetos' });
  }
  if (campanha.status !== 'em_analise') {
    return res.status(403).json({ erro: true, mensagem: 'Projetos já avaliados não podem mais ser editados' });
  }

  const { titulo, descricao, categoryId, tema, palavrasChave, metaFinanceira, imagemCapaUrl, prazoFinal } = req.body;
  if (titulo !== undefined) campanha.titulo = titulo;
  if (descricao !== undefined) campanha.descricao = descricao;
  if (categoryId !== undefined) campanha.categoryId = categoryId || null;
  if (tema !== undefined) campanha.tema = tema || null;
  if (palavrasChave !== undefined) campanha.palavrasChave = palavrasChave;
  if (metaFinanceira !== undefined) campanha.metaFinanceira = metaFinanceira;
  if (imagemCapaUrl !== undefined) campanha.imagemCapaUrl = imagemCapaUrl;
  if (prazoFinal !== undefined) campanha.prazoFinal = prazoFinal;

  await campanha.save();
  res.json(campanha);
});

exports.moderar = asyncHandler(async (req, res) => {
  const { status } = req.body; // ativa | encerrada
  const campanha = await Campaign.findByPk(req.params.id);
  if (!campanha) return res.status(404).json({ erro: true, mensagem: 'Campanha não encontrada' });
  campanha.status = status;
  await campanha.save();
  res.json(campanha);
});
