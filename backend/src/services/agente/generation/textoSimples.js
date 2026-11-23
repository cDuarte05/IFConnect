/**
 * Normalização de respostas do LLM para texto simples (RF-20).
 * Remove marcações de Markdown, tags/entidades HTML, escapes residuais e barras iniciais de rotas,
 * preservando acentos, emojis, valores monetários e marcadores de citação [1], [1, 2].
 */

const ENTIDADES_HTML = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function ehLinhaHorizontal(linha) {
  return /^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/.test(linha);
}

function ehSeparadorTabela(linha) {
  return linha.includes('|') && linha.includes('-') && /^[ \t|:-]+$/.test(linha);
}

function formatarLinhaTabela(linha) {
  const semPontas = linha.replace(/^[ \t]*\|[ \t]*/, '').replace(/[ \t]*\|[ \t]*$/, '');
  return semPontas.replace(/[ \t]*\|[ \t]*/g, ' — ');
}

function aplicarRegras(entrada) {
  let s = entrada;

  // a) Blocos de código com crases triplas (sem o nome da linguagem) e crases simples
  s = s.replace(/```[^\n`]*\n([\s\S]*?)\n?```/g, '$1');
  s = s.replace(/`/g, '');

  // b) Decodificação de \u003c, \u003e, \n literal, \" e remoção de barras de escape de pontuação
  s = s
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\n/g, '\n')
    .replace(/\\(["/*_#[\]()>~|-])/g, '$1');

  // c) Quebras <br>/<br/>, demais tags HTML e entidades HTML comuns
  s = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/gi, (ent) => ENTIDADES_HTML[ent.toLowerCase()]);

  // d) Links Markdown [texto](url) -> "texto" (somente quando há "](")
  s = s.replace(/!?\[([^\][]*)\]\([^)]*\)/g, '$1');

  // e) Títulos Markdown: "#" a "######" seguidos de espaço no início da linha
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, '');

  // f) Citações em bloco: "> " no início da linha
  s = s.replace(/^[ \t]*(?:>[ \t]?)+/gm, '');

  // f + h) Linhas horizontais (---, ***, ___), separadores de tabela (|---|---|) e pipes
  s = s
    .split('\n')
    .filter((linha) => !ehLinhaHorizontal(linha) && !ehSeparadorTabela(linha))
    .map(formatarLinhaTabela)
    .join('\n');

  // g) Listas não ordenadas (-, *, + com espaço no início da linha) -> "• "
  s = s.replace(/^[ \t]*[-*+][ \t]+/gm, '• ');

  // i) Ênfase (**x**, __x__, *x*, _x_) preservando snake_case e expressões como "2 * 3"
  s = s
    .replace(/\*\*(\S(?:[^\n]*?\S)?)\*\*/g, '$1')
    .replace(/(?<![\p{L}\p{N}_])__(\S(?:[^\n_]*?\S)?)__(?![\p{L}\p{N}_])/gu, '$1')
    .replace(/(?<![\p{L}\p{N}*])\*(\S(?:[^\n*]*?\S)?)\*(?![\p{L}\p{N}*])/gu, '$1')
    .replace(/(?<![\p{L}\p{N}_])_(\S(?:[^\n_]*?\S)?)_(?![\p{L}\p{N}_])/gu, '$1');

  // j) Barras isoladas "( / )" e barras iniciando caminho ("/vitrine", "(/entrar)")
  s = s
    .replace(/[ \t]*\(\s*\/\s*\)/g, '')
    .replace(/(^|[\s(])\/(?=\p{L})/gu, '$1');

  // k) Espaços repetidos, espaços ao fim das linhas, limite de linhas em branco e trim final
  s = s
    .replace(/[ \t]+/g, ' ')
    .replace(/ +$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return s;
}

/**
 * Converte texto potencialmente formatado em Markdown/HTML pelo LLM em texto simples idempotente.
 * @param {unknown} texto
 * @returns {string}
 */
function limparTexto(texto) {
  if (typeof texto !== 'string') return '';

  let atual = aplicarRegras(texto.replace(/\r\n?/g, '\n'));
  let proximo = aplicarRegras(atual);
  while (proximo !== atual) {
    atual = proximo;
    proximo = aplicarRegras(atual);
  }

  return atual;
}

module.exports = {
  limparTexto,
};
