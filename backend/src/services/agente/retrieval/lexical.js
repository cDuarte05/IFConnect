const { carregarIndice } = require('./indice');
const { tokenizar, tokensConsulta } = require('./texto');

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const PESO_TITULO = 3;

/**
 * Constrói (ou reaproveita) a estrutura invertida/estatística do BM25 sobre o índice em memória.
 * A primeira linha do chunk ("Título: ...") recebe peso multiplicado por PESO_TITULO.
 */
function obterOuConstruirLexical(indice) {
  if (indice.lexical) {
    return indice.lexical;
  }

  const df = new Map();
  const docs = [];
  let totalComprimento = 0;

  for (const entrada of indice.entradas) {
    const texto = entrada.texto || '';
    const idxQuebra = texto.indexOf('\n');
    const linhaTitulo = idxQuebra === -1 ? texto : texto.slice(0, idxQuebra);
    const restanteTexto = idxQuebra === -1 ? '' : texto.slice(idxQuebra + 1);

    const tokensTitulo = tokenizar(linhaTitulo);
    const tokensResto = tokenizar(restanteTexto);

    const tokens = [];
    for (let i = 0; i < PESO_TITULO; i++) {
      tokens.push(...tokensTitulo);
    }
    tokens.push(...tokensResto);

    const tf = new Map();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    for (const termoUnico of tf.keys()) {
      df.set(termoUnico, (df.get(termoUnico) || 0) + 1);
    }

    const len = tokens.length;
    totalComprimento += len;
    docs.push({ entrada, tf, len });
  }

  const N = docs.length;
  const avgdl = N > 0 ? totalComprimento / N : 0;

  indice.lexical = { N, avgdl, df, docs };
  return indice.lexical;
}

/**
 * Busca lexical com ranking BM25 sobre os chunks indexados.
 * Não filtra por status (a filtragem definitiva ocorre na T10).
 */
async function buscarLexical(pergunta, { k = 20 } = {}) {
  const termosConsulta = tokensConsulta(pergunta);
  if (termosConsulta.length === 0) {
    return [];
  }

  const indice = await carregarIndice();
  const { N, avgdl, df, docs } = obterOuConstruirLexical(indice);

  if (N === 0) {
    return [];
  }

  const resultados = [];

  for (const doc of docs) {
    let score = 0;
    let termosPresentes = 0;

    for (const termo of termosConsulta) {
      const freq = doc.tf.get(termo) || 0;
      if (freq > 0) {
        termosPresentes += 1;
        const dfTermo = df.get(termo) || 0;
        const idf = Math.log(1 + (N - dfTermo + 0.5) / (dfTermo + 0.5));
        const normDoc = avgdl > 0 ? doc.len / avgdl : 0;
        const denom = freq + BM25_K1 * (1 - BM25_B + BM25_B * normDoc);
        score += idf * ((freq * (BM25_K1 + 1)) / denom);
      }
    }

    if (score > 0) {
      resultados.push({
        chunkId: doc.entrada.id,
        sourceType: doc.entrada.sourceType,
        sourceId: doc.entrada.sourceId,
        chunkIndex: doc.entrada.chunkIndex,
        texto: doc.entrada.texto,
        score,
        cobertura: termosPresentes / termosConsulta.length,
      });
    }
  }

  resultados.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.chunkId).localeCompare(String(b.chunkId));
  });

  return resultados.slice(0, k);
}

module.exports = {
  buscarLexical,
};

