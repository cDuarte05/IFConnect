const { carregarIndice } = require('./indice');

/**
 * Contrato de VectorStore (D4 em spec-rag.md):
 *
 * buscar(vetorConsulta, { k, embeddingModel, dim })
 *   -> Promise<Array<{ chunkId, sourceType, sourceId, chunkIndex, texto, score }>>
 *   onde `score` é a similaridade de cosseno no intervalo [-1, 1].
 *
 * Na fase de nuvem (PostgreSQL RDS), outra implementação (ex.: pgvector com índice HNSW)
 * cumprirá exatamente este mesmo contrato sem alterar o restante da camada de recuperação.
 */

function produtoEscalar(a, b) {
  let soma = 0;
  for (let i = 0; i < a.length; i++) {
    soma += a[i] * b[i];
  }
  // Limita a [-1, 1] para evitar desvios mínimos de ponto flutuante
  if (soma > 1) return 1;
  if (soma < -1) return -1;
  return soma;
}

function obterFloat32Array(entrada) {
  if (entrada.vec instanceof Float32Array) {
    return entrada.vec;
  }
  const bruto =
    typeof entrada.embedding === 'string'
      ? JSON.parse(entrada.embedding)
      : entrada.embedding;
  entrada.vec = new Float32Array(bruto);
  return entrada.vec;
}

/**
 * Implementação em memória sobre o cache do índice SQLite (carregarIndice).
 */
function criarVectorStoreSqlite() {
  return {
    async buscar(vetorConsulta, { k = 20, embeddingModel, dim } = {}) {
      if (!dim || typeof dim !== 'number' || dim <= 0) {
        throw new Error(`Dimensão inválida para busca vetorial: ${dim}`);
      }
      if (!vetorConsulta || vetorConsulta.length !== dim) {
        throw new Error(
          `Vetor de consulta com dimensão (${vetorConsulta ? vetorConsulta.length : 0}) incompatível com a esperada (${dim}).`
        );
      }

      const indice = await carregarIndice();
      if (!indice.entradas.length) {
        return [];
      }

      const resultados = [];

      for (const entrada of indice.entradas) {
        // RN-09: nunca comparar vetores gerados por modelos ou dimensões diferentes
        if (entrada.embeddingModel !== embeddingModel || entrada.dim !== dim) {
          continue;
        }

        const vec = obterFloat32Array(entrada);
        if (vec.length !== dim) {
          continue;
        }

        const score = produtoEscalar(vetorConsulta, vec);
        resultados.push({
          chunkId: entrada.id,
          sourceType: entrada.sourceType,
          sourceId: entrada.sourceId,
          chunkIndex: entrada.chunkIndex,
          texto: entrada.texto,
          score,
        });
      }

      resultados.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.chunkId).localeCompare(String(b.chunkId));
      });

      return resultados.slice(0, k);
    },
  };
}

module.exports = {
  criarVectorStoreSqlite,
};

