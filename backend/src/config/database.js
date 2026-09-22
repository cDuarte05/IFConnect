/**
 * Configuração do banco de dados.
 * - Local/desenvolvimento: SQLite (arquivo único, zero configuração).
 * - Produção (AWS): PostgreSQL no Amazon RDS — basta definir DB_DIALECT=postgres
 *   e as variáveis DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD no .env.
 * Essa camada de abstração (Sequelize) permite trocar o banco sem reescrever models/controllers.
 */
const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProd = process.env.DB_DIALECT === 'postgres';
const isTest = process.env.NODE_ENV === 'test';

const sequelize = isProd
  ? new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false },
      },
      logging: false,
    })
  : new Sequelize({
      dialect: 'sqlite',
      // Testes automatizados usam um banco SQLite em memória, isolado e descartável,
      // para nunca ler/escrever no arquivo de desenvolvimento (./portal.sqlite).
      storage: isTest ? ':memory:' : './portal.sqlite',
      logging: false,
    });

module.exports = sequelize;
