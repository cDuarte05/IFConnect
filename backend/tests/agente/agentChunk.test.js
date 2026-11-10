require('../setup');
const { Sequelize } = require('sequelize');
const AgentChunk = require('../../src/models/AgentChunk');
const models = require('../../src/models');

describe('Model AgentChunk (tabela de apoio agente_chunks)', () => {
  test('1. cria um chunk válido e o recupera com findOne: embedding volta como ARRAY de números, igual ao original', async () => {
    const embeddingOriginal = [0.123, -0.456, 0.789, 0.0];
    const chunk = await AgentChunk.create({
      sourceType: 'artigo',
      sourceId: '11111111-1111-4111-a111-111111111111',
      chunkIndex: 0,
      texto: 'Texto de teste do chunk com conteúdo relevante.',
      contentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      embedding: embeddingOriginal,
      embeddingModel: 'gemini-embedding-001',
      dim: 4,
    });

    const recuperado = await AgentChunk.findOne({ where: { id: chunk.id } });
    expect(recuperado).not.toBeNull();
    expect(Array.isArray(recuperado.embedding)).toBe(true);
    expect(recuperado.embedding).toEqual(embeddingOriginal);
    expect(recuperado.sourceType).toBe('artigo');
    expect(recuperado.chunkIndex).toBe(0);
    expect(recuperado.dim).toBe(4);
    expect(recuperado.contentHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  test('2. rejeita embedding que não seja array numérico (string, objeto, array com NaN/string) -> TypeError', () => {
    // string
    expect(() => {
      AgentChunk.build({ embedding: 'vetor-invalido' });
    }).toThrow(TypeError);

    // objeto
    expect(() => {
      AgentChunk.build({ embedding: { x: 1, y: 2 } });
    }).toThrow(TypeError);

    // array com NaN
    expect(() => {
      AgentChunk.build({ embedding: [0.1, NaN, 0.3] });
    }).toThrow(TypeError);

    // array com string
    expect(() => {
      AgentChunk.build({ embedding: [0.1, '0.2', 0.3] });
    }).toThrow(TypeError);

    // array com Infinity
    expect(() => {
      AgentChunk.build({ embedding: [0.1, Infinity, 0.3] });
    }).toThrow(TypeError);
  });

  test('3. rejeita quando embedding.length !== dim (SequelizeValidationError)', async () => {
    await expect(
      AgentChunk.create({
        sourceType: 'artigo',
        sourceId: '22222222-2222-4222-a222-222222222222',
        chunkIndex: 0,
        texto: 'Texto do chunk',
        contentHash: 'hash1234567890123456789012345678901234567890123456789012345678901234',
        embedding: [0.1, 0.2], // tamanho 2
        dim: 3, // dim 3 !== 2
        embeddingModel: 'gemini-embedding-001',
      })
    ).rejects.toThrow(Sequelize.ValidationError);
  });

  test('4. viola a unicidade (mesmo sourceType+sourceId+chunkIndex) -> SequelizeUniqueConstraintError', async () => {
    const sourceId = '33333333-3333-4333-a333-333333333333';
    await AgentChunk.create({
      sourceType: 'artigo',
      sourceId,
      chunkIndex: 0,
      texto: 'Primeiro chunk',
      contentHash: 'hash1111111111111111111111111111111111111111111111111111111111111111',
      embedding: [0.5, 0.5],
      dim: 2,
      embeddingModel: 'gemini-embedding-001',
    });

    await expect(
      AgentChunk.create({
        sourceType: 'artigo',
        sourceId,
        chunkIndex: 0, // duplicando (sourceType, sourceId, chunkIndex)
        texto: 'Segundo chunk duplicado',
        contentHash: 'hash2222222222222222222222222222222222222222222222222222222222222222',
        embedding: [0.1, 0.9],
        dim: 2,
        embeddingModel: 'gemini-embedding-001',
      })
    ).rejects.toThrow(Sequelize.UniqueConstraintError);
  });

  test('5. permite o mesmo chunkIndex para sourceId diferente e para sourceType diferente', async () => {
    const sourceId1 = '44444444-4444-4444-a444-444444444441';
    const sourceId2 = '44444444-4444-4444-a444-444444444442';

    // Artigo 1, chunkIndex 0
    const c1 = await AgentChunk.create({
      sourceType: 'artigo',
      sourceId: sourceId1,
      chunkIndex: 0,
      texto: 'Texto 1',
      contentHash: 'hash1111111111111111111111111111111111111111111111111111111111111111',
      embedding: [0.1, 0.2],
      dim: 2,
      embeddingModel: 'gemini-embedding-001',
    });

    // Artigo 2 (sourceId diferente), mesmo chunkIndex 0 -> deve permitir
    const c2 = await AgentChunk.create({
      sourceType: 'artigo',
      sourceId: sourceId2,
      chunkIndex: 0,
      texto: 'Texto 2',
      contentHash: 'hash2222222222222222222222222222222222222222222222222222222222222222',
      embedding: [0.3, 0.4],
      dim: 2,
      embeddingModel: 'gemini-embedding-001',
    });

    // Campanha (sourceType diferente), mesmo sourceId1 e mesmo chunkIndex 0 -> deve permitir
    const c3 = await AgentChunk.create({
      sourceType: 'campanha',
      sourceId: sourceId1,
      chunkIndex: 0,
      texto: 'Texto 3',
      contentHash: 'hash3333333333333333333333333333333333333333333333333333333333333333',
      embedding: [0.5, 0.6],
      dim: 2,
      embeddingModel: 'gemini-embedding-001',
    });

    expect(c1.id).toBeDefined();
    expect(c2.id).toBeDefined();
    expect(c3.id).toBeDefined();
  });

  test('6. rejeita sourceType fora do ENUM e texto vazio', async () => {
    // sourceType fora do ENUM
    await expect(
      AgentChunk.create({
        sourceType: 'outro_tipo',
        sourceId: '55555555-5555-4555-a555-555555555555',
        chunkIndex: 0,
        texto: 'Texto válido',
        contentHash: 'hash1111111111111111111111111111111111111111111111111111111111111111',
        embedding: [0.1, 0.2],
        dim: 2,
        embeddingModel: 'gemini-embedding-001',
      })
    ).rejects.toThrow();

    // texto vazio
    await expect(
      AgentChunk.create({
        sourceType: 'artigo',
        sourceId: '55555555-5555-4555-a555-555555555555',
        chunkIndex: 0,
        texto: '',
        contentHash: 'hash1111111111111111111111111111111111111111111111111111111111111111',
        embedding: [0.1, 0.2],
        dim: 2,
        embeddingModel: 'gemini-embedding-001',
      })
    ).rejects.toThrow(Sequelize.ValidationError);
  });

  test('7. destroy({ where: { sourceType, sourceId } }) remove todos os chunks daquela fonte e só deles', async () => {
    const fonteAlvo = '66666666-6666-4666-a666-666666666661';
    const fonteOutra = '66666666-6666-4666-a666-666666666662';

    // Cria 2 chunks para a fonte alvo
    await AgentChunk.create({
      sourceType: 'artigo',
      sourceId: fonteAlvo,
      chunkIndex: 0,
      texto: 'Chunk 0 da fonte alvo',
      contentHash: 'hash1111111111111111111111111111111111111111111111111111111111111111',
      embedding: [0.1, 0.2],
      dim: 2,
      embeddingModel: 'gemini-embedding-001',
    });
    await AgentChunk.create({
      sourceType: 'artigo',
      sourceId: fonteAlvo,
      chunkIndex: 1,
      texto: 'Chunk 1 da fonte alvo',
      contentHash: 'hash1111111111111111111111111111111111111111111111111111111111111111',
      embedding: [0.3, 0.4],
      dim: 2,
      embeddingModel: 'gemini-embedding-001',
    });

    // Cria 1 chunk para outra fonte
    await AgentChunk.create({
      sourceType: 'artigo',
      sourceId: fonteOutra,
      chunkIndex: 0,
      texto: 'Chunk da outra fonte',
      contentHash: 'hash2222222222222222222222222222222222222222222222222222222222222222',
      embedding: [0.5, 0.6],
      dim: 2,
      embeddingModel: 'gemini-embedding-001',
    });

    // Remove apenas os chunks da fonte alvo
    const removidos = await AgentChunk.destroy({
      where: { sourceType: 'artigo', sourceId: fonteAlvo },
    });
    expect(removidos).toBe(2);

    // Verifica que fonteAlvo tem 0 chunks
    const chunksAlvo = await AgentChunk.findAll({
      where: { sourceType: 'artigo', sourceId: fonteAlvo },
    });
    expect(chunksAlvo).toHaveLength(0);

    // Verifica que fonteOutra segue intacta
    const chunksOutra = await AgentChunk.findAll({
      where: { sourceType: 'artigo', sourceId: fonteOutra },
    });
    expect(chunksOutra).toHaveLength(1);
  });

  test("8. Object.keys(AgentChunk.associations).length === 0 e AgentChunk.getTableName() === 'agente_chunks'", () => {
    expect(Object.keys(AgentChunk.associations).length).toBe(0);
    expect(AgentChunk.getTableName()).toBe('agente_chunks');
  });

  test("9. require('../../src/models') exporta AgentChunk", () => {
    expect(models.AgentChunk).toBeDefined();
    expect(models.AgentChunk).toBe(AgentChunk);
  });
});
