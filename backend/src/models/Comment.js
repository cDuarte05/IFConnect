const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  conteudo: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'O conteúdo do comentário não pode ficar vazio' },
      len: { args: [1, 2000], msg: 'O comentário deve ter no máximo 2000 caracteres' },
    },
  },
  editado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  autorId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  articleId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  campaignId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'comments',
  timestamps: true,
});

module.exports = Comment;

