const sequelize = require('../config/database');
const User = require('./User');
const Category = require('./Category');
const Article = require('./Article');
const Campaign = require('./Campaign');
const Donation = require('./Donation');

// Associações
User.hasMany(Article, { foreignKey: 'autorId', as: 'artigos' });
Article.belongsTo(User, { foreignKey: 'autorId', as: 'autor' });

User.hasMany(Campaign, { foreignKey: 'autorId', as: 'campanhas' });
Campaign.belongsTo(User, { foreignKey: 'autorId', as: 'autor' });

Campaign.hasMany(Donation, { foreignKey: 'campaignId', as: 'doacoes' });
Donation.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campanha' });

User.hasMany(Donation, { foreignKey: 'apoiadorId', as: 'doacoes' });
Donation.belongsTo(User, { foreignKey: 'apoiadorId', as: 'apoiador' });

// Categoria: entidade compartilhada de classificação por assunto (ver Category.js).
// Opcional (allowNull: true) para não quebrar publicações/projetos já existentes
// sem categoria atribuída.
Category.hasMany(Article, { foreignKey: 'categoryId', as: 'artigos' });
Article.belongsTo(Category, { foreignKey: { name: 'categoryId', allowNull: true }, as: 'categoria' });

Category.hasMany(Campaign, { foreignKey: 'categoryId', as: 'campanhas' });
Campaign.belongsTo(Category, { foreignKey: { name: 'categoryId', allowNull: true }, as: 'categoria' });

module.exports = { sequelize, User, Category, Article, Campaign, Donation };
