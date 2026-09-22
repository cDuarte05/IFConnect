const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Registro de apoio/doação simbólica a uma campanha (vitrine de projetos científicos).
// Em produção, o valor confirmado viria de um webhook do gateway de pagamento (Stripe/Pagar.me).
const Donation = sequelize.define('Donation', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  mensagemApoio: { type: DataTypes.STRING(280), allowNull: true },
  anonimo: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'donations',
  timestamps: true,
});

module.exports = Donation;
