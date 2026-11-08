const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/commentController');
const { autenticar } = require('../middleware/auth');
const validar = require('../middleware/validate');

const validacaoComentario = [
  body('conteudo')
    .trim()
    .notEmpty()
    .withMessage('O comentário não pode ficar vazio')
    .isLength({ min: 1, max: 2000 })
    .withMessage('O comentário deve ter no máximo 2000 caracteres'),
];

router.put('/:id', autenticar, validacaoComentario, validar, controller.atualizar);
router.delete('/:id', autenticar, controller.excluir);

module.exports = router;

