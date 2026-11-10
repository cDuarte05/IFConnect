const { fn, col } = require('sequelize');
const { AgentChunk } = require('../../../models');

/**
 * Cache em memória compartilhado entre a busca lexical (T8) e vetorial (T9).
 *
 * IMPORTANTE (SEG-03): A tabela agente_chunks contém apenas conteúdo público (mantido
 * pelo indexador na T6), mas a filtragem de segurança definitiva contra mudanças recentes
 * de status acontece na etapa de re-hidratação no banco (T10).
 */

let indiceCache = null;
let promessaRecarga = null;

/**
 * Carrega ou retorna o índice em memória se a assinatura da tabela não mudou.
 * Chamadas concorrentes durante uma recarga compartilham a mesma promise.
 */
async function carregarIndice() {
  if (promessaRecarga) {
    return promessaRecarga;
  }

  const assinaturaRow = await AgentChunk.findOne({
    attributes: [
      [fn('COUNT', col('id')), 'n'],
      [fn('MAX', col('updatedAt')), 'maxUpdated'],
    ],
    raw: true,
  });

  const assinatura = JSON.stringify(assinaturaRow);

  if (indiceCache && indiceCache.assinatura === assinatura) {
    return indiceCache;
  }

  if (promessaRecarga) {
    return promessaRecarga;
  }

  promessaRecarga = (async () => {
    try {
      const linhas = await AgentChunk.findAll({
        raw: true,
        attributes: [
          'id',
          'sourceType',
          'sourceId',
          'chunkIndex',
          'texto',
          'embedding',
          'embeddingModel',
          'dim',
        ],
        order: [['id', 'ASC']],
      });

      const entradas = linhas.map((linha) => ({
        ...linha,
        // Mantido como string crua até a busca vetorial solicitar conversão em Float32Array
        vec: null,
      }));

      indiceCache = {
        assinatura,
        entradas,
        // Preenchido de forma lazy pelo lexical.js e descartado quando o índice recarrega
        lexical: null,
      };

      return indiceCache;
    } finally {
      promessaRecarga = null;
    }
  })();

  return promessaRecarga;
}

/**
 * Invalida o cache em memória (usado principalmente em testes).
 */
function invalidarIndice() {
  indiceCache = null;
  promessaRecarga = null;
}

module.exports = {
  carregarIndice,
  invalidarIndice,
};

