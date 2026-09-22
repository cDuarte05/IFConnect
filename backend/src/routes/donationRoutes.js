const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/donationController');
const { autenticar } = require('../middleware/auth');
const validar = require('../middleware/validate');

router.post(
  '/:campaignId',
  autenticar,
  [
    body('valor').isFloat({ gt: 0 }).withMessage('Valor de apoio deve ser maior que zero'),
    body('mensagemApoio').optional().trim().isLength({ max: 280 }).withMessage('Mensagem deve ter no máximo 280 caracteres'),
  ],
  validar,
  controller.apoiar
);

module.exports = router;
