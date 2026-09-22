process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste-nao-usar-em-producao';

const { sequelize } = require('../src/models');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

module.exports = { sequelize };
