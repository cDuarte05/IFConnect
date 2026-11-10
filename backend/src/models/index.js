const sequelize = require('../config/database');
const User = require('./User');
const Category = require('./Category');
const Article = require('./Article');
const Campaign = require('./Campaign');
const Donation = require('./Donation');
const AgentChunk = require('./AgentChunk');
const Comment = require('./Comment');

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

module.exports = { sequelize, User, Category, Article, Campaign, Donation, AgentChunk };
// Comentários: associados ao autor e vinculados a uma publicação (Article) ou projeto (Campaign)
User.hasMany(Comment, { foreignKey: 'autorId', as: 'comentarios' });
Comment.belongsTo(User, { foreignKey: 'autorId', as: 'autor' });

Article.hasMany(Comment, { foreignKey: 'articleId', as: 'comentarios', onDelete: 'CASCADE' });
Comment.belongsTo(Article, { foreignKey: 'articleId', as: 'artigo' });

Campaign.hasMany(Comment, { foreignKey: 'campaignId', as: 'comentarios', onDelete: 'CASCADE' });
Comment.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campanha' });

module.exports = { sequelize, User, Category, Article, Campaign, Donation, Comment };
