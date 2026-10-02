/**
 * NEXO NEURAL SSE - Gestor de Eventos en Tiempo Real
 */
const clients = new Set();

export function addStreamClient(res) {
  clients.add(res);
  res.on('close', () => {
    clients.delete(res);
  });
}

export function broadcastNeuralEvent(event, data) {
  const messageData = JSON.stringify({ channel: event, data });
  const payload = `data: ${messageData}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch (err) {
      console.error('[EventService] Error enviando SSE a cliente:', err);
      clients.delete(client);
    }
  }
}

export function getConnectedClientsCount() {
  return clients.size;
}
