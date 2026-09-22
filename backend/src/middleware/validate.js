const { validationResult } = require('express-validator');

// Middleware genérico: roda depois das cadeias de validação do express-validator
// (definidas em cada rota) e interrompe a requisição com 400 se algo for inválido.
module.exports = function validar(req, res, next) {
  const erros = validationResult(req);
  if (!erros.isEmpty()) {
    return res.status(400).json({
      erro: true,
      mensagem: erros.array()[0].msg,
      detalhes: erros.array().map((e) => ({ campo: e.path, mensagem: e.msg })),
    });
  }
  next();
};
