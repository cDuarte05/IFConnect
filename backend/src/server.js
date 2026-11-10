const app = require('./app');
const { sequelize } = require('./models');

// const PORT = process.env.PORT || 4000; Original
const PORT = process.env.API_PORT || 4000; // Pra funcionar no Render

async function iniciar() {
  await sequelize.sync(); // em produção real, preferir migrations (sequelize-cli) em vez de sync()
  app.listen(PORT, () => {
    console.log(`API do IFConnect rodando na porta ${PORT}`);
  });
}

iniciar();
