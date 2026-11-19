const router = require('express').Router();
const controller = require('../controllers/ajudaController');

router.get('/', controller.obterGuia);

module.exports = router;
