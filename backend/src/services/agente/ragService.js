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

/**
 * Orquestra recuperação (T10) + geração (T11) + degradação segura (seção 11 da spec).
 *
 * Esta função NÃO importa agenteService (evita dependência circular). Falhas inesperadas
 * (ex.: erro na recuperação) propagam: quem decide cair no fluxo legado é o agenteService.
 */

const MSG_SEM_RESULTADO =
  'Não encontrei publicações ou projetos relacionados à sua pergunta. Tente outras palavras-chave.';
const MSG_ENCONTRADOS = 'Encontrei estes conteúdos publicados relacionados à sua pergunta:';
const MSG_NAVEGACAO_ESTATICA =
  "Publicações ficam na página inicial e projetos na Vitrine científica. Para publicar é preciso entrar ou criar uma conta e usar 'Publicar' ou 'Cadastrar projeto'. Novos conteúdos passam por análise antes de ficarem públicos.";

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

function fallbackBusca(recuperadas) {
  if (recuperadas.length) {
    return { resposta: MSG_ENCONTRADOS, fontes: recuperadas.map(formatarFonte), modo: 'busca' };
  }
  return { resposta: MSG_NAVEGACAO_ESTATICA, fontes: [], modo: 'busca' };
}

async function consultarRag(
  perguntaBruta,
  { config = getConfig(), recuperarFn = recuperarPadrao, llm = getLlmProvider } = {}
) {
  // a) A rota já validou o tamanho; aqui apenas normalizamos/removemos "<" e ">"
  const pergunta = sanitizarPergunta(perguntaBruta);

  // b) Recuperação híbrida (já filtrada por status público no banco)
  const { fontes: recuperadas } = await recuperarFn(pergunta, { config });

  // c) Sem contexto: pergunta de conteúdo NÃO chama o LLM (RF-11)
  const navegacao = ehPerguntaDeNavegacao(pergunta);
  if (!recuperadas.length && !navegacao) {
    return { resposta: await mensagemSemResultado(), fontes: [], modo: 'busca' };
  }

  // d) Geração com LLM
  const provedor = llm(config.provider);
  if (!provedor || !config.apiKey) {
    avisar('[agente] provedor/chave não configurados — usando modo busca');
    return fallbackBusca(recuperadas);
  }

  const { mensagem, refsIncluidas } = montarMensagemUsuario(pergunta, recuperadas);

  let respostaLlm;
  try {
    respostaLlm = await provedor.generate({ system: SYSTEM_PROMPT_RAG, user: mensagem, config });
  } catch (err) {
    avisar('[agente] provedor indisponível, usando fallback:', err);
    return fallbackBusca(recuperadas);
  }

  if (!respostaLlm) return fallbackBusca(recuperadas);

  const { texto, refsCitadas } = processarCitacoes(respostaLlm, refsIncluidas);
  if (!texto) return fallbackBusca(recuperadas);

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
};

