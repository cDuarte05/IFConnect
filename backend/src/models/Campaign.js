const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Campaign = sequelize.define('Campaign', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  titulo: { type: DataTypes.STRING, allowNull: false },
  descricao: { type: DataTypes.TEXT, allowNull: false },
  // areaCientifica (texto livre) foi substituído por categoryId — categoria normalizada,
  // compartilhada com Article (ver associação em models/index.js).
  metaFinanceira: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  valorArrecadado: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  // Tema: mesma lista fixa usada em Article, derivada da documentação oficial.
  tema: {
    type: DataTypes.ENUM('cientifico', 'educacional', 'cultural', 'comunitario'),
    allowNull: true,
  },
  // Palavras-chave: texto livre, termos separados por vírgula.
  palavrasChave: { type: DataTypes.STRING(300), allowNull: true },
  imagemCapaUrl: { type: DataTypes.STRING, allowNull: true },
  prazoFinal: { type: DataTypes.DATE, allowNull: true },
  status: {
    type: DataTypes.ENUM('em_analise', 'ativa', 'financiada', 'encerrada'),
    defaultValue: 'em_analise',
  },
}, {
  tableName: 'campaigns',
  timestamps: true,
});

module.exports = Campaign;
