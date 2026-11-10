const { getConfig } = require('../config');
const { getEmbeddingProvider } = require('../providers/embedding');
const { ProvedorIndisponivelError } = require('../providers/errors');

const CACHE_MAX_PADRAO = 200;
const CACHE_TTL_MS_PADRAO = 10 * 60 * 1000;

/**
 * Erro lançado quando o provedor de embedding não está configurado
 * (por exemplo, ausência de AGENTE_RAG_EMBEDDING_API_KEY para o provedor gemini).
 */
class EmbeddingNaoConfiguradoError extends Error {
  constructor(mensagem = 'Provedor de embedding não configurado. Verifique AGENTE_RAG_EMBEDDING_API_KEY.') {
    super(mensagem);
    this.name = 'EmbeddingNaoConfiguradoError';
  }
}

function normalizarTextoChave(texto) {
  return texto.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Cache LRU em memória com expiração por TTL e relógio injetável para testes.
 */
function criarCacheLru({ max = CACHE_MAX_PADRAO, ttlMs = CACHE_TTL_MS_PADRAO, agora = Date.now } = {}) {
  const entradas = new Map();

  function get(chave) {
    if (!entradas.has(chave)) return undefined;
    const item = entradas.get(chave);

    if (agora() - item.criadoEm >= ttlMs) {
      entradas.delete(chave);
      return undefined;
    }

    // Atualiza posição para mais recentemente usada (LRU)
    entradas.delete(chave);
    entradas.set(chave, item);
    return item.valor;
  }

  function set(chave, valor) {
    if (max <= 0) return;

    if (entradas.has(chave)) {
      entradas.delete(chave);
    } else if (entradas.size >= max) {
      const maisAntiga = entradas.keys().next().value;
      entradas.delete(maisAntiga);
    }

    entradas.set(chave, { valor, criadoEm: agora() });
  }

  function clear() {
    entradas.clear();
  }

  return {
    get,
    set,
    clear,
    get size() {
      return entradas.size;
    },
  };
}

const cachePadrao = criarCacheLru();

function limparCache() {
  cachePadrao.clear();
}

/**
 * Obtém a instância do provedor de embedding a partir da configuração.
 * Lança EmbeddingNaoConfiguradoError se nenhum provedor válido estiver disponível.
 */
function obterProvider(config = getConfig()) {
  const provider = getEmbeddingProvider(config);
  if (!provider) {
    const nome = config?.rag?.embeddingProvider || 'desconhecido';
    throw new EmbeddingNaoConfiguradoError(
      `Provedor de embedding "${nome}" não configurado. Defina AGENTE_RAG_EMBEDDING_API_KEY ou ajuste AGENTE_RAG_EMBEDDING_PROVIDER.`
    );
  }
  return provider;
}

/**
 * Extrai metadados reais (modelo e dimensão) diretamente de provider.info.
 */
function descreverProvider(provider) {
  if (!provider || !provider.info) {
    throw new TypeError('Provider de embedding inválido.');
  }
  return {
    model: provider.info.model,
    dim: provider.info.dim,
  };
}

function validarDimensaoVetor(vetor, dimEsperada, provedorNome) {
  if (!Array.isArray(vetor) || vetor.length !== dimEsperada) {
    throw new ProvedorIndisponivelError(
      `Dimensão do vetor recebido (${Array.isArray(vetor) ? vetor.length : 0}) difere da esperada (${dimEsperada}).`,
      { provedor: provedorNome }
    );
  }
}

/**
 * Gera embeddings para uma lista de documentos, deduplicando textos idênticos
 * na chamada e devolvendo os vetores alinhados à ordem original.
 */
async function embedDocumentos(textos, { provider } = {}) {
  if (!Array.isArray(textos)) {
    throw new TypeError('textos deve ser um array de strings não vazias.');
  }

  for (let i = 0; i < textos.length; i++) {
    if (typeof textos[i] !== 'string' || !textos[i].trim()) {
      throw new TypeError(`Item na posição ${i} deve ser uma string não vazia.`);
    }
  }

  if (textos.length === 0) {
    return [];
  }

  const prov = provider || obterProvider();
  const { dim } = descreverProvider(prov);
  const provedorNome = prov.info.provider;

  const unicos = [];
  const mapaIndice = new Map();
  for (const texto of textos) {
    if (!mapaIndice.has(texto)) {
      mapaIndice.set(texto, unicos.length);
      unicos.push(texto);
    }
  }

  const vetoresUnicos = await prov.embedDocuments(unicos);
  if (!Array.isArray(vetoresUnicos) || vetoresUnicos.length !== unicos.length) {
    throw new ProvedorIndisponivelError(
      `Quantidade de vetores retornada (${Array.isArray(vetoresUnicos) ? vetoresUnicos.length : 0}) difere da esperada (${unicos.length}).`,
      { provedor: provedorNome }
    );
  }

  for (const vetor of vetoresUnicos) {
    validarDimensaoVetor(vetor, dim, provedorNome);
  }

  return textos.map((texto) => vetoresUnicos[mapaIndice.get(texto)]);
}

/**
 * Gera o embedding de uma pergunta com cache LRU em memória.
 * Apenas respostas válidas são armazenadas em cache; falhas propagam o erro.
 */
async function embedPergunta(texto, { provider, cache = cachePadrao } = {}) {
  if (typeof texto !== 'string' || !texto.trim()) {
    throw new TypeError('texto da pergunta deve ser uma string não vazia.');
  }

  const prov = provider || obterProvider();
  const { model, dim } = descreverProvider(prov);
  const provedorNome = prov.info.provider;

  const chave = `${model}|${dim}|${normalizarTextoChave(texto)}`;
  const emCache = cache ? cache.get(chave) : undefined;
  if (emCache !== undefined) {
    return emCache;
  }

  const vetor = await prov.embedQuery(texto);
  validarDimensaoVetor(vetor, dim, provedorNome);

  if (cache) {
    cache.set(chave, vetor);
  }

  return vetor;
}

module.exports = {
  EmbeddingNaoConfiguradoError,
  obterProvider,
  descreverProvider,
  embedDocumentos,
  embedPergunta,
  criarCacheLru,
  limparCache,
};

