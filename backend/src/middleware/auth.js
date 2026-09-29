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


// Middleware de autenticação opcional: preenche req.usuario se houver token válido,
// mas não bloqueia a requisição caso não haja (usado em rotas públicas que precisam
// saber se o visitante é o autor/moderador, sem exigir login de todo mundo).
function autenticarOpcional(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.usuario = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    } catch (e) {
      // token inválido/expirado: segue como visitante anônimo
    }
  }
  next();
}

module.exports = { autenticar, autenticarOpcional, permitir };