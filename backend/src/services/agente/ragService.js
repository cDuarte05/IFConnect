const { Category } = require('../../models');
const { getConfig } = require('./config');
const hybrid = require('./retrieval/hybrid');
const { getLlmProvider } = require('./providers/llm');
const {
  SYSTEM_PROMPT_RAG,
  sanitizarPergunta,
  montarMensagemUsuario,
} = require('./generation/prompt');
const { processarCitacoes } = require('./generation/citacoes');
const { ehPerguntaDeNavegacao } = require('./generation/intencao');
const { selecionarGuia } = require('./generation/guia');
const { ehPerguntaSobrePagina, carregarContextoPagina } = require('./generation/pagina');

/**
 * Orquestra recuperação (T10) + guia do portal (V3-A) + contexto da página (V3-B)
 * + geração (T11) + degradação segura (seção 11 da spec).
 *
 * Esta função NÃO importa agenteService (evita dependência circular). Falhas inesperadas
 * (ex.: erro na recuperação) propagam: quem decide cair no fluxo legado é o agenteService.
 */

const MSG_SEM_RESULTADO =
  'Não encontrei publicações ou projetos relacionados à sua pergunta. Tente outras palavras-chave.';
const MSG_ENCONTRADOS = 'Encontrei estes conteúdos publicados relacionados à sua pergunta:';
const MSG_NAVEGACAO_ESTATICA =
  "Publicações ficam na página inicial e projetos na Vitrine científica. Para publicar é preciso entrar ou criar uma conta e usar 'Publicar' ou 'Cadastrar projeto'. Novos conteúdos passam por análise antes de ficarem públicos.";
const MSG_SEM_PAGINA_ABERTA =
  'Não consigo ver uma página aberta. Abra uma publicação ou um projeto e pergunte de novo.';
const MSG_PAGINA_INACESSIVEL =
  'Não consegui acessar o conteúdo desta página. Só posso resumir publicações e projetos já publicados.';

// Delega via módulo para permitir substituição (spy) em testes.
const recuperarPadrao = (...args) => hybrid.recuperar(...args);

function avisar(mensagem, err) {
  if (process.env.NODE_ENV !== 'test') {
    // Nunca logar pergunta, contexto nem chaves: apenas a mensagem do erro.
    console.warn(mensagem, err && err.message);
  }
}

const formatarFonte = (f) => ({
  ref: f.ref,
  tipo: f.tipo,
  id: f.id,
  titulo: f.titulo,
  url: f.url,
});

async function mensagemSemResultado() {
  const categorias = await Category.findAll({ attributes: ['nome'], order: [['nome', 'ASC']] });
  const nomes = categorias.map((c) => c.nome);
  const cats = nomes.length ? ` Categorias disponíveis: ${nomes.join(', ')}.` : '';
  return `${MSG_SEM_RESULTADO}${cats}`;
}

function fallbackBusca(recuperadas, guiaTexto = '') {
  if (guiaTexto) {
    return { resposta: guiaTexto, fontes: recuperadas.map(formatarFonte), modo: 'busca' };
  }
  if (recuperadas.length) {
    return { resposta: MSG_ENCONTRADOS, fontes: recuperadas.map(formatarFonte), modo: 'busca' };
  }
  return { resposta: MSG_NAVEGACAO_ESTATICA, fontes: [], modo: 'busca' };
}

async function consultarRag(
  perguntaBruta,
  {
    config = getConfig(),
    recuperarFn = recuperarPadrao,
    llm = getLlmProvider,
    selecionarGuiaFn = selecionarGuia,
    carregarContextoPaginaFn = carregarContextoPagina,
    pagina,
  } = {}
) {
  // a) A rota já validou o tamanho; aqui apenas normalizamos/removemos "<" e ">"
  const pergunta = sanitizarPergunta(perguntaBruta);

  // b) Tratamento de pergunta sobre a página atualmente aberta
  let recuperadas;
  const sobrePagina = ehPerguntaSobrePagina(pergunta);

  if (sobrePagina) {
    if (!pagina || !pagina.id) {
      return { resposta: MSG_SEM_PAGINA_ABERTA, fontes: [], modo: 'busca' };
    }
    const fontePagina = await carregarContextoPaginaFn(pagina);
    if (!fontePagina) {
      return { resposta: MSG_PAGINA_INACESSIVEL, fontes: [], modo: 'busca' };
    }
    // Usa [fontePagina] como único contexto (pula a recuperação)
    recuperadas = [fontePagina];
  } else {
    // Se NÃO é sobre a página, pagina é ignorada: nada do conteúdo dela entra no prompt
    const { fontes } = await recuperarFn(pergunta, { config });
    recuperadas = fontes;
  }

  // c) Seleção do guia de orientação para dúvidas de uso do portal
  const { texto: guiaTexto } = selecionarGuiaFn(pergunta);

  // d) Sem contexto e sem guia: pergunta de conteúdo NÃO chama o LLM (RF-11)
  // Contexto vazio não impede responder dúvidas de uso
  const navegacao = ehPerguntaDeNavegacao(pergunta);
  const temDuvidaUso = !!guiaTexto || navegacao;

  if (!recuperadas.length && !temDuvidaUso) {
    return { resposta: await mensagemSemResultado(), fontes: [], modo: 'busca' };
  }

  // e) Geração com LLM
  const provedor = llm(config.provider);
  if (!provedor || !config.apiKey) {
    avisar('[agente] provedor/chave não configurados — usando modo busca');
    return fallbackBusca(recuperadas, guiaTexto);
  }

  const { mensagem, refsIncluidas } = montarMensagemUsuario(pergunta, recuperadas, { guia: guiaTexto });

  let respostaLlm;
  try {
    respostaLlm = await provedor.generate({ system: SYSTEM_PROMPT_RAG, user: mensagem, config });
  } catch (err) {
    avisar('[agente] provedor indisponível, usando fallback:', err);
    return fallbackBusca(recuperadas, guiaTexto);
  }

  if (!respostaLlm) return fallbackBusca(recuperadas, guiaTexto);

  const { texto, refsCitadas } = processarCitacoes(respostaLlm, refsIncluidas);
  if (!texto) return fallbackBusca(recuperadas, guiaTexto);

  // Fontes finais: as citadas (ordem por ref); se nenhuma, todas as enviadas como contexto
  const refsFinais = refsCitadas.length ? [...refsCitadas].sort((a, b) => a - b) : refsIncluidas;
  const fontes = recuperadas.filter((f) => refsFinais.includes(f.ref)).map(formatarFonte);

  return { resposta: texto, fontes, modo: 'rag' };
}

module.exports = {
  consultarRag,
  MSG_SEM_RESULTADO,
  MSG_ENCONTRADOS,
  MSG_NAVEGACAO_ESTATICA,
  MSG_SEM_PAGINA_ABERTA,
  MSG_PAGINA_INACESSIVEL,
};
