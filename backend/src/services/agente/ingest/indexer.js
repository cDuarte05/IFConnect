const { sequelize, Article, Campaign, Category, AgentChunk } = require('../../../models');
const { getConfig } = require('../config');
const {
  montarDocumentoArtigo,
  montarDocumentoCampanha,
  dividirDocumento,
  hashDocumento,
} = require('./chunker');
const embedder = require('./embedder');
const {
  obterProvider,
  descreverProvider,
  EmbeddingNaoConfiguradoError,
} = embedder;

/**
 * 1) Regras de visibilidade pública do IFConnect
 * - artigo é público somente com status 'publicado'
 * - campanha é pública somente com status 'ativa' ou 'financiada'
 */
const STATUS_PUBLICO_ARTIGO = ['publicado'];
const STATUS_PUBLICO_CAMPANHA = ['ativa', 'financiada'];

function ehPublico(sourceType, status) {
  if (sourceType === 'artigo') {
    return STATUS_PUBLICO_ARTIGO.includes(status);
  }
  if (sourceType === 'campanha') {
    return STATUS_PUBLICO_CAMPANHA.includes(status);
  }
  return false;
}

/**
 * 3) removerFonte(sourceType, sourceId) -> Promise<number>
 * Remove todos os chunks existentes para uma dada fonte.
 */
async function removerFonte(sourceType, sourceId) {
  return await AgentChunk.destroy({
    where: { sourceType, sourceId },
  });
}

/**
 * Carrega a fonte do banco de dados com seus atributos públicos e categoria associada.
 * NÃO carrega autor nem valores financeiros (RN-02 e RN-05).
 */
async function carregarFonte(sourceType, sourceId) {
  if (sourceType === 'artigo') {
    return await Article.findByPk(sourceId, {
      attributes: ['id', 'titulo', 'resumo', 'conteudo', 'tipo', 'tema', 'palavrasChave', 'status'],
      include: [{ model: Category, as: 'categoria', attributes: ['nome'] }],
    });
  }
  if (sourceType === 'campanha') {
    return await Campaign.findByPk(sourceId, {
      attributes: ['id', 'titulo', 'descricao', 'tema', 'palavrasChave', 'status'],
      include: [{ model: Category, as: 'categoria', attributes: ['nome'] }],
    });
  }
  return null;
}

/**
 * 2) indexarFonte(sourceType, sourceId, opcoes)
 */
