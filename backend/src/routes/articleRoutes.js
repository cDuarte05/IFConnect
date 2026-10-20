const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/articleController');
const { autenticar, autenticarOpcional, permitir } = require('../middleware/auth');
const validar = require('../middleware/validate');

const TIPOS_VALIDOS = ['noticia_escolar', 'noticia_global', 'artigo_cientifico', 'texto', 'poema', 'projeto'];
const TEMAS_VALIDOS = ['cientifico', 'educacional', 'cultural', 'comunitario'];

// Reaproveitada na criação e na edição.
const validacaoImagemCapa = body('imagemCapaUrl')
  .optional({ nullable: true, checkFalsy: true })
  .isURL().withMessage('URL da imagem de capa inválida')
  .isLength({ max: 500 }).withMessage('URL da imagem de capa muito longa (máximo 500 caracteres)');

const validacaoPublicacao = [
  body('titulo').trim().notEmpty().withMessage('Título é obrigatório')
    .isLength({ min: 10, max: 150 }).withMessage('Título deve ter entre 10 e 150 caracteres'),
  body('resumo').trim().notEmpty().withMessage('Resumo é obrigatório').isLength({ max: 300 }).withMessage('Resumo deve ter no máximo 300 caracteres'),
  body('conteudo').trim().notEmpty().withMessage('Conteúdo é obrigatório')
    .isLength({ max: 20000 }).withMessage('Conteúdo muito longo (máximo 20.000 caracteres)'),
  body('tipo').isIn(TIPOS_VALIDOS).withMessage('Tipo de publicação inválido'),
  body('categoryId').optional({ nullable: true }).isUUID().withMessage('Categoria inválida'),
  body('tema').optional({ nullable: true }).isIn(TEMAS_VALIDOS).withMessage('Tema inválido'),
  body('palavrasChave').optional().trim().isLength({ max: 300 }).withMessage('Palavras-chave devem ter no máximo 300 caracteres'),
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
      .isLength({ min: 10, max: 150 }).withMessage('Título deve ter entre 10 e 150 caracteres'),
    body('resumo').optional().trim().isLength({ max: 300 }).withMessage('Resumo deve ter no máximo 300 caracteres'),
    body('conteudo').optional().trim().notEmpty().withMessage('Conteúdo não pode ficar vazio')
      .isLength({ max: 20000 }).withMessage('Conteúdo muito longo (máximo 20.000 caracteres)'),
    body('tipo').optional().isIn(TIPOS_VALIDOS).withMessage('Tipo de publicação inválido'),
    body('categoryId').optional({ nullable: true }).isUUID().withMessage('Categoria inválida'),
    body('tema').optional({ nullable: true }).isIn(TEMAS_VALIDOS).withMessage('Tema inválido'),
    body('palavrasChave').optional().trim().isLength({ max: 300 }).withMessage('Palavras-chave devem ter no máximo 300 caracteres'),
    validacaoImagemCapa,
  ],
  validar,
  controller.atualizar
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