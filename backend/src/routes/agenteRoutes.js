const router = require('express').Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/agenteController');
const validar = require('../middleware/validate');
const { getConfig } = require('../services/agente/config');

// Limite próprio para conter custo e abuso (lido da configuração a cada requisição).
const limitador = rateLimit({
  windowMs: 60 * 1000,
  limit: () => {
    const n = getConfig().rateLimit;
    return Number.isFinite(n) && n > 0 ? n : 10;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: true, mensagem: 'Muitas perguntas em pouco tempo. Aguarde um instante.' },
});

router.get('/status', controller.consultarStatus);

router.post(
  '/consulta',
  limitador,
  [
    body('pergunta')
      .isString()
      .withMessage('Pergunta inválida')
      .bail()
      .trim()
      .isLength({ min: 2, max: 500 })
      .withMessage('A pergunta deve ter entre 2 e 500 caracteres'),
  ],
  validar,
  controller.consultar
);

module.exports = router;