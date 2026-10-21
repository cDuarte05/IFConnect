const router = require('express').Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/agenteController');
const validar = require('../middleware/validate');

// Limite próprio para conter custo e abuso (AGENTE_IA_RATE_LIMIT req/min por IP).
const limitador = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.AGENTE_IA_RATE_LIMIT) || 10,
    message: { erro: true, mensagem: 'Muitas perguntas em pouco tempo. Aguarde um instante.' },
});

router.post(
    '/consulta',
    limitador,
    [
        body('pergunta').isString().withMessage('Pergunta inválida').bail()
            .trim().isLength({ min: 2, max: 500 }).withMessage('A pergunta deve ter entre 2 e 500 caracteres'),
    ],
    validar,
    controller.consultar
);

module.exports = router;