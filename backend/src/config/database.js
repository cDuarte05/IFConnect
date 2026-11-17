/**
 * Configuração do banco de dados do IFConnect.
 *
 * Suporta:
 * - SQLite local/desenvolvimento (padrão, zero configuração).
 * - PostgreSQL na nuvem (Supabase via DATABASE_URL ou AWS RDS via DB_HOST etc.).
 *
 * Em ambiente de teste (NODE_ENV === 'test'), usamos SEMPRE SQLite em memória (:memory:),
 * ignorando qualquer variável de banco remoto (DATABASE_URL, DB_DIALECT, DB_HOST).
 * Isso é indispensável porque tests/setup.js executa sequelize.sync({ force: true })
 * no início dos testes, o que apagaria destrutivamente todas as tabelas caso um banco
 * real ou remoto fosse acessado por acidente.
 */
const fs = require('fs');
const { Sequelize } = require('sequelize');
require('dotenv').config();

let avisoSslEmitido = false;

/**
 * Extrai o host de uma URL ou string de conexão, garantindo que
 * usuário e senha NUNCA sejam retornados ou expostos.
 */
function extrairHostMascarado(urlOuHost) {
  if (!urlOuHost) return 'desconhecido';
  try {
    const parsed = new URL(urlOuHost);
    return parsed.host; // hostname + porta opcional (ex: "aws-0.pooler.supabase.com:5432")
  } catch {
    const semCredenciais = String(urlOuHost)
      .replace(/^.*:\/\//, '')
      .replace(/^[^@]+@/, '');
    const hostPorta = semCredenciais.split('/')[0].split('?')[0];
    return hostPorta || 'desconhecido';
  }
}

/**
 * Identifica se um host mascarado é remoto (fora da máquina local).
 */
function ehHostRemoto(hostMascarado) {
  if (!hostMascarado) return false;
  const hostPuro = hostMascarado.split(':')[0].toLowerCase();
  const locais = ['localhost', '127.0.0.1', '::1', '0.0.0.0', ':memory:'];
  return !locais.includes(hostPuro);
}

/**
 * Obtém as opções de configuração SSL para conexão PostgreSQL.
 */
function obterConfigSsl(env = process.env) {
  if (env.DB_SSL === 'false') {
    return false;
  }

  if (env.DB_SSL_CA_PATH) {
    try {
      const ca = fs.readFileSync(env.DB_SSL_CA_PATH, 'utf8');
      return { ca, rejectUnauthorized: true };
    } catch (err) {
      if (env.NODE_ENV !== 'test') {
        console.error(`[banco] Erro ao ler arquivo de certificado CA (${env.DB_SSL_CA_PATH}): ${err.message}`);
      }
      throw err;
    }
  }

  if (!avisoSslEmitido && env.NODE_ENV !== 'test') {
    console.warn(
      '[banco] Aviso: Conexão PostgreSQL com SSL ativo sem validação de CA (rejectUnauthorized: false). Defina DB_SSL_CA_PATH para verificar a autoridade certificadora.'
    );
    avisoSslEmitido = true;
  }

  return { require: true, rejectUnauthorized: false };
}

/**
 * Determina os metadados do ambiente de banco de dados ativo.
 */
function determinarAmbiente(env = process.env) {
  const isTest = env.NODE_ENV === 'test';
  if (isTest) {
    return {
      dialect: 'sqlite',
      remoto: false,
      hostMascarado: ':memory:',
    };
  }

  const databaseUrl = env.DATABASE_URL && env.DATABASE_URL.trim();
  if (databaseUrl) {
    const hostMascarado = extrairHostMascarado(databaseUrl);
    return {
      dialect: 'postgres',
      remoto: ehHostRemoto(hostMascarado),
      hostMascarado,
    };
  }

  if (env.DB_DIALECT === 'postgres') {
    const host = env.DB_HOST || 'localhost';
    const port = env.DB_PORT || 5432;
    const hostMascarado = `${host}:${port}`;
    return {
      dialect: 'postgres',
      remoto: ehHostRemoto(host),
      hostMascarado,
    };
  }

  return {
    dialect: 'sqlite',
    remoto: false,
    hostMascarado: env.SQLITE_STORAGE || './portal.sqlite',
  };
}

/**
 * Cria a instância do Sequelize de acordo com o ambiente.
 */
function criarSequelize(env = process.env) {
  const isTest = env.NODE_ENV === 'test';

  // Em teste: sempre SQLite em memória, isolado e seguro contra sync({ force: true })
  if (isTest) {
    return new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
  }

  const databaseUrl = env.DATABASE_URL && env.DATABASE_URL.trim();
  const poolConfig = { max: 5, min: 0, idle: 10000, acquire: 30000 };

  if (databaseUrl) {
    const ssl = obterConfigSsl(env);
    const dialectOptions = {};
    if (ssl) {
      dialectOptions.ssl = ssl;
    }
    return new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: false,
      pool: poolConfig,
      dialectOptions,
    });
  }

  if (env.DB_DIALECT === 'postgres') {
    const ssl = obterConfigSsl(env);
    const dialectOptions = {};
    if (ssl) {
      dialectOptions.ssl = ssl;
    }
    return new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
      host: env.DB_HOST,
      port: env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
      pool: poolConfig,
      dialectOptions,
    });
  }

  return new Sequelize({
    dialect: 'sqlite',
    storage: env.SQLITE_STORAGE || './portal.sqlite',
    logging: false,
  });
}

const ambiente = determinarAmbiente(process.env);
const sequelize = criarSequelize(process.env);
sequelize.ambiente = ambiente;

module.exports = sequelize;
module.exports.ambiente = ambiente;
module.exports.sequelize = sequelize;
module.exports.extrairHostMascarado = extrairHostMascarado;
module.exports.determinarAmbiente = determinarAmbiente;
module.exports.criarSequelize = criarSequelize;
module.exports.ehHostRemoto = ehHostRemoto;
module.exports.obterConfigSsl = obterConfigSsl;
