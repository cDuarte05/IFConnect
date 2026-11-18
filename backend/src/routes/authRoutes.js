const router = require('express').Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { autenticar } = require('../middleware/auth');
const validar = require('../middleware/validate');
const {
  NOME_MIN,
  NOME_MAX,
  EMAIL_MAX,
  SENHA_MIN,
  SENHA_MAX,
  INSTITUICAO_MAX,
  BIO_MAX,
} = require('../config/limites');

router.post(
  '/registrar',
  [
    body('nome').trim().notEmpty().withMessage('Nome é obrigatório')
      .isLength({ min: NOME_MIN, max: NOME_MAX }).withMessage(`Nome deve ter entre ${NOME_MIN} e ${NOME_MAX} caracteres`),
    body('email').trim().isEmail().withMessage('Email inválido')
      .isLength({ max: EMAIL_MAX }).withMessage(`Email muito longo (máximo ${EMAIL_MAX} caracteres)`).normalizeEmail(),
    body('senha').isLength({ min: SENHA_MIN, max: SENHA_MAX }).withMessage(`Senha deve ter entre ${SENHA_MIN} e ${SENHA_MAX} caracteres`),
    body('instituicao').optional({ checkFalsy: true }).trim()
      .isLength({ max: INSTITUICAO_MAX }).withMessage(`Nome da instituição muito longo (máximo ${INSTITUICAO_MAX} caracteres)`),
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
      .isLength({ min: NOME_MIN, max: NOME_MAX }).withMessage(`Nome deve ter entre ${NOME_MIN} e ${NOME_MAX} caracteres`),
    body('instituicao').optional({ checkFalsy: true }).trim()
      .isLength({ max: INSTITUICAO_MAX }).withMessage(`Nome da instituição muito longo (máximo ${INSTITUICAO_MAX} caracteres)`),
    body('bio').optional({ checkFalsy: true }).trim().isLength({ max: BIO_MAX }).withMessage(`Bio muito longa (máximo ${BIO_MAX} caracteres)`),
  ],
  validar,
  authController.atualizarPerfil
);

module.exports = router;