async function indexarFonte(
  sourceType,
  sourceId,
  { config = getConfig(), provider: providerCustom, force = false, dryRun = false } = {}
) {
  // a) Carrega a fonte do banco com a categoria
  const fonte = await carregarFonte(sourceType, sourceId);

  // b) Fonte inexistente OU não pública -> removerFonte (a menos que dryRun)
  if (!fonte || !ehPublico(sourceType, fonte.status)) {
    const existentes = await AgentChunk.count({ where: { sourceType, sourceId } });
    if (existentes > 0) {
      if (!dryRun) {
        await removerFonte(sourceType, sourceId);
      }
      return { acao: 'removido', chunks: existentes };
    }
    return { acao: 'ignorado', chunks: 0, motivo: 'sem_chunks' };
  }

  // c) Obter provider: usar o recebido; senão obterProvider(config).
  // Se lançar EmbeddingNaoConfiguradoError -> retorna { acao:'ignorado', motivo:'embedding_nao_configurado' }
  // SEM apagar chunks existentes.
  let prov;
  try {
    prov = providerCustom || obterProvider(config);
  } catch (err) {
    if (err instanceof EmbeddingNaoConfiguradoError) {
      return { acao: 'ignorado', chunks: 0, motivo: 'embedding_nao_configurado' };
    }
    throw err;
  }

  const { model: embeddingModel, dim } = descreverProvider(prov);

  // d) doc = montarDocumentoArtigo|montarDocumentoCampanha; hash = hashDocumento(doc);
  // chunksAlvo = dividirDocumento(doc). Sem chunks -> trate como fonte vazia (remove existentes).
  const doc =
    sourceType === 'artigo'
      ? montarDocumentoArtigo(fonte)
      : montarDocumentoCampanha(fonte);

  const hash = hashDocumento(doc);
  const chunksAlvo = dividirDocumento(doc);

  if (!chunksAlvo.length) {
    const existentes = await AgentChunk.count({ where: { sourceType, sourceId } });
    if (existentes > 0) {
      if (!dryRun) {
        await removerFonte(sourceType, sourceId);
      }
      return { acao: 'removido', chunks: existentes };
    }
    return { acao: 'ignorado', chunks: 0, motivo: 'sem_chunks' };
  }

  // e) Se !force e os chunks existentes têm: mesma quantidade de chunksAlvo, todos com
  // contentHash === hash, embeddingModel === provider.info.model e dim === provider.info.dim
  // -> 'inalterado' (sem chamar embedding).
  const chunksExistentes = await AgentChunk.findAll({
    where: { sourceType, sourceId },
    order: [['chunkIndex', 'ASC']],
  });

  const mesmoHashEModelo =
    chunksExistentes.length === chunksAlvo.length &&
    chunksExistentes.every(
      (c) =>
        c.contentHash === hash &&
        c.embeddingModel === embeddingModel &&
        c.dim === dim
    );

  if (!force && mesmoHashEModelo) {
    return { acao: 'inalterado', chunks: chunksExistentes.length };
  }

  // f) dryRun: retorna a ação que seria feita sem embedar nem gravar.
  if (dryRun) {
    return { acao: 'indexado', chunks: chunksAlvo.length };
  }

  // g) Embeda TODOS os textos ANTES de abrir transação (usar embedDocumentos).
  const textosParaEmbedar = chunksAlvo.map((c) => c.texto);
  const vetores = await embedder.embedDocumentos(textosParaEmbedar, { provider: prov });

  // Depois, em UMA sequelize.transaction: destroy dos chunks antigos da fonte + bulkCreate dos novos com
  // { validate: true }. Se o embedding falhou antes, a exceção propagou e os chunks antigos permanecem intactos.
  await sequelize.transaction(async (t) => {
    await AgentChunk.destroy({
      where: { sourceType, sourceId },
      transaction: t,
    });

    const registrosNovos = chunksAlvo.map((chunk, index) => ({
      sourceType,
      sourceId,
      chunkIndex: chunk.chunkIndex,
      texto: chunk.texto,
      contentHash: hash,
      embedding: vetores[index],
      embeddingModel,
      dim,
    }));

    await AgentChunk.bulkCreate(registrosNovos, {
      validate: true,
      transaction: t,
    });
  });

  return { acao: 'indexado', chunks: chunksAlvo.length };
}

/**
 * 4) Disparo seguro e serialização
 */
const filaSerializacao = new Map();
const pendentes = new Set();

/**
 * Executa indexarFonte garantindo que duas chamadas para a mesma fonte
 * sejam serializadas e nunca concorram entre si.
 * NUNCA rejeita: captura qualquer erro e loga aviso (exceto no ambiente de teste).
 */
function indexarFonteSeguro(sourceType, sourceId, opcoes) {
  const chave = `${sourceType}:${sourceId}`;
  const promiseAnterior = filaSerializacao.get(chave) || Promise.resolve();

  const promiseAtual = promiseAnterior
    .then(async () => {
      try {
        return await indexarFonte(sourceType, sourceId, opcoes);
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[agente] indexação falhou', sourceType, sourceId, err.message);
        }
        return { acao: 'falha', chunks: 0, motivo: err.message };
      }
    })
    .finally(() => {
      if (filaSerializacao.get(chave) === promiseAtual) {
        filaSerializacao.delete(chave);
      }
    });

  filaSerializacao.set(chave, promiseAtual);
  return promiseAtual;
}

/**
 * Agenda a indexação em segundo plano sem travar o chamador.
 * Registra a promise no Set de pendentes para testes e shutdown seguro.
 */
function agendarIndexacao(sourceType, sourceId) {
  const config = getConfig();
  if (!config.enabled || !config.rag.enabled) {
    return;
  }

  const promise = indexarFonteSeguro(sourceType, sourceId, { config });
  pendentes.add(promise);
  promise.finally(() => {
    pendentes.delete(promise);
  });
}

/**
 * Aguarda todas as indexações pendentes terminarem.
 */
async function aguardarPendentes() {
  while (pendentes.size > 0) {
    await Promise.all(Array.from(pendentes));
  }
}

module.exports = {
  STATUS_PUBLICO_ARTIGO,
  STATUS_PUBLICO_CAMPANHA,
  ehPublico,
  indexarFonte,
  removerFonte,
  indexarFonteSeguro,
  agendarIndexacao,
  aguardarPendentes,
};
