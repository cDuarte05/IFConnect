const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/campaignController');
const commentController = require('../controllers/commentController');
const { autenticar, autenticarOpcional, permitir } = require('../middleware/auth');
const validar = require('../middleware/validate');
const {
  TITULO_MIN,
  TITULO_MAX,
  DESCRICAO_MAX,
  PALAVRAS_CHAVE_MAX,
  IMAGEM_MAX,
  TEMAS,
} = require('../config/limites');

const TEMAS_VALIDOS = TEMAS;

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
  .isLength({ max: IMAGEM_MAX }).withMessage(`URL da imagem de capa muito longa (máximo ${IMAGEM_MAX} caracteres)`);

const validacaoCampanha = [
  body('titulo').trim().notEmpty().withMessage('Título é obrigatório')
    .isLength({ min: TITULO_MIN, max: TITULO_MAX }).withMessage(`Título deve ter entre ${TITULO_MIN} e ${TITULO_MAX} caracteres`),
  body('descricao').trim().notEmpty().withMessage('Descrição é obrigatória')
    .isLength({ max: DESCRICAO_MAX }).withMessage('Descrição muito longa (máximo 5.000 caracteres)'),
  body('metaFinanceira').isFloat({ gt: 0 }).withMessage('Meta financeira deve ser um valor maior que zero'),
  body('categoryId').optional({ nullable: true }).isUUID().withMessage('Categoria inválida'),
  body('tema').optional({ nullable: true }).isIn(TEMAS_VALIDOS).withMessage('Tema inválido'),
  body('palavrasChave').optional().trim().isLength({ max: PALAVRAS_CHAVE_MAX }).withMessage(`Palavras-chave devem ter no máximo ${PALAVRAS_CHAVE_MAX} caracteres`),
  validacaoPrazoFinal,
  validacaoImagemCapa,
];

router.get('/', controller.listar);
router.get('/minhas/campanhas', autenticar, controller.minhasCampanhas);
router.get('/moderacao/pendentes', autenticar, permitir('professor_moderador'), controller.pendentes);
router.get('/:id', autenticarOpcional, controller.obterPorId);

// Comentários do projeto / campanha
router.get('/:id/comentarios', commentController.listarPorCampanha);
router.get('/:id/comentarios/stream', commentController.streamCampanha);
router.post(
  '/:id/comentarios',
  autenticar,
  [
    body('conteudo')
      .trim()
      .notEmpty()
      .withMessage('O comentário não pode ficar vazio')
      .isLength({ min: 1, max: 2000 })
      .withMessage('O comentário deve ter no máximo 2000 caracteres'),
  ],
  validar,
  commentController.criarPorCampanha
);

router.post('/', autenticar, validacaoCampanha, validar, controller.criar);

router.put(
  '/:id',
  autenticar,
  [
    body('titulo').optional().trim().notEmpty().withMessage('Título não pode ficar vazio')
      .isLength({ min: TITULO_MIN, max: TITULO_MAX }).withMessage(`Título deve ter entre ${TITULO_MIN} e ${TITULO_MAX} caracteres`),
    body('descricao').optional().trim().notEmpty().withMessage('Descrição não pode ficar vazia')
      .isLength({ max: DESCRICAO_MAX }).withMessage('Descrição muito longa (máximo 5.000 caracteres)'),
    body('metaFinanceira').optional().isFloat({ gt: 0 }).withMessage('Meta financeira deve ser um valor maior que zero'),
    body('categoryId').optional({ nullable: true }).isUUID().withMessage('Categoria inválida'),
    body('tema').optional({ nullable: true }).isIn(TEMAS_VALIDOS).withMessage('Tema inválido'),
    body('palavrasChave').optional().trim().isLength({ max: PALAVRAS_CHAVE_MAX }).withMessage(`Palavras-chave devem ter no máximo ${PALAVRAS_CHAVE_MAX} caracteres`),
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