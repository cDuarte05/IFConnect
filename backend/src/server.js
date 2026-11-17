const app = require('./app');
const { sequelize, ambiente } = require('./models');
const { iniciarReconciliacao } = require('./services/agente/ingest/reconciliador');

const PORT = process.env.API_PORT || process.env.PORT || 4000;

async function iniciar() {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); // cria tabelas ausentes, não altera existentes
    console.log(`Banco: ${ambiente.dialect} @ ${ambiente.hostMascarado}`);
    app.listen(PORT, () => {
      console.log(`API do IFConnect rodando na porta ${PORT}`);
      iniciarReconciliacao();
    });
  } catch (err) {
    console.error(`Erro ao conectar ao banco de dados (${ambiente?.dialect} @ ${ambiente?.hostMascarado}): ${err.message}`);
    process.exit(1);
  }
}

iniciar();
