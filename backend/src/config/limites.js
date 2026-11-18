/**
 * Limites e regras de validação como fonte única de verdade do portal IFConnect.
 * Todas as rotas e o guia de navegação/orientação devem derivar destes valores.
 */

const LIMITES = {
  // Publicações e Vitrine
  TITULO_MIN: 10,
  TITULO_MAX: 150,
  RESUMO_MAX: 300,
  CONTEUDO_MAX: 20000,
  DESCRICAO_MAX: 5000,
  PALAVRAS_CHAVE_MAX: 300,
  IMAGEM_MAX: 500,

  // Apoio / Doações
  MENSAGEM_APOIO_MAX: 280,

  // Usuários e Autenticação
  SENHA_MIN: 6,
  SENHA_MAX: 72,
  NOME_MIN: 2,
  NOME_MAX: 120,
  EMAIL_MAX: 180,
  INSTITUICAO_MAX: 150,
  BIO_MAX: 2000,

  // Domínios válidos
  TIPOS_ARTIGO: [
    'noticia_escolar',
    'noticia_global',
    'artigo_cientifico',
    'texto',
    'poema',
    'projeto',
  ],
  TEMAS: [
    'cientifico',
    'educacional',
    'cultural',
    'comunitario',
  ],
};

module.exports = {
  ...LIMITES,
  LIMITES,
};
