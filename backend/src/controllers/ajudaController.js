const asyncHandler = require('../utils/asyncHandler');
const { GUIA_VERSAO, GUIA_SECOES } = require('../services/agente/generation/guia');

// Retorna o guia de orientação e navegação do portal com os limites já interpolados.
// Rota pública, sem autenticação e sem acesso ao banco de dados.
exports.obterGuia = asyncHandler(async (req, res) => {
  const secoes = GUIA_SECOES.map(({ id, titulo, perguntasExemplo, passos, observacoes }) => ({
    id,
    titulo,
    perguntasExemplo,
    passos,
    observacoes,
  }));

  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    versao: GUIA_VERSAO,
    secoes,
  });
});
