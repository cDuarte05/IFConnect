const router = require('express').Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { autenticar } = require('../middleware/auth');
const validar = require('../middleware/validate');

router.post(
  '/registrar',
  [
    body('nome').trim().notEmpty().withMessage('Nome é obrigatório')
      .isLength({ min: 2, max: 120 }).withMessage('Nome deve ter entre 2 e 120 caracteres'),
    body('email').trim().isEmail().withMessage('Email inválido')
      .isLength({ max: 180 }).withMessage('Email muito longo (máximo 180 caracteres)').normalizeEmail(),
    body('senha').isLength({ min: 6, max: 72 }).withMessage('Senha deve ter entre 6 e 72 caracteres'),
    body('instituicao').optional({ checkFalsy: true }).trim()
      .isLength({ max: 150 }).withMessage('Nome da instituição muito longo (máximo 150 caracteres)'),
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
    body('nome').optional().trim().notEmpty().withMessage('Nome não pode ficar vazio')
      .isLength({ min: 2, max: 120 }).withMessage('Nome deve ter entre 2 e 120 caracteres'),
    body('instituicao').optional({ checkFalsy: true }).trim()
      .isLength({ max: 150 }).withMessage('Nome da instituição muito longo (máximo 150 caracteres)'),
    body('bio').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }).withMessage('Bio muito longa (máximo 2000 caracteres)'),
  ],
  validar,
  authController.atualizarPerfil
);

module.exports = router;