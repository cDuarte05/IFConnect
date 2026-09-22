const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Entidade compartilhada de categoria, usada tanto por publicações quanto por
// projetos — normalizada em tabela própria (em vez de enum fixo ou texto livre)
// para permitir criar novas categorias sem alterar código/schema.
const Category = sequelize.define('Category', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nome: { type: DataTypes.STRING, allowNull: false, unique: true },
  descricao: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'categories',
  timestamps: true,
});

module.exports = Category;
