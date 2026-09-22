// Lista fixa de temas, derivada literalmente do objetivo do IFConnect na
// documentação oficial: divulgação "científica, educacional, cultural e comunitária".
export const TEMAS = [
  { valor: 'cientifico', rotulo: 'Científico' },
  { valor: 'educacional', rotulo: 'Educacional' },
  { valor: 'cultural', rotulo: 'Cultural' },
  { valor: 'comunitario', rotulo: 'Comunitário' },
];

export const TEMA_ROTULOS = Object.fromEntries(TEMAS.map((t) => [t.valor, t.rotulo]));
