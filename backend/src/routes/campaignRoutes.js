const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/campaignController');
const { autenticar, permitir } = require('../middleware/auth');
const validar = require('../middleware/validate');

const TEMAS_VALIDOS = ['cientifico', 'educacional', 'cultural', 'comunitario'];

const validacaoCampanha = [
  body('titulo').trim().notEmpty().withMessage('Título é obrigatório'),
  body('descricao').trim().notEmpty().withMessage('Descrição é obrigatória'),
  body('metaFinanceira').isFloat({ gt: 0 }).withMessage('Meta financeira deve ser um valor maior que zero'),
  body('categoryId').optional({ nullable: true }).isUUID().withMessage('Categoria inválida'),
  body('tema').optional({ nullable: true }).isIn(TEMAS_VALIDOS).withMessage('Tema inválido'),
  body('palavrasChave').optional().trim().isLength({ max: 300 }).withMessage('Palavras-chave devem ter no máximo 300 caracteres'),
];

router.get('/', controller.listar);
router.get('/minhas/campanhas', autenticar, controller.minhasCampanhas);
router.get('/moderacao/pendentes', autenticar, permitir('professor_moderador'), controller.pendentes);
router.get('/:id', controller.obterPorId);

router.post('/', autenticar, validacaoCampanha, validar, controller.criar);

router.put(
  '/:id',
  autenticar,
  [
    body('titulo').optional().trim().notEmpty().withMessage('Título não pode ficar vazio'),
    body('descricao').optional().trim().notEmpty().withMessage('Descrição não pode ficar vazia'),
    body('metaFinanceira').optional().isFloat({ gt: 0 }).withMessage('Meta financeira deve ser um valor maior que zero'),
    body('categoryId').optional({ nullable: true }).isUUID().withMessage('Categoria inválida'),
    body('tema').optional({ nullable: true }).isIn(TEMAS_VALIDOS).withMessage('Tema inválido'),
    body('palavrasChave').optional().trim().isLength({ max: 300 }).withMessage('Palavras-chave devem ter no máximo 300 caracteres'),
  ],
  validar,
  controller.atualizar
);

router.patch(
  '/:id/moderar',
  autenticar,
  permitir('professor_moderador'),
  [body('status').isIn(['ativa', 'encerrada']).withMessage('Status de moderação inválido')],
  validar,
  controller.moderar
);

module.exports = router;
