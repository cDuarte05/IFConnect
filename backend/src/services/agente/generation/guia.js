/**
 * Guia definitivo de orientação e navegação do portal IFConnect.
 * Fonte central de instruções sobre como usar as funcionalidades públicas do portal.
 * Interpola estritamente as constantes de limites.js.
 */

const {
  TITULO_MIN,
  TITULO_MAX,
  RESUMO_MAX,
  CONTEUDO_MAX,
  DESCRICAO_MAX,
  PALAVRAS_CHAVE_MAX,
  IMAGEM_MAX,
  MENSAGEM_APOIO_MAX,
  SENHA_MIN,
  SENHA_MAX,
  NOME_MIN,
  NOME_MAX,
  EMAIL_MAX,
  INSTITUICAO_MAX,
  BIO_MAX,
  TIPOS_ARTIGO,
  TEMAS,
} = require('../../../config/limites');

const { normalizar } = require('../retrieval/texto');
const { ehPerguntaDeNavegacao } = require('./intencao');

const GUIA_VERSAO = 1;

const STOPWORDS = new Set([
  'como',
  'para',
  'onde',
  'qual',
  'quais',
  'quem',
  'quando',
  'porque',
  'faco',
  'fazer',
  'posso',
  'pode',
  'mais',
  'muito',
  'site',
  'portal',
  'sobre',
  'pelo',
  'pela',
  'pelos',
  'pelas',
  'com',
  'sem',
  'dos',
  'das',
  'uma',
  'umas',
  'uns',
  'que',
  'funciona',
  'sistema',
  'geral',
]);

function formatarSecao(secao) {
  const linhas = [
    `Guia do Portal - ${secao.titulo}`,
    'Passos:',
    ...secao.passos.map((p, idx) => `${idx + 1}. ${p}`),
    'Observações:',
    ...secao.observacoes.map((o) => `- ${o}`),
  ];
  return linhas.join('\n');
}

function formatarSecoes(secoes) {
  return secoes.map(formatarSecao).join('\n\n');
}

const secaoConta = {
  id: 'conta',
  titulo: 'Criar conta e entrar',
  palavras: [
    'conta',
    'criar',
    'registro',
    'registrar',
    'cadastro',
    'cadastrar',
    'entrar',
    'login',
    'senha',
    'acesso',
    'perfil',
  ],
  perguntasExemplo: [
    'Como criar uma conta no portal?',
    'Como faço login no IFConnect?',
    'Quais os requisitos para cadastrar senha e email?',
    'Como entrar no portal para publicar?',
  ],
  passos: [
    'Acesse o portal e clique em "Entrar" no menu superior.',
    'Para novo cadastro, clique no link "Criar conta".',
    `Preencha nome (${NOME_MIN} a ${NOME_MAX} caracteres), email (até ${EMAIL_MAX} caracteres) e senha (${SENHA_MIN} a ${SENHA_MAX} caracteres).`,
    `Selecione seu perfil (Estudante, Jovem jornalista ou Membro da comunidade) e informe a instituição opcional (até ${INSTITUICAO_MAX} caracteres).`,
    'Clique no botão "Criar conta" para concluir o cadastro.',
    'Para acessar sua conta posteriormente, informe email e senha na tela de login e clique em "Entrar".',
  ],
  observacoes: [
    `Nome deve ter entre ${NOME_MIN} e ${NOME_MAX} caracteres; email até ${EMAIL_MAX} caracteres; senha de ${SENHA_MIN} a ${SENHA_MAX} caracteres; instituição até ${INSTITUICAO_MAX} caracteres; bio de perfil até ${BIO_MAX} caracteres.`,
    'Após entrar, seu primeiro nome e o acesso ao Perfil ficam visíveis no menu superior.',
  ],
};

