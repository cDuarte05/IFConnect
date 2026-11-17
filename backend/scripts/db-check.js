/**
 * Script de verificação e integridade do banco de dados (db:check).
 * Conecta ao banco, executa SELECT 1, verifica a contagem de linhas por tabela
 * e checa a disponibilidade da extensão pgvector (em PostgreSQL) ou n/a (em SQLite).
 * NUNCA imprime senha ou URL completa.
 */
require('dotenv').config();
const {
  sequelize,
  ambiente,
  User,
  Category,
  Article,
  Campaign,
  Donation,
  Comment,
  AgentChunk,
} = require('../src/models');

(async () => {
  try {
    console.log('\n--- VERIFICAÇÃO DO BANCO DE DADOS ---');
    console.log(`Dialeto : ${ambiente.dialect}`);
    console.log(`Host    : ${ambiente.hostMascarado}`);
    console.log(`Remoto  : ${ambiente.remoto ? 'sim' : 'não'}`);

    // Conexão e teste SELECT 1
    await sequelize.authenticate();
    await sequelize.query('SELECT 1');
    console.log('Status  : Conectado com sucesso (SELECT 1 OK)\n');

    // Contagem de registros por tabela
    console.log('--- CONTAGEM DE REGISTROS POR TABELA ---');
    const tabelas = [
      { nome: 'users', model: User },
      { nome: 'categories', model: Category },
      { nome: 'articles', model: Article },
      { nome: 'campaigns', model: Campaign },
      { nome: 'donations', model: Donation },
      { nome: 'comments', model: Comment },
      { nome: 'agente_chunks', model: AgentChunk },
    ];

    for (const { nome, model } of tabelas) {
      if (model) {
        try {
          const total = await model.count();
          console.log(`  - ${nome.padEnd(16)}: ${total} registro(s)`);
        } catch (err) {
          console.log(`  - ${nome.padEnd(16)}: erro ao contar (${err.message})`);
        }
      }
    }

    // Checagem da extensão pgvector
    console.log('\n--- EXTENSÕES ---');
    if (ambiente.dialect === 'postgres') {
      try {
        const [rows] = await sequelize.query(
          "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'"
        );
        if (rows && rows.length > 0) {
          console.log(`Extensão pgvector : disponível (versão ${rows[0].extversion})`);
        } else {
          console.log('Extensão pgvector : não instalada no PostgreSQL (execute: CREATE EXTENSION IF NOT EXISTS vector;)');
        }
      } catch (err) {
        console.log(`Extensão pgvector : erro ao consultar pg_extension (${err.message})`);
      }
    } else {
      console.log('Extensão pgvector : n/a (SQLite)');
    }

    console.log('\nVerificação concluída com sucesso.\n');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error(`\n[db:check] ERRO ao verificar banco (${ambiente?.dialect} @ ${ambiente?.hostMascarado}):`, err.message);
    process.exit(1);
  }
})();
