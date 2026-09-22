const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nome: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  senhaHash: { type: DataTypes.STRING, allowNull: false },
  tipo: {
    // estudante, jornalista_jovem, membro_comunidade, professor_moderador
    type: DataTypes.ENUM('estudante', 'jornalista_jovem', 'membro_comunidade', 'professor_moderador'),
    defaultValue: 'estudante',
  },
  instituicao: { type: DataTypes.STRING, allowNull: true },
  bio: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'users',
  timestamps: true,
});

User.prototype.verificarSenha = function (senha) {
  return bcrypt.compareSync(senha, this.senhaHash);
};

User.hashSenha = (senha) => bcrypt.hashSync(senha, 10);

module.exports = User;
