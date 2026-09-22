const jwt = require('jsonwebtoken');
const { User } = require('../src/models');

// Contas de professor_moderador não podem mais ser criadas via API pública
// (correção de segurança). Nos testes, criamos direto pelo model — o mesmo
// caminho que um script administrativo (ex.: seed.js) usaria na vida real.
async function criarProfessor({ nome = 'Professora Teste', email, instituicao = 'IFSP' } = {}) {
  const usuario = await User.create({
    nome,
    email: email || `professor.${Date.now()}.${Math.random().toString(36).slice(2)}@ifsp.edu.br`,
    senhaHash: User.hashSenha('senhaProfessor123'),
    tipo: 'professor_moderador',
    instituicao,
  });
  const token = jwt.sign(
    { id: usuario.id, tipo: usuario.tipo, nome: usuario.nome },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return { usuario, token };
}

module.exports = { criarProfessor };
