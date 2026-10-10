"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { getMedia, getViewHistory, clearViewHistory, recordMediaView } from '@/lib/storage';
import { Media, User, ViewHistoryEntry } from '@/lib/types';
import { 
  History, 
  Trash2, 
  Search, 
  CalendarDays, 
  Play, 
  ImageIcon, 
  X, 
  Clock, 
  ChevronRight, 
  Monitor,
  Smartphone,
  Compass,
  Globe,
  Film,
  Sparkles
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import NeuralVideoPlayer from '@/components/neural-video-player';
import { useToast } from '@/hooks/use-toast';
import { cn, formatRelativeDate } from '@/lib/utils';
import Image from 'next/image';

export default function ViewingHistoryPage() {
  const [historyEntries, setHistoryEntries] = useState<ViewHistoryEntry[]>([]);
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const sessionData = localStorage.getItem('ps_active_session') || localStorage.getItem('pixelsphere_session_user');
      if (sessionData) {
        const currentUser = JSON.parse(sessionData) as User;
        setUser(currentUser);

        const [history, media] = await Promise.all([
          getViewHistory(currentUser.id),
          getMedia()
        ]);
        
        // Sincronizar y combinar historial del servidor con entradas locales más recientes
        const localHistory = currentUser.viewHistory || [];
        const mergedMap = new Map<string, ViewHistoryEntry>();

        [...history, ...localHistory].forEach(entry => {
          if (!entry || !entry.mediaId) return;
          const existing = mergedMap.get(entry.mediaId);
          if (!existing || new Date(entry.viewedAt).getTime() > new Date(existing.viewedAt).getTime()) {
            mergedMap.set(entry.mediaId, entry);
          }
        });

        const sortedHistory = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()
        );

        setHistoryEntries(sortedHistory);
        setAllMedia(media.filter(m => !m.isDeleted));
      }
    } catch (e) {
      console.error("Error al cargar historial:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { 
    loadData(); 

    // Sincronización en tiempo real ante eventos del bus neural
    const handleNeuralUpdate = () => loadData(true);
    window.addEventListener('neural-update', handleNeuralUpdate);
    return () => window.removeEventListener('neural-update', handleNeuralUpdate);
  }, [loadData]);

  const historyWithMedia = useMemo(() => {
    return historyEntries.map(entry => {
      const media = allMedia.find(m => m.id === entry.mediaId);
      return media ? { ...entry, media } : null;
    }).filter((e): e is (ViewHistoryEntry & { media: Media }) => e !== null);
  }, [historyEntries, allMedia]);

  const filteredHistory = useMemo(() => {
    return historyWithMedia.filter(h => {
      const matchesSearch = 
        h.media.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.source && h.source.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (h.deviceName && h.deviceName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        h.media.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === 'all' || h.media.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [historyWithMedia, searchQuery, typeFilter]);

  const groupedHistory = useMemo(() => {
    return filteredHistory.reduce((acc: { label: string, items: any[] }[], item) => {
      const label = formatRelativeDate(item.viewedAt);
      const existingGroup = acc.find(g => g.label === label);
      if (existingGroup) existingGroup.items.push(item);
      else acc.push({ label, items: [item] });
      return acc;
    }, []);
  }, [filteredHistory]);

  const openMedia = (media: Media, source?: string) => {
    setSelectedMedia(media);
    if (user) {
      recordMediaView(user.id, media.id, {
        source: source || 'Historial de Visualización',
        deviceName: /mobile|android|iphone/i.test(navigator?.userAgent || '') ? 'Dispositivo Móvil' : 'Escritorio'
      });
    }
  };

  const handleClearHistory = async () => {
    if (!user) return;
    try {
      setIsClearing(true);
      await clearViewHistory(user.id);
      setHistoryEntries([]);
      setIsClearConfirmOpen(false);
      toast({
        title: "Historial purgado",
        description: "Se han eliminado todos los registros de visualización."
      });
    } catch (e) {
      toast({
        title: "Error al purgar historial",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-10 animate-fade-in pb-16">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-white font-headline flex items-center gap-3">
              <History className="h-10 w-10 text-primary" /> Historial de Visualización
            </h1>
            <p className="text-muted-foreground">Tu rastro en la red PixelSphere. Lo que has visto, en qué momento y desde dónde fue visto.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Buscar por nombre, origen, red..." 
                className="pl-10 bg-white/5 border-white/10 rounded-full h-11 text-white text-sm" 
              />
            </div>

            {historyEntries.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsClearConfirmOpen(true)}
                className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 rounded-full h-11 px-4 gap-2 text-xs font-semibold"
              >
                <Trash2 className="h-4 w-4" /> Limpiar Historial
              </Button>
            )}
          </div>
        </header>

        {/* Barra de Filtros de Tipo */}
        <div className="flex items-center gap-2 border-b border-white/5 pb-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTypeFilter('all')}
            className={cn(
              "rounded-full px-4 text-xs font-medium transition-all",
              typeFilter === 'all' 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            )}
          >
            Todos ({historyWithMedia.length})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTypeFilter('image')}
            className={cn(
              "rounded-full px-4 text-xs font-medium transition-all gap-1.5",
              typeFilter === 'image' 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Imágenes
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTypeFilter('video')}
            className={cn(
              "rounded-full px-4 text-xs font-medium transition-all gap-1.5",
              typeFilter === 'video' 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            )}
          >
            <Film className="h-3.5 w-3.5" /> Videos
          </Button>
        </div>

        {loading ? (
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-6 w-32 bg-white/5 rounded-lg" />
                <div className="grid gap-3">
                  {Array.from({ length: 2 }).map((_, j) => <Skeleton key={j} className="h-24 w-full bg-white/5 rounded-2xl" />)}
                </div>
              </div>
            ))}
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-28 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-[3rem] space-y-6">
            <div className="w-20 h-20 rounded-[2rem] bg-white/5 flex items-center justify-center mx-auto opacity-30">
              <History className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">
                {searchQuery ? "Sin coincidencias en el historial" : "Nexo sin Actividad"}
              </h3>
              <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                {searchQuery 
                  ? "Prueba buscando con otros términos o cambia el filtro de tipo." 
                  : "Explora imágenes o videos en tu galería o álbumes para registrar cada visualización en tiempo real."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {groupedHistory.map((group) => (
              <div key={group.label} className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <CalendarDays className="h-5 w-5 text-primary/70" />
                  <h2 className="text-sm font-bold text-white font-headline uppercase tracking-widest">{group.label}</h2>
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-xs text-muted-foreground font-mono">{group.items.length} vistas</span>
                </div>
                
                <div className="grid gap-3">
                  {group.items.map((item) => {
                    const isMobile = item.deviceName?.toLowerCase().includes('móvil') || item.deviceName?.toLowerCase().includes('celular');
                    const viewTime = new Date(item.viewedAt);
                    const formattedTime = !isNaN(viewTime.getTime()) 
                      ? viewTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : '';

                    return (
                      <Card 
                        key={item.id || `${item.mediaId}-${item.viewedAt}`} 
                        className="bg-card/40 border-white/5 hover:border-primary/40 hover:bg-card/70 transition-all rounded-2xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md"
                        onClick={() => openMedia(item.media, item.source)}
                      >
                        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Miniatura */}
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden relative bg-black/60 border border-white/5 shrink-0">
                              <Image 
                                src={item.media.thumbnailUrl || item.media.url} 
                                alt="" 
                                fill 
                                className={cn("object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300", item.media.isAdultContent && "blur-md")} 
                              />
                              {item.media.type === 'video' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <Play className="h-6 w-6 text-white fill-white drop-shadow-md" />
                                </div>
                              )}
                            </div>

                            {/* Metadatos y detalles de visualización */}
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-white text-sm sm:text-base group-hover:text-primary transition-colors truncate">
                                  {item.media.filename}
                                </h4>
                                <Badge variant="outline" className="text-[9px] uppercase border-white/10 text-muted-foreground py-0 h-4">
                                  {item.media.type}
                                </Badge>
                                {item.media.isAdultContent && (
                                  <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] py-0 h-4">
                                    Adulto
                                  </Badge>
                                )}
                              </div>

                              {/* Sección: ¿En qué momento y desde dónde fue visto? */}
                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                {/* Momento exacto */}
                                <div className="flex items-center gap-1.5 text-xs text-white/80 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
                                  <Clock className="h-3.5 w-3.5 text-primary" />
                                  <span className="font-semibold">{formattedTime}</span>
                                </div>

                                {/* Origen: ¿Desde dónde fue visto? */}
                                <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full font-medium">
                                  <Compass className="h-3.5 w-3.5" />
                                  <span>{item.source || 'Galería Principal'}</span>
                                </div>

                                {/* Dispositivo de visualización */}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                  {isMobile ? (
                                    <Smartphone className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Monitor className="h-3 w-3 text-cyan-400" />
                                  )}
                                  <span>{item.deviceName || 'Escritorio'}</span>
                                </div>

                                {/* Red / Nodo IP */}
                                {item.clientIp && (
                                  <div className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground/60 font-mono">
                                    <Globe className="h-2.5 w-2.5" />
                                    <span>{item.clientIp}</span>
                                  </div>
                                )}

                                {/* Progreso de Video */}
                                {user?.videoProgress?.[item.media.id] && item.media.type === 'video' && (
                                  <Badge className="bg-accent/10 text-accent border-none text-[9px] uppercase">
                                    Progreso: {Math.floor(user.videoProgress[item.media.id] / 60)}:{(Math.floor(user.videoProgress[item.media.id] % 60)).toString().padStart(2, '0')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end sm:justify-center shrink-0">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all rounded-xl h-10 w-10"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cuadro de Diálogo para Limpiar Historial */}
      <Dialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <DialogContent className="max-w-md bg-[#0a0a0c] border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
          <DialogHeader className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto border border-red-500/20">
              <Trash2 className="h-8 w-8 text-red-400" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white">¿Limpiar Historial?</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Esta acción eliminará todos los registros de visualización guardados en tu nodo. Las imágenes y videos originales se mantendrán intactos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button 
              variant="ghost" 
              onClick={() => setIsClearConfirmOpen(false)} 
              disabled={isClearing}
              className="flex-1 rounded-xl text-white"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleClearHistory} 
              disabled={isClearing}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl h-12"
            >
              {isClearing ? "Limpiando..." : "Confirmar Limpieza"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visor Multimedia de Pantalla Completa */}
      <Dialog open={!!selectedMedia} onOpenChange={(o) => !o && setSelectedMedia(null)}>
        <DialogContent className="max-w-6xl p-0 bg-black border-none rounded-none sm:rounded-[2.5rem] overflow-hidden shadow-2xl h-[90vh]">
          {selectedMedia && (
            <div className="flex flex-col h-full">
              <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
                {selectedMedia.type === 'video' ? (
                  <NeuralVideoPlayer 
                    key={selectedMedia.id}
                    src={selectedMedia.url} 
                    mediaId={selectedMedia.id} 
                    userId={user?.id || ''} 
                    initialPosition={user?.videoProgress?.[selectedMedia.id] || 0}
                    className="w-full h-full" 
                  />
                ) : (
                  <img src={selectedMedia.url} className="max-w-full max-h-full object-contain" alt="" />
                )}
              </div>
              <div className="h-20 bg-[#0a0a0c] border-t border-white/5 flex items-center justify-between px-8 shrink-0">
                <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold text-white">{selectedMedia.filename}</DialogTitle>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Visualizando desde Historial</p>
                </div>
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-muted-foreground" onClick={() => setSelectedMedia(null)}>
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
