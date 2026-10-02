
"use client";

import { useEffect, useRef } from 'react';
import { useToast } from './use-toast';
import { User } from '@/lib/types';

/**
 * HOOK DE SINCRONIZACIÓN NEURAL v4.0
 * Mantiene la UI sincronizada en tiempo real mediante SSE.
 */
export function useNeuralSync(user: User | null) {
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!user) {
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
      return;
    }

    const connect = () => {
      if (eventSourceRef.current && eventSourceRef.current.readyState !== 2) return;
      
      const es = new EventSource('/api/neural-stream');
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'heartbeat') return;

          // Filtrar por usuario o broadcast global
          if (payload.data?.userId && payload.data.userId !== user.id) return;

          // Disparar evento para componentes locales
          window.dispatchEvent(new CustomEvent('neural-update', { detail: payload }));

          if (payload.channel === 'ACHIEVEMENTS_UPDATED') {
            toast({ title: "¡Hito Alcanzado!", description: "Se ha orquestado una nueva medalla en tu perfil." });
          }
        } catch (e) { console.error("Error neural:", e); }
      };

      es.onerror = () => {
        es.close();
        setTimeout(connect, 3000);
      };
    };

    connect();
    return () => { if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; } };
  }, [user, toast]);

  return null;
}
