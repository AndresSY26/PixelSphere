"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Media } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Play, Navigation, Layers, Moon, Sun, Satellite } from 'lucide-react';
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

type MapStyle = 'dark' | 'satellite' | 'streets';

const TILE_PROVIDERS: Record<MapStyle, { base: string; ref?: string; maxZoom: number; attribution: string }> = {
  dark: {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    ref: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors'
  },
  satellite: {
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Esri, Maxar, Earthstar Geographics'
  },
  streets: {
    base: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }
};

export default function WorldMap({ media, onMediaClick, center }: WorldMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const mediaWithCoords = useMemo(() => {
    return media.filter(m => {
      const lat = m.metadata?.gps?.lat ?? m.metadata?.latitude ?? (m as any).latitude;
      const lng = m.metadata?.gps?.lng ?? m.metadata?.longitude ?? (m as any).longitude;
      return lat !== undefined && lng !== undefined && !isNaN(Number(lat)) && !isNaN(Number(lng));
    });
  }, [media]);

  const clusters = useMemo(() => {
    const groups: Record<string, Media[]> = {};
    mediaWithCoords.forEach(m => {
      const lat = Number(m.metadata?.gps?.lat ?? m.metadata?.latitude ?? (m as any).latitude);
      const lng = Number(m.metadata?.gps?.lng ?? m.metadata?.longitude ?? (m as any).longitude);
      const key = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return Object.values(groups);
  }, [mediaWithCoords]);

  if (!isMounted) return null;

  const currentProvider = TILE_PROVIDERS[mapStyle];

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
          key={`${mapStyle}-base`}
          url={currentProvider.base}
          maxZoom={currentProvider.maxZoom}
        />
        {currentProvider.ref && (
          <TileLayer
            key={`${mapStyle}-ref`}
            url={currentProvider.ref}
            maxZoom={currentProvider.maxZoom}
          />
        )}
        
        {clusters.map((cluster, idx) => {
          const first = cluster[0];
          const lat = Number(first.metadata?.gps?.lat ?? first.metadata?.latitude ?? (first as any).latitude);
          const lng = Number(first.metadata?.gps?.lng ?? first.metadata?.longitude ?? (first as any).longitude);
          
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
                          src={item.thumbnailUrl || item.url} 
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
      
      {/* Selector de Capas de Mapa */}
      <div className="absolute top-8 right-8 z-[400] flex items-center gap-1 bg-black/70 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl">
        <button
          type="button"
          onClick={() => setMapStyle('dark')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all",
            mapStyle === 'dark' 
              ? "bg-primary text-white shadow-md shadow-primary/30" 
              : "text-white/60 hover:text-white hover:bg-white/5"
          )}
        >
          <Moon className="h-3.5 w-3.5" />
          <span>Oscuro</span>
        </button>
        <button
          type="button"
          onClick={() => setMapStyle('satellite')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all",
            mapStyle === 'satellite' 
              ? "bg-primary text-white shadow-md shadow-primary/30" 
              : "text-white/60 hover:text-white hover:bg-white/5"
          )}
        >
          <Satellite className="h-3.5 w-3.5" />
          <span>Satélite</span>
        </button>
        <button
          type="button"
          onClick={() => setMapStyle('streets')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all",
            mapStyle === 'streets' 
              ? "bg-primary text-white shadow-md shadow-primary/30" 
              : "text-white/60 hover:text-white hover:bg-white/5"
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Calles</span>
        </button>
      </div>

      {/* Radar de Infraestructura */}
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
