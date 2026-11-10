const { getLlmProvider } = require('../../src/services/agente/providers/llm');
const { ProvedorIndisponivelError } = require('../../src/services/agente/providers/errors');

const fetchOriginal = global.fetch;

describe('Provedores de LLM (providers/llm/*)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  test('getLlmProvider retorna null para provedor desconhecido', () => {
    expect(getLlmProvider('desconhecido')).toBeNull();
    expect(getLlmProvider(null)).toBeNull();
  });

  describe('Anthropic', () => {
    const provider = getLlmProvider('anthropic');

    test('envia URL, headers, corpo e extrai resposta corretamente', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            { type: 'text', text: 'Resposta Claude' },
            { type: 'other', text: 'ignorar' },
          ],
        }),
      });

      const resposta = await provider.generate({
        system: 'SysPrompt',
        user: 'UserPrompt',
        config: { apiKey: 'key-123', model: 'claude-test', timeoutMs: 5000 },
      });

      expect(resposta).toBe('Resposta Claude');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'content-type': 'application/json',
        'x-api-key': 'key-123',
        'anthropic-version': '2023-06-01',
      });

      const body = JSON.parse(options.body);
      expect(body.model).toBe('claude-test');
      expect(body.max_tokens).toBe(500);
      expect(body.system).toBe('SysPrompt');
      expect(body.messages).toEqual([{ role: 'user', content: 'UserPrompt' }]);
    });

    test('resposta não-ok lança ProvedorIndisponivelError com status', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
      });

      await expect(
        provider.generate({
          system: 'Sys',
          user: 'User',
          config: { apiKey: 'k' },
        })
      ).rejects.toThrow(ProvedorIndisponivelError);
    });

    test('falha de rede ou timeout lança ProvedorIndisponivelError', async () => {
      global.fetch.mockRejectedValueOnce(new Error('The operation was aborted'));

      await expect(
        provider.generate({
          system: 'Sys',
          user: 'User',
          config: { apiKey: 'k' },
        })
      ).rejects.toThrow(ProvedorIndisponivelError);
    });
  });

  describe('Gemini', () => {
    const provider = getLlmProvider('gemini');

    test('envia URL com modelo, headers, corpo e extrai resposta corretamente', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Resposta Gemini' }] } }],
        }),
      });

      const resposta = await provider.generate({
        system: 'SysGemini',
        user: 'UserGemini',
        config: { apiKey: 'key-gemini', model: 'gemini-custom', timeoutMs: 5000 },
      });

      expect(resposta).toBe('Resposta Gemini');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-custom:generateContent'
      );
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'content-type': 'application/json',
        'x-goog-api-key': 'key-gemini',
      });

      const body = JSON.parse(options.body);
      expect(body.systemInstruction).toEqual({ parts: [{ text: 'SysGemini' }] });
      expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'UserGemini' }] }]);
      expect(body.generationConfig).toEqual({ maxOutputTokens: 800, temperature: 0.3 });
    });

    test('resposta não-ok lança ProvedorIndisponivelError', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(
        provider.generate({
          system: 'Sys',
          user: 'User',
          config: { apiKey: 'k' },
        })
      ).rejects.toThrow(ProvedorIndisponivelError);
    });
  });

  describe('Groq', () => {
    const provider = getLlmProvider('groq');

    test('envia URL, header Authorization Bearer, corpo e extrai resposta', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Resposta Groq' } }],
        }),
      });

      const resposta = await provider.generate({
        system: 'SysGroq',
        user: 'UserGroq',
        config: { apiKey: 'groq-key', model: 'llama-3.3-70b-versatile' },
      });

      expect(resposta).toBe('Resposta Groq');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer groq-key',
      });

      const body = JSON.parse(options.body);
      expect(body.model).toBe('llama-3.3-70b-versatile');
      expect(body.max_tokens).toBe(500);
      expect(body.temperature).toBe(0.3);
      expect(body.messages).toEqual([
        { role: 'system', content: 'SysGroq' },
        { role: 'user', content: 'UserGroq' },
      ]);
    });

    test('resposta não-ok lança ProvedorIndisponivelError', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(
        provider.generate({
          system: 'Sys',
          user: 'User',
          config: { apiKey: 'k' },
        })
      ).rejects.toThrow(ProvedorIndisponivelError);
    });

    test('timeout durante a leitura do corpo lança ProvedorIndisponivelError', async () => {
      global.fetch.mockImplementationOnce((url, options) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            new Promise((_, reject) =>
              options.signal.addEventListener('abort', () => reject(new Error('aborted')))
            ),
        })
      );
      await expect(
        provider.generate({ system: 's', user: 'u', config: { apiKey: 'k', timeoutMs: 50 } })
      ).rejects.toThrow(ProvedorIndisponivelError);
    });
  });
});

