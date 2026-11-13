// Gerenciador de conexões Server-Sent Events (SSE) para comentários em tempo real.
// Mantém conexões abertas com os navegadores que estão visualizando um artigo ou projeto
// e despacha eventos instantâneos quando um comentário é criado, editado ou excluído.

const canais = new Map(); // canal -> Set de objetos Response

function obterOuCriarCanal(nomeCanal) {
  if (!canais.has(nomeCanal)) {
    canais.set(nomeCanal, new Set());
  }
  return canais.get(nomeCanal);
}

/**
 * Conecta um cliente HTTP ao fluxo de eventos SSE de um canal específico.
 * @param {string} canal - Ex: 'artigo:uuid' ou 'campanha:uuid'
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function adicionarCliente(canal, req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Desabilita buffering no Nginx/proxies
  });

  const clientes = obterOuCriarCanal(canal);
  clientes.add(res);

  // Envia confirmação de conexão inicial
  res.write(`event: conectado\ndata: ${JSON.stringify({ canal, timestamp: Date.now() })}\n\n`);

  // Heartbeat a cada 25 segundos para manter a conexão ativa contra timeouts de infraestrutura
  const intervaloHeartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(intervaloHeartbeat);
    }
  }, 25000);

  // Limpeza ao fechar conexão
  req.on('close', () => {
    clearInterval(intervaloHeartbeat);
    clientes.delete(res);
    if (clientes.size === 0) {
      canais.delete(canal);
    }
  });
}

/**
 * Notifica todos os clientes conectados ao canal sobre uma alteração nos comentários.
 * @param {string} canal - Ex: 'artigo:uuid' ou 'campanha:uuid'
 * @param {'novo_comentario' | 'comentario_editado' | 'comentario_excluido'} evento
 * @param {object} dados
 */
function emitirEvento(canal, evento, dados) {
  const clientes = canais.get(canal);
  if (!clientes || clientes.size === 0) return;

  const payload = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
  for (const res of clientes) {
    try {
      res.write(payload);
    } catch {
      clientes.delete(res);
    }
  }
}

module.exports = {
  adicionarCliente,
  emitirEvento,
};

