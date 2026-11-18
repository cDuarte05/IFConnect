/**
 * Contexto da página aberta no frontend do IFConnect.
 * Detecta quando uma pergunta se refere à página/documento atual
 * e carrega os dados completos da publicação ou projeto do banco.
 */

const { Article, Campaign, Category } = require('../../../models');
const { normalizar } = require('../retrieval/texto');
const {
  montarDocumentoArtigo,
  montarDocumentoCampanha,
  dividirDocumento,
} = require('../ingest/chunker');

const MAX_CHARS_PAGINA = 12000;
const STATUS_PUBLICOS_CAMPANHA = ['ativa', 'financiada'];

const EXPRESSOES_FIXAS = [
  /\bdo que se trata\b/,
  /\bo que (e|eh) isso\b/,
  /\bresuma isso\b/,
  /\bprincipais pontos\b/,
];

const DEITICOS_ESTRITOS = [
  'este',
  'esta',
  'estes',
  'estas',
  'esse',
  'essa',
  'esses',
  'essas',
  'deste',
  'desta',
  'destes',
  'destas',
  'desse',
  'dessa',
  'desses',
  'dessas',
  'neste',
  'nesta',
  'nestes',
  'nestas',
  'nesse',
  'nessa',
  'nesses',
  'nessas',
  'isso',
  'isto',
  'disso',
  'disto',
  'nisso',
  'nisto',
  'aqui',
  'daqui',
  'atual',
  'aberto',
  'aberta',
  'abertos',
  'abertas',
];

const DEITICOS_TODOS = [
  ...DEITICOS_ESTRITOS,
  'tela',
  'telas',
  'pagina',
  'paginas',
];

const SUBSTANTIVOS = [
  'noticia',
  'noticias',
  'publicacao',
  'publicacoes',
  'artigo',
  'artigos',
  'texto',
  'textos',
  'poema',
  'poemas',
  'projeto',
  'projetos',
  'campanha',
  'campanhas',
  'pagina',
  'paginas',
  'tela',
  'telas',
];

const REGEX_VERBO_RESUMO = /\b(resum\w*|explic\w*|expliq\w*|traduz\w*|simplific\w*|simplifiq\w*)\b/;
const REGEX_DEITICO = new RegExp(`\\b(${DEITICOS_TODOS.join('|')})\\b`);
const REGEX_DEITICO_ESTRITO = new RegExp(`\\b(${DEITICOS_ESTRITOS.join('|')})\\b`);
const REGEX_SUBSTANTIVO = new RegExp(`\\b(${SUBSTANTIVOS.join('|')})\\b`);

/**
 * Avalia se uma pergunta se refere ao conteúdo da página atualmente aberta.
 * @param {string} pergunta
 * @returns {boolean}
 */
function ehPerguntaSobrePagina(pergunta) {
  if (typeof pergunta !== 'string' || !pergunta.trim()) return false;

  const texto = normalizar(pergunta);

  // 1. Expressões fixas diretas
  for (const regex of EXPRESSOES_FIXAS) {
    if (regex.test(texto)) return true;
  }

  // 2. Verbos de resumo/explicação + dêitico (ex.: "resuma isso", "explique esta página")
  if (REGEX_VERBO_RESUMO.test(texto) && REGEX_DEITICO.test(texto)) {
    return true;
  }

  // 3. Dêitico estrito + substantivo de publicação/projeto (ex.: "esta notícia", "este artigo", "esse projeto")
  if (REGEX_DEITICO_ESTRITO.test(texto) && REGEX_SUBSTANTIVO.test(texto)) {
    return true;
  }

  return false;
}

/**
 * Carrega a fonte pública completa para o contexto da página aberta.
 * Retorna null se não encontrada ou se não for pública.
 * @param {{ tipo: string, id: string }} pagina
 * @returns {Promise<object|null>}
 */
async function carregarContextoPagina(pagina) {
  if (!pagina || typeof pagina !== 'object') return null;
  const { tipo, id } = pagina;
  if (!tipo || !id) return null;

  if (tipo === 'publicacao' || tipo === 'artigo') {
    const artigo = await Article.findOne({
      where: { id, status: 'publicado' },
      include: [{ model: Category, as: 'categoria', attributes: ['nome'] }],
    });
    if (!artigo) return null;

    const doc = montarDocumentoArtigo(artigo);
    const chunks = dividirDocumento(doc);

    const trechos = [];
    let totalChars = 0;
    let truncado = false;

    for (const c of chunks) {
      const tam = c.texto.length;
      if (totalChars + tam <= MAX_CHARS_PAGINA) {
        trechos.push(c.texto);
        totalChars += tam;
      } else {
        const sobra = MAX_CHARS_PAGINA - totalChars;
        if (sobra > 50) {
          trechos.push(c.texto.slice(0, sobra));
          totalChars += sobra;
        }
        truncado = true;
        break;
      }
    }

    return {
      ref: 1,
      paginaAberta: true,
      tipo: 'publicacao',
      id: artigo.id,
      titulo: artigo.titulo,
      url: `/publicacoes/${artigo.id}`,
      categoria: artigo.categoria?.nome || null,
      tema: artigo.tema || null,
      tipoPublicacao: artigo.tipo,
      status: 'publicado',
      resumo: artigo.resumo,
      trechos,
      truncado,
    };
  }

  if (tipo === 'projeto' || tipo === 'campanha') {
    const campanha = await Campaign.findOne({
      where: { id, status: STATUS_PUBLICOS_CAMPANHA },
      include: [{ model: Category, as: 'categoria', attributes: ['nome'] }],
    });
    if (!campanha) return null;

    const doc = montarDocumentoCampanha(campanha);
    const chunks = dividirDocumento(doc);

    const trechos = [];
    let totalChars = 0;
    let truncado = false;

    for (const c of chunks) {
      const tam = c.texto.length;
      if (totalChars + tam <= MAX_CHARS_PAGINA) {
        trechos.push(c.texto);
        totalChars += tam;
      } else {
        const sobra = MAX_CHARS_PAGINA - totalChars;
        if (sobra > 50) {
          trechos.push(c.texto.slice(0, sobra));
          totalChars += sobra;
        }
        truncado = true;
        break;
      }
    }

    return {
      ref: 1,
      paginaAberta: true,
      tipo: 'projeto',
      id: campanha.id,
      titulo: campanha.titulo,
      url: `/vitrine/${campanha.id}`,
      categoria: campanha.categoria?.nome || null,
      tema: campanha.tema || null,
      status: campanha.status,
      meta: Number(campanha.metaFinanceira),
      arrecadado: Number(campanha.valorArrecadado),
      prazoFinal: campanha.prazoFinal
        ? (campanha.prazoFinal instanceof Date
            ? campanha.prazoFinal.toISOString()
            : String(campanha.prazoFinal))
        : null,
      trechos,
      truncado,
    };
  }

  return null;
}

module.exports = {
  MAX_CHARS_PAGINA,
  ehPerguntaSobrePagina,
  carregarContextoPagina,
};
