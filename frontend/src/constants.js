// Lista fixa de temas, derivada literalmente do objetivo do IFConnect na
// documentação oficial: divulgação "científica, educacional, cultural e comunitária".
export const TEMAS = [
  { valor: 'cientifico', rotulo: 'Científico' },
  { valor: 'educacional', rotulo: 'Educacional' },
  { valor: 'cultural', rotulo: 'Cultural' },
  { valor: 'comunitario', rotulo: 'Comunitário' },
];

export const TIPO_ROTULOS = {
  noticia_escolar: 'Notícia escolar',
  noticia_global: 'Notícia global',
  artigo_cientifico: 'Artigo científico',
  texto: 'Texto',
  poema: 'Poema',
  projeto: 'Projeto',
};


export const TEMA_ROTULOS = Object.fromEntries(TEMAS.map((t) => [t.valor, t.rotulo]));
