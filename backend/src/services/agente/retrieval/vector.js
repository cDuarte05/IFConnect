const { obterProvider, embedPergunta } = require('../ingest/embedder');
const { criarVectorStoreSqlite } = require('./vectorStore');

/**
 * Executa busca semântica vetorial sobre os chunks indexados.
 *
 * Não captura erros de provedor (EmbeddingNaoConfiguradoError, ProvedorIndisponivelError):
 * a decisão de degradação para modo apenas lexical acontece na camada superior (T10).
 */
async function buscarVetorial(
  pergunta,
  { provider, k = 20, store = criarVectorStoreSqlite() } = {}
) {
  const prov = provider || obterProvider();
  const vetor = await embedPergunta(pergunta, { provider: prov });

  return await store.buscar(vetor, {
    k,
    embeddingModel: prov.info.model,
    dim: prov.info.dim,
  });
}

module.exports = {
  buscarVetorial,
};

