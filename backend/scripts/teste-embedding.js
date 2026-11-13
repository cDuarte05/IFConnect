require('dotenv').config();
const { getConfig } = require('../src/services/agente/config');
const { getEmbeddingProvider } = require('../src/services/agente/providers/embedding');

(async () => {
  const provider = getEmbeddingProvider(getConfig());
  if (!provider) { console.error('Defina AGENTE_RAG_EMBEDDING_API_KEY no .env'); process.exit(1); }
  const q = await provider.embedQuery('projetos de robótica');
  const docs = await provider.embedDocuments([
    'Oficina de robótica educacional para alunos',
    'Receita de bolo de cenoura',
  ]);
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  console.log('modelo:', provider.info.model, '| dimensão:', q.length);
  console.log('similaridade com robótica:', dot(q, docs[0]).toFixed(3));
  console.log('similaridade com bolo    :', dot(q, docs[1]).toFixed(3));
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });

