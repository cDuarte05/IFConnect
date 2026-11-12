process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste-nao-usar-em-producao';
process.env.AGENTE_RAG_ENABLED = 'false';

const { sequelize } = require('../src/models');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

module.exports = { sequelize };
