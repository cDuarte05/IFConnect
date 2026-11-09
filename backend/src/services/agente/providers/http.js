/**
 * Executa requisição HTTP com timeout utilizando AbortController.
 * Garante que o timer do timeout seja cancelado no bloco finally.
 */
async function fetchComTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(timeoutMs) || 8000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchComTimeout };

