const { fetchJsonComTimeout } = require('../http');
const { ProvedorIndisponivelError } = require('../errors');

async function generate({ system, user, config }) {
  const model = config?.model || 'llama-3.3-70b-versatile';
  const apiKey = config?.apiKey;
  const timeoutMs = config?.timeoutMs || 8000;

  try {
    const { ok, status, data } = await fetchJsonComTimeout(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      },
      timeoutMs
    );

    if (!ok) {
      throw new ProvedorIndisponivelError(`Provedor respondeu ${status}`, {
        provedor: 'groq',
        status,
      });
    }

    return (data?.choices?.[0]?.message?.content || '').trim();
  } catch (err) {
    if (err instanceof ProvedorIndisponivelError) throw err;
    throw new ProvedorIndisponivelError(err.message, { provedor: 'groq' });
  }
}

module.exports = { generate };
