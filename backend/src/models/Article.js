const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Article = sequelize.define('Article', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  titulo: { type: DataTypes.STRING, allowNull: false },
  resumo: { type: DataTypes.STRING(300), allowNull: false },
  conteudo: { type: DataTypes.TEXT, allowNull: false },
  tipo: {
    // Mantido por compatibilidade histórica com o fluxo editorial (formato do conteúdo);
    // a classificação por assunto agora vive em Category (ver categoryId, associação em models/index.js).
    type: DataTypes.ENUM('noticia_escolar', 'noticia_global', 'artigo_cientifico', 'texto', 'poema', 'projeto'),
    allowNull: false,
  },
  // Tema: lista fixa derivada literalmente do objetivo do IFConnect na documentação
  // oficial ("divulgação científica, educacional, cultural e comunitária").
  tema: {
    type: DataTypes.ENUM('cientifico', 'educacional', 'cultural', 'comunitario'),
    allowNull: true,
  },
  // Palavras-chave: texto livre, termos separados por vírgula (ex.: "robótica, feira de ciências").
  palavrasChave: { type: DataTypes.STRING(300), allowNull: true },
  imagemCapaUrl: { type: DataTypes.STRING, allowNull: true }, // aponta para objeto no S3/CloudFront em produção
  status: {
    // fluxo editorial simples: rascunho -> em_revisao -> publicado (moderação leve por professores)
    type: DataTypes.ENUM('rascunho', 'em_revisao', 'publicado', 'recusado'),
    defaultValue: 'em_revisao',
  },
  visualizacoes: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'articles',
  timestamps: true,
});

module.exports = Article;
