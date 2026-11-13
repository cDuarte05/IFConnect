const { fetchJsonComTimeout } = require('../http');
const { ProvedorIndisponivelError } = require('../errors');

async function generate({ system, user, config }) {
  const model = config?.model || 'gemini-3.1-flash-lite';
  const apiKey = config?.apiKey;
  const timeoutMs = config?.timeoutMs || 8000;

  try {
    const { ok, status, data } = await fetchJsonComTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: 800, temperature: 0.3 },
        }),
      },
      timeoutMs
    );

    if (!ok) {
      throw new ProvedorIndisponivelError(`Provedor respondeu ${status}`, {
        provedor: 'gemini',
        status,
      });
    }

    const partes = data?.candidates?.[0]?.content?.parts || [];
    return partes.map((p) => p.text || '').join('\n').trim();
  } catch (err) {
    if (err instanceof ProvedorIndisponivelError) throw err;
    throw new ProvedorIndisponivelError(err.message, { provedor: 'gemini' });
  }
}

module.exports = { generate };
