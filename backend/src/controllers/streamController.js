import { addStreamClient } from '../services/eventService.js';

export function handleNeuralStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Enviar evento de conexión inicial
  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

  addStreamClient(res);

  // Heartbeat cada 15 segundos para mantener la conexión activa en proxies y navegadores
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
}
