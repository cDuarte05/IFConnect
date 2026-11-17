/**
 * Script de inicialização do banco de dados (db:init).
 * Executa sequelize.sync() uma vez para criar as tabelas ausentes sem alterar existentes,
 * lista as tabelas presentes no banco e imprime o lembrete de ativação do RLS no Supabase.
 */
require('dotenv').config();
const { sequelize, ambiente } = require('../src/models');

(async () => {
  try {
    console.log(`\n[db:init] Conectando ao banco de dados (${ambiente.dialect} @ ${ambiente.hostMascarado})...`);
    await sequelize.authenticate();

    console.log('[db:init] Sincronizando tabelas com sequelize.sync()...');
    await sequelize.sync();

    const queryInterface = sequelize.getQueryInterface();
    const tabelas = await queryInterface.showAllTables();

    console.log('\n[db:init] Tabelas presentes no banco de dados:');
    tabelas.forEach((tab) => {
      const nome = typeof tab === 'string' ? tab : tab.tableName;
      console.log(`  - ${nome}`);
    });

    console.log('\n[db:init] Sincronização concluída com sucesso!');
    console.log('\n[db:init] LEMBRETE (Supabase / Nuvem):');
    console.log('Caso esteja utilizando PostgreSQL no Supabase, habilite o Row Level Security (RLS)');
    console.log('para proteger as tabelas contra acessos diretos não autorizados via Data API pública.');
    console.log('Script SQL disponível em: docs/banco/rls.sql\n');

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error(`\n[db:init] ERRO ao inicializar o banco de dados (${ambiente?.dialect} @ ${ambiente?.hostMascarado}):`, err.message);
    process.exit(1);
  }
})();
