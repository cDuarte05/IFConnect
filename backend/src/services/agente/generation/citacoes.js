/**
 * Processamento e validação de marcadores de citação no texto de resposta do assistente.
 */

/**
 * Limpa espaços duplicados e espaços antes de sinais de pontuação após remoção de citações.
 */
function limparEspacosEPontuacao(texto) {
  let limpo = texto;

  // Remove vírgulas duplicadas ou vírgulas seguidas de ponto (ex.: ", .", ", ,")
  limpo = limpo.replace(/[ \t]*,[ \t]*\./g, '.');
  limpo = limpo.replace(/[ \t]*,([ \t]*,)+/g, ',');

  // Remove espaços antes de pontuação (ex.: " ." -> ".", " ," -> ",")
  limpo = limpo.replace(/[ \t]+([.,;?!:])/g, '$1');

  // Colapsa múltiplos espaços em um único mantendo quebras de linha
  limpo = limpo.replace(/[ \t]+/g, ' ');
  limpo = limpo.replace(/ \n/g, '\n').replace(/\n /g, '\n');

  return limpo.trim();
}

/**
 * Reconhece marcadores [n] ou [n1, n2, ...] (onde n tem 1 ou 2 dígitos)
 * e mantém apenas aqueles pertencentes a refsValidas.
 *
 * @param {string} texto
 * @param {number[]|Set<number>} refsValidas
 * @returns {{ texto: string, refsCitadas: number[] }}
 */
function processarCitacoes(texto, refsValidas) {
  if (texto === null || texto === undefined || typeof texto !== 'string' || texto === '') {
    return { texto: '', refsCitadas: [] };
  }

  const setValidas = new Set(Array.isArray(refsValidas) ? refsValidas : refsValidas || []);
  const refsCitadas = [];
  const vistas = new Set();

  // Regex para capturar marcadores isolados ou encadeados com possíveis vírgulas/espaços entre eles:
  // ex.: "[12] , [14]" ou "[1]" ou "[1, 2]"
  const regexBlocoMarcadores = /(?:\[\s*\d{1,2}(?:\s*,\s*\d{1,2})*\s*\](?:[ \t]*,[ \t]*\[\s*\d{1,2}(?:\s*,\s*\d{1,2})*\s*\])*)/g;

  const textoSubstituido = texto.replace(regexBlocoMarcadores, (bloco) => {
    const numeros = bloco.match(/\d{1,2}/g) || [];
    const validos = [];

    for (const numStr of numeros) {
      const num = parseInt(numStr, 10);
      if (setValidas.has(num)) {
        validos.push(num);
        if (!vistas.has(num)) {
          vistas.add(num);
          refsCitadas.push(num);
        }
      }
    }

    if (validos.length === 0) {
      return '';
    }

    return `[${validos.join(', ')}]`;
  });

  const textoFinal = limparEspacosEPontuacao(textoSubstituido);

  return {
    texto: textoFinal,
    refsCitadas,
  };
}

module.exports = {
  processarCitacoes,
};
