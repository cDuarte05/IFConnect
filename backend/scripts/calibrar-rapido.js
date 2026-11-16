require('dotenv').config();
const { getConfig } = require('../src/services/agente/config');
const { obterProvider } = require('../src/services/agente/ingest/embedder');
const { buscarVetorial } = require('../src/services/agente/retrieval/vector');
const { sequelize } = require('../src/models');

const RELEVANTES = [
  'Há projetos de robótica?',
  'Quero saber sobre a feira de ciências',
  'Tem algo sobre monitoramento de temperatura?',
  'Como as turmas constroem estações meteorológicas?',
];
const IRRELEVANTES = [
  'Qual a receita de bolo de cenoura?',
  'Quais as regras do campeonato de futebol?',
  'Como trocar o pneu do carro?',
  'Quem foi o primeiro imperador de Roma?',
];

const titulo = (s) => String(s || '').split('\n')[0].replace('Título: ', '').slice(0, 55);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function topo(pergunta, provider) {
  const r = await buscarVetorial(pergunta, { provider, k: 1 });
  await esperar(300);
  return { pergunta, cos: r[0] ? r[0].score : null, doc: r[0] ? titulo(r[0].texto) : '-' };
}

(async () => {
  const provider = obterProvider(getConfig());
  const rel = [];
  const irr = [];
  for (const p of RELEVANTES) rel.push(await topo(p, provider));
  for (const p of IRRELEVANTES) irr.push(await topo(p, provider));

  const mostrar = (nome, lista) => {
    console.log(`\n--- ${nome} ---`);
    lista.forEach((x) => console.log(`${x.cos?.toFixed(3)} | ${x.pergunta} -> ${x.doc}`));
  };
  mostrar('RELEVANTES', rel);
  mostrar('SEM RELAÇÃO', irr);

  const minRel = Math.min(...rel.map((x) => x.cos));
  const maxIrr = Math.max(...irr.map((x) => x.cos));
  console.log(`\nmenor cosseno relevante : ${minRel.toFixed(3)}`);
  console.log(`maior cosseno irrelevante: ${maxIrr.toFixed(3)}`);
  if (minRel > maxIrr) {
    console.log(`margem: ${(minRel - maxIrr).toFixed(3)} | limiar sugerido: ${((minRel + maxIrr) / 2).toFixed(2)}`);
  } else {
    console.log('As faixas se sobrepõem: só o cosseno não separa as classes.');
  }
  await sequelize.close();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
