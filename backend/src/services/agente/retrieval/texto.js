/**
 * Funções puras de normalização, remoção de stopwords, radicalização simétrica
 * e tokenização para busca lexical (BM25) em português.
 */

const normalizar = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const STOPWORDS = new Set([
  // Stopwords do agenteService.js
  'algo', 'sobre', 'quais', 'qual', 'quem', 'como', 'onde', 'quando', 'existe', 'existem',
  'fale', 'falam', 'para', 'pelo', 'pela', 'umas', 'esse', 'essa', 'isso', 'este', 'esta', 'isto',
  'mais', 'muito', 'preciso', 'quero', 'gostaria', 'posso', 'portal', 'site',
  'noticia', 'noticias', 'publicacao', 'publicacoes', 'projeto', 'projetos', 'artigo', 'artigos',
  'resuma', 'resumo', 'hoje',
  // Palavras funcionais comuns em PT-BR
  'a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'uns', 'os', 'as', 'ao', 'aos', 'com', 'por', 'que', 'pra',
  'seu', 'sua', 'seus', 'suas', 'ser', 'ter', 'tem', 'sao', 'foi', 'era',
  'ou', 'mas', 'se', 'ja', 'nao', 'sim', 'entre', 'ate', 'sem', 'sob',
  'num', 'numa', 'pelos', 'pelas', 'estao', 'aquele', 'aquela', 'aquilo',
  'ele', 'ela', 'eles', 'elas', 'meu', 'minha', 'nosso', 'nossa',
]);

/**
 * Radicalização leve simétrica (aplicada igualmente em consultas e documentos).
 */
function stem(token) {
  if (!token) return '';
  if (token.length > 4 && token.endsWith('oes')) {
    return `${token.slice(0, -3)}ao`;
  }
  if (
    token.length > 4 &&
    (token.endsWith('res') || token.endsWith('zes') || token.endsWith('ses'))
  ) {
    return token.slice(0, -2);
  }
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

/**
 * Normaliza, divide em tokens alfanuméricos, remove stopwords e tokens curtos
 * e aplica radicalização simétrica.
 */
function tokenizar(texto, { minLen = 3 } = {}) {
  if (!texto || typeof texto !== 'string') return [];

  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= minLen && !STOPWORDS.has(t))
    .map(stem);
}

/**
 * Extrai tokens únicos da pergunta preservando a ordem até o limite `max`.
 */
function tokensConsulta(pergunta, { max = 12 } = {}) {
  const tokens = tokenizar(pergunta);
  return [...new Set(tokens)].slice(0, max);
}

module.exports = {
  normalizar,
  STOPWORDS,
  stem,
  tokenizar,
  tokensConsulta,
};

