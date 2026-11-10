/**
 * Executa requisição HTTP com timeout utilizando AbortController.
 * Mantém o timer ativo até depois do parsing de json, cancelando no finally.
 * Retorna { ok, status, data, headers }.
 */
async function fetchJsonComTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(timeoutMs) || 8000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: response.headers,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchJsonComTimeout };
