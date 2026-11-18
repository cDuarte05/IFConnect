/**
 * Detecção determinística de perguntas de navegação/orientação (como publicar, cadastrar,
 * entrar, acompanhar, apoiar etc.). Perguntas assim podem ser respondidas pelas regras de orientação
 * do SYSTEM_PROMPT_RAG e pelo bloco <guia> mesmo quando não há nenhum trecho de conteúdo recuperado.
 */

const { normalizar } = require('../retrieval/texto');

const REGEX_COMO = /\bcomo (faco|fazer|posso|publico|cadastro|crio|envio|entro|apoio|doo|funciona|acompanho|edito|escrevo|inscrevo)\b/;

const TERMOS_NAVEGACAO = new Set([
  'criar',
  'crio',
  'criacao',
  'escrever',
  'escrevo',
  'escrita',
  'publicar',
  'publico',
  'publicacao',
  'publicacoes',
  'cadastrar',
  'cadastro',
  'cadastros',
  'inscrever',
  'inscrevo',
  'inscricao',
  'inscricoes',
  'enviar',
  'envio',
  'apoiar',
  'apoio',
  'apoios',
  'doar',
  'doo',
  'doacao',
  'doacoes',
  'editar',
  'edito',
  'edicao',
  'edicoes',
  'entrar',
  'login',
  'conta',
  'contas',
  'senha',
  'senhas',
  'acompanhar',
  'acompanho',
  'acompanhamento',
  'status',
  'registrar',
  'registro',
  'moderacao',
  'aprovacao',
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
  TERMOS_NAVEGACAO,
};
