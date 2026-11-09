const { fetchComTimeout } = require('../http');
const { ProvedorIndisponivelError } = require('../errors');

async function generate({ system, user, config }) {
  const model = config?.model || 'claude-haiku-5-5';
  const apiKey = config?.apiKey;
  const timeoutMs = config?.timeoutMs || 8000;

  try {
    const resp = await fetchComTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      },
      timeoutMs
    );

    if (!resp.ok) {
      throw new ProvedorIndisponivelError(`Provedor respondeu ${resp.status}`, {
        provedor: 'anthropic',
        status: resp.status,
      });
    }

    const data = await resp.json();
    return (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  } catch (err) {
    if (err instanceof ProvedorIndisponivelError) throw err;
    throw new ProvedorIndisponivelError(err.message, { provedor: 'anthropic' });
  }
}

module.exports = { generate };