const secaoPublicar = {
  id: 'publicar',
  titulo: 'Publicar artigos e notícias',
  palavras: [
    'publicar',
    'publicacao',
    'publicacoes',
    'artigo',
    'artigos',
    'noticia',
    'noticias',
    'escrever',
    'texto',
    'textos',
    'poema',
    'poemas',
    'enviar',
    'revisao',
  ],
  perguntasExemplo: [
    'Como publicar um artigo ou notícia no portal?',
    'Como enviar um texto para publicação?',
    'Quais os limites de tamanho para publicar um artigo?',
    'Como funciona o envio de uma publicação?',
  ],
  passos: [
    'Entre na sua conta clicando em "Entrar".',
    'No menu superior, clique em "Publicar".',
    `Selecione o tipo de publicação (${TIPOS_ARTIGO.join(', ')}).`,
    `Preencha o título (${TITULO_MIN} a ${TITULO_MAX} caracteres) e o resumo (${RESUMO_MAX} caracteres no máximo).`,
    `Digite o conteúdo completo da publicação (até ${CONTEUDO_MAX} caracteres).`,
    `Opcionalmente informe categoria, tema (${TEMAS.join(', ')}), palavras-chave (até ${PALAVRAS_CHAVE_MAX} caracteres) e imagem de capa (até ${IMAGEM_MAX} caracteres).`,
    'Clique em "Enviar para revisão".',
  ],
  observacoes: [
    `Limites obrigatórios: título de ${TITULO_MIN} a ${TITULO_MAX} caracteres, resumo até ${RESUMO_MAX} caracteres, conteúdo até ${CONTEUDO_MAX} caracteres, palavras-chave até ${PALAVRAS_CHAVE_MAX} caracteres e URL de imagem até ${IMAGEM_MAX} caracteres.`,
    `Tipos válidos: ${TIPOS_ARTIGO.join(', ')}. Temas válidos: ${TEMAS.join(', ')}.`,
    'Após o envio, a publicação entra em revisão antes de ficar pública no portal.',
    'Você pode acompanhar o andamento da revisão acessando o seu Perfil.',
  ],
};

const secaoProjeto = {
  id: 'projeto',
  titulo: 'Cadastrar projeto na vitrine científica',
  palavras: [
    'projeto',
    'projetos',
    'cadastrar',
    'vitrine',
    'campanha',
    'campanhas',
    'arrecadacao',
    'meta',
    'analise',
    'apoio',
  ],
  perguntasExemplo: [
    'Como cadastrar um projeto na vitrine científica?',
    'Como criar uma campanha de arrecadação?',
    'Quais os campos obrigatórios para cadastrar um projeto?',
    'Como divulgar meu projeto para apoio?',
  ],
  passos: [
    'Entre na sua conta no portal.',
    'Acesse "Vitrine científica" no menu superior e clique em "Cadastrar projeto".',
    `Informe o título do projeto (${TITULO_MIN} a ${TITULO_MAX} caracteres).`,
    `Preencha a descrição detalhada (até ${DESCRICAO_MAX} caracteres).`,
    'Informe a meta de arrecadação financeira em reais (valor maior que zero).',
    `Opcionalmente informe categoria, tema (${TEMAS.join(', ')}), palavras-chave (até ${PALAVRAS_CHAVE_MAX} caracteres), prazo final e URL de imagem de capa (até ${IMAGEM_MAX} caracteres).`,
    'Clique em "Enviar para análise".',
  ],
  observacoes: [
    `Limites: título de ${TITULO_MIN} a ${TITULO_MAX} caracteres, descrição até ${DESCRICAO_MAX} caracteres, palavras-chave até ${PALAVRAS_CHAVE_MAX} caracteres, imagem de capa até ${IMAGEM_MAX} caracteres e temas válidos: ${TEMAS.join(', ')}.`,
    'O projeto entra em análise antes de aparecer na vitrine científica pública.',
    'O status da análise pode ser acompanhado na seção Minhas campanhas no Perfil.',
  ],
};

