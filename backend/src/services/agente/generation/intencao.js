/**
 * Detecção determinística de perguntas de navegação/orientação (como publicar, cadastrar,
 * entrar etc.). Perguntas assim podem ser respondidas pelas regras de orientação do
 * SYSTEM_PROMPT_RAG mesmo quando não há nenhum trecho de conteúdo recuperado.
 *
 * PROPOSTA a validar: as expressões e a lista de termos abaixo devem ser ajustadas com os
 * resultados do conjunto de avaliação da T15.
 */

const { normalizar } = require('../retrieval/texto');

const REGEX_COMO = /\bcomo (faco|fazer|posso|publico|cadastro|crio|envio|entro|apoio|doo|funciona)\b/;

const TERMOS_NAVEGACAO = new Set([
  'publicar',
  'cadastrar',
  'registrar',
  'login',
  'senha',
  'conta',
  'entrar',
  'moderacao',
  'aprovacao',
  'editar',
]);

/**
 * @param {string} pergunta
 * @returns {boolean}
 */
function ehPerguntaDeNavegacao(pergunta) {
  if (typeof pergunta !== 'string' || !pergunta.trim()) return false;

  const texto = normalizar(pergunta);
  if (REGEX_COMO.test(texto)) return true;

  return texto.split(/[^a-z0-9]+/).some((token) => TERMOS_NAVEGACAO.has(token));
}

module.exports = {
  ehPerguntaDeNavegacao,
};

