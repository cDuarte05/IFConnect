const { Category } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

// Lista todas as categorias — usado para popular filtros de busca e os
// formulários de publicação/projeto. Pública, sem autenticação.
exports.listar = asyncHandler(async (req, res) => {
  const categorias = await Category.findAll({ order: [['nome', 'ASC']] });
  res.json(categorias);
});

// Criação de categoria é uma ação administrativa/de taxonomia, não prevista
// para autocadastro público na documentação — por isso fica restrita a
// professor_moderador, no mesmo espírito de quem já modera conteúdo.
exports.criar = asyncHandler(async (req, res) => {
  const { nome, descricao } = req.body;
  const existente = await Category.findOne({ where: { nome } });
  if (existente) {
    return res.status(409).json({ erro: true, mensagem: 'Já existe uma categoria com esse nome' });
  }
  const categoria = await Category.create({ nome, descricao });
  res.status(201).json(categoria);
});