const secaoApoiar = {
  id: 'apoiar',
  titulo: 'Apoiar projetos da vitrine',
  palavras: [
    'apoiar',
    'apoio',
    'apoiador',
    'doar',
    'doacao',
    'doacoes',
    'contribuir',
    'contribuicao',
    'financiar',
    'financiamento',
    'vitrine',
  ],
  perguntasExemplo: [
    'Como apoiar um projeto na vitrine?',
    'Como doar para uma campanha?',
    'Posso enviar uma mensagem de apoio ao projeto?',
    'Como funciona o apoio financeiro?',
  ],
  passos: [
    'Acesse a página "Vitrine científica" pelo menu superior.',
    'Clique no projeto ativo que deseja apoiar para abrir seus detalhes.',
    'Certifique-se de estar autenticado com sua conta.',
    'Localize a seção "Apoiar este projeto" na página.',
    'Informe o valor de contribuição desejado em reais (maior que zero).',
    `Se desejar, escreva uma mensagem de apoio (até ${MENSAGEM_APOIO_MAX} caracteres).`,
    'Clique no botão "Confirmar apoio".',
  ],
  observacoes: [
    `A mensagem de apoio é opcional e tem limite de até ${MENSAGEM_APOIO_MAX} caracteres.`,
    'O apoio registra seu compromisso e colaboração com a meta do projeto diretamente no portal.',
    'O portal não processa pagamentos financeiros reais nem transações bancárias diretas.',
    'Apenas projetos com situação ativa aceitam novos registros de apoio.',
  ],
};

const secaoBuscar = {
  id: 'buscar',
  titulo: 'Buscar publicações e projetos',
  palavras: [
    'buscar',
    'busca',
    'pesquisar',
    'pesquisa',
    'encontrar',
    'filtro',
    'filtros',
    'categoria',
    'tema',
    'vitrine',
    'publicacoes',
  ],
  perguntasExemplo: [
    'Como buscar artigos e publicações no portal?',
    'Como encontrar projetos na vitrine científica?',
    'Como filtrar por categoria ou tema?',
    'Onde pesquiso publicações?',
  ],
  passos: [
    'Para publicações, acesse a página inicial em "Publicações".',
    'No campo "Buscar", digite o título ou palavra-chave desejada.',
    `Utilize os filtros disponíveis por categoria, tema (${TEMAS.join(', ')}) ou tipos (${TIPOS_ARTIGO.join(', ')}).`,
    'Para projetos, acesse "Vitrine científica" no menu.',
    'Pesquise por palavra-chave no campo de busca ou filtre por categoria, tema e situação da campanha.',
    'Clique no item desejado na listagem para visualizar o conteúdo completo.',
  ],
  observacoes: [
    `Temas disponíveis para filtro: ${TEMAS.join(', ')}. Tipos de publicações: ${TIPOS_ARTIGO.join(', ')}.`,
    'A busca pública exibe somente artigos com status publicado e projetos ativos ou financiados.',
    'Conteúdos em revisão ou análise não aparecem nos resultados de busca do público.',
  ],
};

const secaoEditar = {
  id: 'editar',
  titulo: 'Editar publicações e projetos',
  palavras: [
    'editar',
    'edicao',
    'alterar',
    'alteracao',
    'modificar',
    'atualizar',
    'ajustar',
    'correcao',
    'resubmeter',
    'resubmissao',
  ],
  perguntasExemplo: [
    'Como editar minha publicação?',
    'Quando posso alterar um projeto cadastrado?',
    'Posso editar um artigo já publicado?',
    'Como atualizar meus dados de perfil?',
  ],
  passos: [
    'Acesse seu "Perfil" no menu superior.',
    'Localize o item desejado em "Minhas publicações" ou "Minhas campanhas".',
    'Se o item estiver liberado para alteração, clique no link "editar".',
    'Atualize as informações desejadas no formulário.',
    'Clique no botão de salvar para confirmar as alterações.',
    `Para atualizar seus dados cadastrais (nome de ${NOME_MIN} a ${NOME_MAX}, instituição até ${INSTITUICAO_MAX}, bio até ${BIO_MAX}), edite o formulário em Perfil e clique em "Salvar".`,
  ],
  observacoes: [
    `Limites para edição de perfil: nome de ${NOME_MIN} a ${NOME_MAX} caracteres, instituição até ${INSTITUICAO_MAX} caracteres e bio até ${BIO_MAX} caracteres.`,
    `Limites na edição de publicações e projetos respeitam título de ${TITULO_MIN} a ${TITULO_MAX}, resumo até ${RESUMO_MAX}, conteúdo até ${CONTEUDO_MAX} e descrição até ${DESCRICAO_MAX} caracteres.`,
    'Publicações só podem ser editadas pelo autor enquanto não aprovadas (em revisão ou recusadas). Publicações aprovadas não podem mais ser alteradas pelo autor.',
    'Ao editar uma publicação que foi recusada, ela retorna automaticamente para a fila de revisão.',
    'Projetos só podem ser editados pelo autor enquanto estiverem com status em análise. Projetos já avaliados não podem mais ser editados.',
  ],
};

