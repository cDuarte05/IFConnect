const jwt = require('jsonwebtoken');
const { User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, tipo: usuario.tipo, nome: usuario.nome },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// Perfis que podem ser escolhidos livremente no cadastro público. 'professor_moderador'
// concede poder de moderação (aprovar/recusar publicações e projetos de terceiros) e por
// isso não pode ser autoatribuído por quem se cadastra — precisa ser concedido por outra via
// (ex.: promoção administrativa), que ainda não está definida na documentação do projeto.
const TIPOS_AUTOCADASTRO = ['estudante', 'jornalista_jovem', 'membro_comunidade'];

exports.registrar = asyncHandler(async (req, res) => {
  const { nome, email, senha, tipo, instituicao } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: true, mensagem: 'Nome, email e senha são obrigatórios' });
  }
  if (tipo && !TIPOS_AUTOCADASTRO.includes(tipo)) {
    return res.status(400).json({
      erro: true,
      mensagem: 'Perfil inválido para autocadastro. Escolha: estudante, jornalista_jovem ou membro_comunidade.',
    });
  }
  const existente = await User.findOne({ where: { email } });
  if (existente) {
    return res.status(409).json({ erro: true, mensagem: 'Já existe uma conta com este email' });
  }
  const usuario = await User.create({
    nome,
    email,
    senhaHash: User.hashSenha(senha),
    tipo: tipo || 'estudante',
    instituicao,
  });
  const token = gerarToken(usuario);
  res.status(201).json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo },
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, senha } = req.body;
  const usuario = await User.findOne({ where: { email } });
  if (!usuario || !usuario.verificarSenha(senha)) {
    return res.status(401).json({ erro: true, mensagem: 'Email ou senha inválidos' });
  }
  const token = gerarToken(usuario);
  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo },
  });
});

exports.perfil = asyncHandler(async (req, res) => {
  const usuario = await User.findByPk(req.usuario.id, {
    attributes: { exclude: ['senhaHash'] },
  });
  res.json(usuario);
});

// Atualiza dados de perfil do próprio usuário. Não permite alterar email, senha ou
// tipo por esta rota — cada um desses campos tem implicações (login, autorização)
// que merecem um fluxo próprio, fora do escopo desta correção.
exports.atualizarPerfil = asyncHandler(async (req, res) => {
  const { nome, instituicao, bio } = req.body;
  const usuario = await User.findByPk(req.usuario.id);
  if (!usuario) return res.status(404).json({ erro: true, mensagem: 'Usuário não encontrado' });

  if (nome !== undefined) usuario.nome = nome;
  if (instituicao !== undefined) usuario.instituicao = instituicao;
  if (bio !== undefined) usuario.bio = bio;
  await usuario.save();

  const { senhaHash, ...usuarioSemSenha } = usuario.toJSON();
  res.json(usuarioSemSenha);
});
