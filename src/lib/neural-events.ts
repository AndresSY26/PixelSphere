import { EventEmitter } from 'node:events';

/**
 * MOTOR DE EVENTOS NEURALES v1.0
 * Singleton para la orquestación de señales internas del servidor.
 */
class NeuralEventEmitter extends EventEmitter {}

// Global para asegurar que persiste entre recargas de Next.js en desarrollo
const globalForNeural = global as unknown as { neuralEmitter: NeuralEventEmitter };

export const neuralEmitter = globalForNeural.neuralEmitter || new NeuralEventEmitter();

if (process.env.NODE_ENV !== 'production') globalForNeural.neuralEmitter = neuralEmitter;

export const NEURAL_CHANNELS = {
  MEDIA: 'MEDIA_UPDATED',
  USERS: 'USERS_UPDATED',
  ALBUMS: 'ALBUMS_UPDATED',
  ACHIEVEMENTS: 'ACHIEVEMENTS_UPDATED',
  SYSTEM: 'SYSTEM_ALERT'
} as const;

export function emitNeuralUpdate(channel: keyof typeof NEURAL_CHANNELS, data?: any) {
  neuralEmitter.emit('update', { 
    channel: NEURAL_CHANNELS[channel], 
    data, 
    timestamp: new Date().toISOString() 
  });
}
