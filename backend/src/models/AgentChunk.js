const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Tabela de apoio do RAG (Retrieval-Augmented Generation): agente_chunks.
 *
 * NÃO é uma entidade de negócio do IFConnect: não possui associações com outros models
 * nem chaves estrangeiras (FK) para Article ou Campaign. Essa decisão (D3 na spec-rag.md,
 * derivada da Análise de Viabilidade) garante desacoplamento da camada editorial e permite
 * recriar ou reindexar vetores sem risco de travar ou corromper dados de negócio.
 *
 * Armazenamento de vetores:
 * Em ambiente de desenvolvimento e testes locais com SQLite, o vetor numérico é serializado
 * em formato JSON dentro de uma coluna TEXT. Na fase de implantação em nuvem (PostgreSQL RDS),
 * este campo será migrado para o tipo vetorial nativo (extensão pgvector).
 *
 * Observação para o código de indexação (T6):
 * Ao utilizar bulkCreate para inserção de chunks em lote, deve-se passar explicitamente
 * a opção { validate: true } para que os setters e validadores (como dimCoerente e notEmpty)
 * sejam disparados para cada registro.
 */
const AgentChunk = sequelize.define('AgentChunk', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sourceType: {
    type: DataTypes.ENUM('artigo', 'campanha'),
    allowNull: false,
    validate: {
      isIn: [['artigo', 'campanha']],
    },
  },
  sourceId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  chunkIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  texto: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  contentHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  embedding: {
    type: DataTypes.TEXT,
    allowNull: false,
    set(valor) {
      if (!Array.isArray(valor)) {
        throw new TypeError('Embedding deve ser um array de números finitos');
      }
      if (valor.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
        throw new TypeError('Embedding deve conter apenas números finitos');
      }
      this.setDataValue('embedding', JSON.stringify(valor));
    },
    get() {
      const valor = this.getDataValue('embedding');
      if (!valor) return null;
      try {
        return JSON.parse(valor);
      } catch {
        return null;
      }
    },
  },
  embeddingModel: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dim: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
    },
  },
}, {
  tableName: 'agente_chunks',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['sourceType', 'sourceId', 'chunkIndex'],
    },
    {
      fields: ['embeddingModel'],
    },
  ],
  validate: {
    dimCoerente() {
      const emb = this.embedding;
      if (Array.isArray(emb) && emb.length !== this.dim) {
        throw new Error(
          `A dimensão do embedding (${emb.length}) não corresponde à dimensão configurada (${this.dim})`
        );
      }
    },
  },
});

module.exports = AgentChunk;
