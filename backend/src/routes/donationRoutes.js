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
    body('mensagemApoio').optional().trim().isLength({ max: 280 }).withMessage('Mensagem deve ter no máximo 280 caracteres')
    //Parte desnecessária por enquanto, pois não há nenhum destes campos.
    // body('titulo').trim().notEmpty().withMessage('Título é obrigatório')
    //   .isLength({ min: 10, max: 150 }).withMessage('Título deve ter entre 10 e 150 caracteres'),
    // body('imagemCapaUrl')
    //   .optional({ nullable: true, checkFalsy: true })
    //   .isURL().withMessage('URL da imagem de capa inválida')
    //   .isLength({ max: 500 }).withMessage('URL da imagem de capa muito longa (máximo 500 caracteres)'),
  ],
  validar,
  controller.apoiar
);

module.exports = router;
