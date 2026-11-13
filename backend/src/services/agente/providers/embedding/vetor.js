/**
 * Utilitários para operações com vetores de embedding.
 */

function normalizarL2(vetor) {
  const norma = Math.sqrt(vetor.reduce((soma, v) => soma + v * v, 0));
  if (norma === 0) return vetor;
  return vetor.map((v) => v / norma);
}

module.exports = { normalizarL2 };