const secaoAcompanhar = {
  id: 'acompanhar',
  titulo: 'Acompanhar status e publicações',
  palavras: [
    'acompanhar',
    'acompanhamento',
    'status',
    'situacao',
    'revisao',
    'analise',
    'aprovado',
    'aprovacao',
    'recusado',
    'recusa',
    'minhas',
  ],
  perguntasExemplo: [
    'Onde acompanho o status das minhas publicações?',
    'Como saber se meu projeto foi aprovado?',
    'O que acontece após enviar para revisão?',
    'Onde vejo minhas campanhas cadastradas?',
  ],
  passos: [
    'Faça login com seu email e senha no portal.',
    'Clique em "Perfil" na barra de navegação superior.',
    'Na seção "Minhas publicações", consulte a situação de cada artigo (Rascunho, Em revisão, Publicado ou Recusado).',
    'Na seção "Minhas campanhas", consulte a situação de cada projeto (Em análise, Ativa na vitrine, Meta atingida ou Encerrada).',
    'Clique em "ver" para visualizar o item ou em "editar" caso ainda esteja em fase que permita alteração.',
  ],
  observacoes: [
    'Toda publicação e todo projeto cadastrado passa por análise antes de se tornar visível publicamente.',
    'Após aprovação, publicações ficam listadas na página inicial e campanhas passam para a vitrine científica.',
    'Itens com status em revisão ou em análise permanecem privados ao autor até sua liberação.',
  ],
};

const GUIA_SECOES = [
  secaoConta,
  secaoPublicar,
  secaoProjeto,
  secaoApoiar,
  secaoBuscar,
  secaoEditar,
  secaoAcompanhar,
];

function pontuarSecao(secao, textoPergunta, tokensPergunta) {
  let score = 0;

  // Casamento exato do id
  if (tokensPergunta.includes(secao.id)) {
    score += 10;
  }

  // Casamento de palavras-chave
  for (const palavra of secao.palavras) {
    const palavraNorm = normalizar(palavra);
    if (STOPWORDS.has(palavraNorm)) continue;

    if (tokensPergunta.includes(palavraNorm)) {
      score += 5;
    } else if (palavraNorm.length >= 5 && textoPergunta.includes(palavraNorm)) {
      score += 2;
    }
  }

  // Casamento de tokens do título
  const tokensTitulo = normalizar(secao.titulo)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  for (const t of tokensTitulo) {
    if (tokensPergunta.includes(t)) {
      score += 3;
    }
  }

  // Casamento com perguntas de exemplo
  for (const ex of secao.perguntasExemplo) {
    const tokensEx = normalizar(ex)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
    for (const t of tokensEx) {
      if (tokensPergunta.includes(t)) {
        score += 1;
      }
    }
  }

  return score;
}

function selecionarGuia(pergunta, { max = 2 } = {}) {
  if (typeof pergunta !== 'string' || !pergunta.trim()) {
    return { texto: '', ids: [] };
  }

  const textoNorm = normalizar(pergunta);
  const tokens = textoNorm.split(/[^a-z0-9]+/).filter(Boolean);

  const secoesPontuadas = GUIA_SECOES.map((secao) => ({
    secao,
    score: pontuarSecao(secao, textoNorm, tokens),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (secoesPontuadas.length > 0) {
    const escolhidas = secoesPontuadas.slice(0, max).map((item) => item.secao);
    return {
      texto: formatarSecoes(escolhidas),
      ids: escolhidas.map((s) => s.id),
    };
  }

  // Sem correspondência direta: se for pergunta de navegação, retorna seções publicar + buscar
  if (ehPerguntaDeNavegacao(pergunta)) {
    const padrao = [secaoPublicar, secaoBuscar];
    return {
      texto: formatarSecoes(padrao),
      ids: ['publicar', 'buscar'],
    };
  }

  return { texto: '', ids: [] };
}

module.exports = {
  GUIA_VERSAO,
  GUIA_SECOES,
  formatarSecao,
  formatarSecoes,
  selecionarGuia,
};
