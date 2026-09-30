"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/dashboard-layout';
import { getMediaByUser } from '@/lib/storage';
import { Media, User } from '@/lib/types';
import { 
  Globe, 
  Search, 
  Loader2, 
  Navigation,
  X,
  HardDrive,
  Maximize2,
  Calendar,
  Share2,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import NeuralVideoPlayer from '@/components/neural-video-player';
import { useToast } from '@/hooks/use-toast';
import { formatBytes } from '@/lib/utils';

// Carga dinámica del mapa para evitar errores de SSR con Leaflet
const WorldMap = dynamic(() => import('@/components/world-map'), { 
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-[2.5rem] bg-white/5" />
});

export default function WorldPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [adultToConfirm, setAdultToConfirm] = useState<Media | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      const sessionData = localStorage.getItem('ps_active_session');
      if (sessionData) {
        const currentUser = JSON.parse(sessionData) as User;
        setUser(currentUser);
        try {
          const allMedia = await getMediaByUser(currentUser.id);
          setMedia(allMedia.filter(m => !m.isDeleted));
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      }
    }
    loadData();
  }, []);

  const handleRecalibrate = useCallback(() => {
    if ("geolocation" in navigator) {
      toast({ title: "Sincronizando...", description: "Obteniendo coordenadas del nexo local." });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter([pos.coords.latitude, pos.coords.longitude]);
          toast({ title: "Mapa Recalibrado", description: "Ubicación física sincronizada." });
        },
        () => {
          toast({ variant: "destructive", title: "Error GPS", description: "No se pudo acceder a la ubicación." });
        }
      );
    }
  }, [toast]);

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearchingLocation(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        toast({ title: "Ubicación Localizada", description: data[0].display_name });
      } else {
        toast({ variant: "destructive", title: "Sin Resultados", description: "No se encontró esa ubicación en la red." });
      }
    } catch (error) {
      console.error("Error al buscar coordenadas de ubicación:", error);
      toast({ variant: "destructive", title: "Falla de Red", description: "Error al buscar coordenadas." });
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const openViewer = useCallback((item: Media) => {
    if (item.isAdultContent) {
      setAdultToConfirm(item);
    } else {
      setSelectedMedia(item);
    }
  }, []);

  // Filtrar marcadores según el texto de búsqueda (nombre de archivo o etiquetas)
  const filteredMedia = useMemo(() => {
    if (!searchQuery.trim()) return media;
    return media.filter(m => 
      m.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [media, searchQuery]);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-140px)] flex flex-col space-y-6 animate-fade-in">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 shrink-0">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-white font-headline flex items-center gap-3">
              <Globe className="h-8 w-8 text-primary" /> Mapa Neural
            </h1>
            <p className="text-muted-foreground text-sm">Explora tu infraestructura física mediante coordenadas GPS.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearchLocation} className="relative w-64 hidden md:block">
              {isSearchingLocation ? (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
              <Input 
                placeholder="Localizar nexo o activo..." 
                className="pl-10 bg-white/5 border-white/10 rounded-full h-11"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <Button 
              variant="outline" 
              className="rounded-xl border-white/10 bg-white/5 h-11 hover:bg-primary/10 hover:text-primary transition-all"
              onClick={handleRecalibrate}
            >
              <Navigation className="h-4 w-4 mr-2 text-accent" /> Recalibrar
            </Button>
          </div>
        </header>

        <div className="flex-1 min-h-0 relative">
          {loading ? (
            <Skeleton className="w-full h-full rounded-[2.5rem] bg-white/5" />
          ) : (
            <WorldMap 
              media={filteredMedia} 
              onMediaClick={openViewer} 
              center={mapCenter} 
            />
          )}
        </div>

        {/* Visor de Medios */}
        <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && setSelectedMedia(null)}>
          <DialogContent className="max-w-[100vw] lg:max-w-7xl p-0 overflow-hidden bg-black sm:rounded-[2.5rem] shadow-2xl h-[100vh] sm:h-[90vh] lg:h-[85vh] border-none">
            {selectedMedia && (
              <div className="flex flex-col lg:flex-row h-full overflow-hidden">
                <div className="relative h-[50vh] sm:h-[60vh] lg:h-full lg:flex-1 bg-black flex items-center justify-center overflow-hidden shrink-0">
                  <Button variant="ghost" size="icon" className="absolute top-4 left-4 z-50 rounded-full bg-black/40 text-white lg:hidden" onClick={() => setSelectedMedia(null)}>
                    <X className="h-6 w-6" />
                  </Button>
                  {selectedMedia.type === 'video' ? (
                    <NeuralVideoPlayer src={selectedMedia.url} className="w-full h-full" />
                  ) : (
                    <img src={selectedMedia.url} className="w-full h-full object-contain" alt="" />
                  )}
                </div>
                <div className="flex-1 lg:w-[400px] bg-card border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col overflow-hidden">
                  <ScrollArea className="flex-1">
                    <div className="p-6 sm:p-8 space-y-8">
                      <DialogTitle className="text-2xl font-extrabold text-white tracking-tight">{selectedMedia.filename}</DialogTitle>
                      
                      <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent flex items-center gap-2">
                          <HardDrive className="h-3 w-3" /> Info del Contenido
                        </p>
                        <div className="space-y-3">
                          <div className="flex justify-between text-xs items-center">
                            <span className="text-muted-foreground uppercase flex items-center gap-2"><Maximize2 className="h-3 w-3" /> Dim.</span>
                            <span className="text-white font-mono">{selectedMedia.width} x {selectedMedia.height}</span>
                          </div>
                          <div className="flex justify-between text-xs items-center">
                            <span className="text-muted-foreground uppercase flex items-center gap-2"><Navigation className="h-3 w-3" /> Ubicación</span>
                            <span className="text-white font-mono text-[10px]">{selectedMedia.metadata?.gps?.lat.toFixed(4)}, {selectedMedia.metadata?.gps?.lng.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between text-xs items-center">
                            <span className="text-muted-foreground uppercase flex items-center gap-2"><Calendar className="h-3 w-3" /> Ingesta</span>
                            <span className="text-white font-mono">{new Date(selectedMedia.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between text-xs items-center">
                            <span className="text-muted-foreground uppercase flex items-center gap-2"><HardDrive className="h-3 w-3" /> Peso</span>
                            <span className="text-white font-mono">{formatBytes(selectedMedia.size)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-1">Nexos (Etiquetas)</p>
                        <div className="flex flex-wrap gap-2">
                          {(selectedMedia.tags || []).map(tag => (
                            <Badge key={tag} className="bg-white/5 text-white border-white/5 px-3 py-1 rounded-full text-xs">#{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                  <div className="p-4 sm:p-6 bg-black/40 border-t border-white/5 flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button className="h-12 bg-accent text-accent-foreground rounded-xl font-bold"><Share2 className="mr-2 h-4 w-4" /> Compartir</Button>
                      <Button variant="outline" className="h-12 border-white/10 text-white rounded-xl font-bold bg-white/5" onClick={() => toast({ title: "Funcionalidad de Vínculo", description: "Usa la Galería para gestionar álbumes." })}>
                        <Navigation className="mr-2 h-4 w-4 text-primary" /> Ver Galería
                      </Button>
                    </div>
                    <Button variant="outline" className="w-full h-10 rounded-xl border-white/10 text-red-400 text-[10px] uppercase font-black tracking-widest hover:bg-red-500/10 transition-all" onClick={() => setSelectedMedia(null)}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Cerrar Visor
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}