
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Media } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Play, Navigation } from 'lucide-react';
import Image from 'next/image';

// PROTOCOLO DE NODOS NEURALES (Marcadores Personalizados)
const createNeuralIcon = (count: number) => {
  const size = count > 1 ? 40 : 32;
  return L.divIcon({
    className: 'neural-marker-container',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-full h-full rounded-full bg-primary/20 animate-ping"></div>
        <div class="relative w-8 h-8 rounded-full bg-primary border-2 border-white/20 shadow-[0_0_15px_rgba(115,115,240,0.6)] flex items-center justify-center text-[10px] font-black text-white">
          ${count > 1 ? count : ''}
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

interface WorldMapProps {
  media: Media[];
  onMediaClick?: (item: Media) => void;
  center?: [number, number] | null;
}

// LÍMITES FÍSICOS DE INFRAESTRUCTURA
const BOUNDS: L.LatLngBoundsExpression = [
  [-85, -210], // Sudoeste
  [85, 210]    // Noreste
];

export default function WorldMap({ media, onMediaClick, center }: WorldMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const mediaWithCoords = useMemo(() => {
    return media.filter(m => m.metadata?.gps?.lat !== undefined && m.metadata?.gps?.lng !== undefined);
  }, [media]);

  const clusters = useMemo(() => {
    const groups: Record<string, Media[]> = {};
    mediaWithCoords.forEach(m => {
      const key = `${m.metadata!.gps!.lat.toFixed(3)}_${m.metadata!.gps!.lng.toFixed(3)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return Object.values(groups);
  }, [mediaWithCoords]);

  if (!isMounted) return null;

  return (
    <div className="w-full h-full rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl relative bg-[#0a0a0c]">
      <MapContainer 
        center={[20, 0]} 
        zoom={3} 
        minZoom={2}
        maxBounds={BOUNDS}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true} 
        className="w-full h-full z-0"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={20}
        />
        
        {clusters.map((cluster, idx) => {
          const first = cluster[0];
          const lat = first.metadata!.gps!.lat;
          const lng = first.metadata!.gps!.lng;
          
          return (
            <Marker 
              key={idx} 
              position={[lat, lng]} 
              icon={createNeuralIcon(cluster.length)}
            >
              <Popup className="neural-popup" minWidth={280}>
                <div className="p-1 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                      {cluster.length} Activos en Nodo
                    </p>
                    <div className="flex items-center gap-1 opacity-40">
                      <Navigation className="h-2.5 w-2.5" />
                      <span className="text-[8px] font-mono">{lat.toFixed(2)}, {lng.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-hide">
                    {cluster.map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => onMediaClick?.(item)}
                        className="group relative aspect-square rounded-xl overflow-hidden bg-white/5 cursor-pointer ring-1 ring-white/10 hover:ring-primary transition-all duration-300"
                      >
                        <Image 
                          src={item.thumbnailUrl} 
                          alt="" 
                          fill 
                          className={cn("object-cover transition-transform duration-500 group-hover:scale-110", item.isAdultContent && "blur-md")}
                        />
                        {item.type === 'video' && (
                          <div className="absolute top-1 right-1 p-1 bg-black/40 backdrop-blur-md rounded-md">
                            <Play className="h-2.5 w-2.5 text-white fill-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        <ZoomControl position="bottomright" />
        <MapController center={center} />
      </MapContainer>
      
      <div className="absolute top-8 left-8 z-[400] pointer-events-none">
        <div className="bg-black/60 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-[2rem] flex items-center gap-5 shadow-2xl">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_15px_#66E0FF]" />
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-accent animate-ping" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Radar de Infraestructura</p>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
              {mediaWithCoords.length} nodos geolocalizados activos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Controlador de Vista Neural
 * Gestiona el centrado y los vuelos de cámara del mapa.
 */
function MapController({ center }: { center?: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.flyTo(center, 14, {
        animate: true,
        duration: 1.5
      });
    }
  }, [center, map]);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 400);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
}
