
import { NextRequest } from 'next/server';
import { neuralEmitter } from '@/lib/neural-events';

/**
 * TRANSMISOR NEURAL SSE v1.0
 * Mantiene la conexión persistente con los nodos cliente.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = (data: any) => {
    try {
      writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch (e) {
      // Conexión cerrada
    }
  };

  const onUpdate = (update: any) => sendEvent(update);
  neuralEmitter.on('update', onUpdate);

  const heartbeat = setInterval(() => {
    sendEvent({ type: 'heartbeat' });
  }, 30000);

  req.signal.addEventListener('abort', () => {
    neuralEmitter.off('update', onUpdate);
    clearInterval(heartbeat);
    writer.close();
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
