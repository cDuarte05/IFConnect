require('dotenv').config();
const { getConfig } = require('../src/services/agente/config');
const { obterProvider } = require('../src/services/agente/ingest/embedder');
const { buscarLexical } = require('../src/services/agente/retrieval/lexical');
const { buscarVetorial } = require('../src/services/agente/retrieval/vector');
const { recuperar } = require('../src/services/agente/retrieval/hybrid');
const { sequelize } = require('../src/models');

const pergunta = process.argv.slice(2).join(' ');
const t = (s) => String(s || '').split('\n')[0].slice(0, 70);

(async () => {
  const config = getConfig();
  const provider = obterProvider(config);
  console.log('\n--- LEXICAL ---');
  (await buscarLexical(pergunta, { k: 5 })).forEach((r) =>
    console.log(`cob=${r.cobertura.toFixed(2)} | ${t(r.texto)}`));
  console.log('\n--- VETORIAL ---');
  try {
    (await buscarVetorial(pergunta, { provider, k: 5 })).forEach((r) =>
      console.log(`cos=${r.score.toFixed(3)} | ${t(r.texto)}`));
  } catch (e) { console.log('VETORIAL FALHOU:', e.message); }
  console.log('\n--- HÍBRIDO ---');
  const { fontes, diagnostico } = await recuperar(pergunta, { config, provider });
  fontes.forEach((f) => console.log(`[${f.ref}] ${f.titulo}`));
  console.log('diagnóstico:', diagnostico);
  await sequelize.close();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
