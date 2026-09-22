const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 4000;

async function iniciar() {
  await sequelize.sync(); // em produção real, preferir migrations (sequelize-cli) em vez de sync()
  app.listen(PORT, () => {
    console.log(`API do IFConnect rodando na porta ${PORT}`);
  });
}

iniciar();
