const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/articleController');
const commentController = require('../controllers/commentController');
const { autenticar, autenticarOpcional, permitir } = require('../middleware/auth');
const validar = require('../middleware/validate');
const {
  TITULO_MIN,
  TITULO_MAX,
  RESUMO_MAX,
  CONTEUDO_MAX,
  PALAVRAS_CHAVE_MAX,
  IMAGEM_MAX,
  TIPOS_ARTIGO,
  TEMAS,
} = require('../config/limites');

const TIPOS_VALIDOS = TIPOS_ARTIGO;
const TEMAS_VALIDOS = TEMAS;

// Reaproveitada na criação e na edição.
const validacaoImagemCapa = body('imagemCapaUrl')
  .optional({ nullable: true, checkFalsy: true })
  .isURL().withMessage('URL da imagem de capa inválida')
  .isLength({ max: IMAGEM_MAX }).withMessage(`URL da imagem de capa muito longa (máximo ${IMAGEM_MAX} caracteres)`);

const validacaoPublicacao = [
  body('titulo').trim().notEmpty().withMessage('Título é obrigatório')
    .isLength({ min: TITULO_MIN, max: TITULO_MAX }).withMessage(`Título deve ter entre ${TITULO_MIN} e ${TITULO_MAX} caracteres`),
  body('resumo').trim().notEmpty().withMessage('Resumo é obrigatório').isLength({ max: RESUMO_MAX }).withMessage(`Resumo deve ter no máximo ${RESUMO_MAX} caracteres`),
  body('conteudo').trim().notEmpty().withMessage('Conteúdo é obrigatório')
    .isLength({ max: CONTEUDO_MAX }).withMessage('Conteúdo muito longo (máximo 20.000 caracteres)'),
  body('tipo').isIn(TIPOS_VALIDOS).withMessage('Tipo de publicação inválido'),
  body('categoryId').optional({ nullable: true }).isUUID().withMessage('Categoria inválida'),
  body('tema').optional({ nullable: true }).isIn(TEMAS_VALIDOS).withMessage('Tema inválido'),
  body('palavrasChave').optional().trim().isLength({ max: PALAVRAS_CHAVE_MAX }).withMessage(`Palavras-chave devem ter no máximo ${PALAVRAS_CHAVE_MAX} caracteres`),
  validacaoImagemCapa,
];

router.get('/', controller.listar);
router.get('/minhas/publicacoes', autenticar, controller.meusArtigos);
router.get('/moderacao/pendentes', autenticar, permitir('professor_moderador'), controller.pendentes);
router.get('/:id', autenticarOpcional, controller.obterPorId);

router.post('/', autenticar, validacaoPublicacao, validar, controller.criar);

router.put(
  '/:id',
  autenticar,
  [
    body('titulo').optional().trim().notEmpty().withMessage('Título não pode ficar vazio')
      .isLength({ min: TITULO_MIN, max: TITULO_MAX }).withMessage(`Título deve ter entre ${TITULO_MIN} e ${TITULO_MAX} caracteres`),
    body('resumo').optional().trim().isLength({ max: RESUMO_MAX }).withMessage(`Resumo deve ter no máximo ${RESUMO_MAX} caracteres`),
    body('conteudo').optional().trim().notEmpty().withMessage('Conteúdo não pode ficar vazio')
      .isLength({ max: CONTEUDO_MAX }).withMessage('Conteúdo muito longo (máximo 20.000 caracteres)'),
    body('tipo').optional().isIn(TIPOS_VALIDOS).withMessage('Tipo de publicação inválido'),
    body('categoryId').optional({ nullable: true }).isUUID().withMessage('Categoria inválida'),
    body('tema').optional({ nullable: true }).isIn(TEMAS_VALIDOS).withMessage('Tema inválido'),
    body('palavrasChave').optional().trim().isLength({ max: PALAVRAS_CHAVE_MAX }).withMessage(`Palavras-chave devem ter no máximo ${PALAVRAS_CHAVE_MAX} caracteres`),
    validacaoImagemCapa,
  ],
  validar,
  controller.atualizar
);

router.delete('/:id', autenticar, controller.excluir);

// Comentários da publicação
router.get('/:id/comentarios', commentController.listarPorArtigo);
router.get('/:id/comentarios/stream', commentController.streamArtigo);
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
  commentController.criarPorArtigo
);

router.patch(
  '/:id/moderar',
  autenticar,
  permitir('professor_moderador'),
  [body('status').isIn(['publicado', 'recusado']).withMessage('Status de moderação inválido')],
  validar,
  controller.moderar
);

module.exports = router;