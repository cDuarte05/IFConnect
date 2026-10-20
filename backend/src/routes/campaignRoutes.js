const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/campaignController');
const { autenticar, autenticarOpcional, permitir } = require('../middleware/auth');
const validar = require('../middleware/validate');

const TEMAS_VALIDOS = ['cientifico', 'educacional', 'cultural', 'comunitario'];

// Reaproveitadas na criação e na edição — mantêm a mesma regra nos dois lugares.
const validacaoPrazoFinal = body('prazoFinal')
  .optional({ nullable: true, checkFalsy: true }) // aceita null, undefined e '' como "não informado"
  .isISO8601().withMessage('Data de prazo final inválida')
  .custom((value) => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    if (new Date(value) < hoje) throw new Error('Prazo final não pode ser uma data passada');
    return true;
  });

const validacaoImagemCapa = body('imagemCapaUrl')
  .optional({ nullable: true, checkFalsy: true })
  .isURL().withMessage('URL da imagem de capa inválida')
  .isLength({ max: 500 }).withMessage('URL da imagem de capa muito longa (máximo 500 caracteres)');

const validacaoCampanha = [
  body('titulo').trim().notEmpty().withMessage('Título é obrigatório')
    .isLength({ min: 10, max: 150 }).withMessage('Título deve ter entre 10 e 150 caracteres'),
  body('descricao').trim().notEmpty().withMessage('Descrição é obrigatória')
    .isLength({ max: 5000 }).withMessage('Descrição muito longa (máximo 5.000 caracteres)'),
  body('metaFinanceira').isFloat({ gt: 0 }).withMessage('Meta financeira deve ser um valor maior que zero'),
  body('categoryId').optional({ nullable: true }).isUUID().withMessage('Categoria inválida'),
  body('tema').optional({ nullable: true }).isIn(TEMAS_VALIDOS).withMessage('Tema inválido'),
  body('palavrasChave').optional().trim().isLength({ max: 300 }).withMessage('Palavras-chave devem ter no máximo 300 caracteres'),
  validacaoPrazoFinal,
  validacaoImagemCapa,
];

router.get('/', controller.listar);
router.get('/minhas/campanhas', autenticar, controller.minhasCampanhas);
router.get('/moderacao/pendentes', autenticar, permitir('professor_moderador'), controller.pendentes);
router.get('/:id', autenticarOpcional, controller.obterPorId);

router.post('/', autenticar, validacaoCampanha, validar, controller.criar);

router.put(
  '/:id',
  autenticar,
  [
    body('titulo').optional().trim().notEmpty().withMessage('Título não pode ficar vazio')
      .isLength({ min: 10, max: 150 }).withMessage('Título deve ter entre 10 e 150 caracteres'),
    body('descricao').optional().trim().notEmpty().withMessage('Descrição não pode ficar vazia')
      .isLength({ max: 5000 }).withMessage('Descrição muito longa (máximo 5.000 caracteres)'),
    body('metaFinanceira').optional().isFloat({ gt: 0 }).withMessage('Meta financeira deve ser um valor maior que zero'),
    body('categoryId').optional({ nullable: true }).isUUID().withMessage('Categoria inválida'),
    body('tema').optional({ nullable: true }).isIn(TEMAS_VALIDOS).withMessage('Tema inválido'),
    body('palavrasChave').optional().trim().isLength({ max: 300 }).withMessage('Palavras-chave devem ter no máximo 300 caracteres'),
    validacaoPrazoFinal,
    validacaoImagemCapa,
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