const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/categoryController');
const { autenticar, permitir } = require('../middleware/auth');
const validar = require('../middleware/validate');

router.get('/', controller.listar);

router.post(
  '/',
  autenticar,
  permitir('professor_moderador'),
  [body('nome').trim().notEmpty().withMessage('Nome da categoria é obrigatório')],
  validar,
  controller.criar
);

module.exports = router;
