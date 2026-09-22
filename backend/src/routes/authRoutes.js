const router = require('express').Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { autenticar } = require('../middleware/auth');
const validar = require('../middleware/validate');

router.post(
  '/registrar',
  [
    body('nome').trim().notEmpty().withMessage('Nome é obrigatório'),
    body('email').trim().isEmail().withMessage('Email inválido').normalizeEmail(),
    body('senha').isLength({ min: 6 }).withMessage('Senha deve ter ao menos 6 caracteres'),
  ],
  validar,
  authController.registrar
);

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Email inválido'),
    body('senha').notEmpty().withMessage('Senha é obrigatória'),
  ],
  validar,
  authController.login
);

router.get('/perfil', autenticar, authController.perfil);

router.patch(
  '/perfil',
  autenticar,
  [
    body('nome').optional().trim().notEmpty().withMessage('Nome não pode ficar vazio'),
    body('instituicao').optional().trim(),
    body('bio').optional().trim().isLength({ max: 2000 }).withMessage('Bio muito longa'),
  ],
  validar,
  authController.atualizarPerfil
);

module.exports = router;
