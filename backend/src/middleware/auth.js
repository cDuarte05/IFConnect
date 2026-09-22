const jwt = require('jsonwebtoken');

// Middleware de autenticação: exige um token JWT válido no header Authorization
function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erro: true, mensagem: 'Token não informado' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, tipo }
    next();
  } catch (e) {
    return res.status(401).json({ erro: true, mensagem: 'Token inválido ou expirado' });
  }
}

// Middleware de autorização: restringe a uma lista de tipos de usuário (ex: moderação por professores)
function permitir(...tipos) {
  return (req, res, next) => {
    if (!req.usuario || !tipos.includes(req.usuario.tipo)) {
      return res.status(403).json({ erro: true, mensagem: 'Acesso não autorizado para este perfil' });
    }
    next();
  };
}

module.exports = { autenticar, permitir };
