const asyncHandler = require('../utils/asyncHandler');
const agenteService = require('../services/agenteService');
const { getConfig } = require('../services/agente/config');

exports.consultarStatus = asyncHandler(async (req, res) => {
  res.json({ habilitado: getConfig().enabled });
});

exports.consultar = asyncHandler(async (req, res) => {
  if (process.env.AGENTE_IA_ENABLED !== 'true') {
    return res.status(503).json({ erro: true, mensagem: 'O assistente está temporariamente indisponível.' });
  }
  const resultado = await agenteService.responder(req.body.pergunta);
  res.json(resultado);
});