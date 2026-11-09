const anthropic = require('./anthropic');
const gemini = require('./gemini');
const groq = require('./groq');

const LLM_PROVIDERS = {
  anthropic,
  gemini,
  groq,
};

function getLlmProvider(nome) {
  if (!nome || !LLM_PROVIDERS[nome]) return null;
  return LLM_PROVIDERS[nome];
}

module.exports = { getLlmProvider };

