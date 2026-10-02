"use client";

import { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { getMediaByUser } from '@/lib/storage';
import { Media, User } from '@/lib/types';
import { 
  Clock, 
  ChevronRight, 
  Play, 
  X, 
  History, 
  HardDrive, 
  Maximize2, 
  Calendar, 
  Plus,
  ArrowUp,
  Loader2,
  Inbox,
  CalendarDays,
  Timer,
  Zap,
  LayoutGrid,
  Activity,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';
import NeuralVideoPlayer from '@/components/neural-video-player';
import { cn, formatRelativeDate, formatBytes } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// Parámetros de Ingesta Visual Optimizada
const INITIAL_BATCH = 60;
const SUBSEQUENT_BATCH = 80;

// Componente TimelineItem: Renderizado de ultra-bajo impacto
const TimelineItem = memo(({ item, onClick }: { item: Media, onClick: (m: Media) => void }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div 
      onClick={() => onClick(item)}
      className="group/card relative aspect-square rounded-xl overflow-hidden bg-white/[0.02] border border-white/5 hover:border-primary/50 transition-all cursor-pointer shadow-lg"
    >
      {!isLoaded && (
        <div className="absolute inset-0 bg-white/[0.03] animate-pulse flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
        </div>
      )}
      
      <img 
        src={item.thumbnailUrl} 
        alt={item.filename}
        onLoad={() => setIsLoaded(true)}
        loading="lazy"
        className={cn(
          "w-full h-full object-cover transition-all duration-500", 
          !isLoaded && "opacity-0",
          isLoaded && "opacity-100",
          item.isAdultContent && "blur-2xl opacity-40"
        )} 
      />

      {item.type === 'video' && (
        <div className="absolute top-1.5 right-1.5 z-10 p-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/5">
          <Play className="h-2.5 w-2.5 fill-white text-white" />
        </div>
      )}
      
      <div className="absolute inset-0 z-30 flex flex-col justify-end p-2 opacity-0 group-hover/card:opacity-100 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity">
        <p className="text-[8px] font-bold text-white truncate uppercase tracking-tighter">{item.filename}</p>
      </div>
    </div>
  );
});
TimelineItem.displayName = 'TimelineItem';

const TimelineMonthGroup = ({ label, items, onMediaClick, anchorId }: { 
  label: string, 
  items: Media[], 
  onMediaClick: (m: Media) => void,
  anchorId: string
}) => {
  const [displayLimit, setDisplayLimit] = useState(INITIAL_BATCH);
  const observerRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    if (displayLimit < items.length) {
      setDisplayLimit(prev => prev + SUBSEQUENT_BATCH);
    }
  }, [displayLimit, items.length]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { threshold: 0.1, rootMargin: '1000px' });

    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const estimatedRows = Math.ceil(items.length / 6);
  const minHeight = items.length > 50 ? `${estimatedRows * 120}px` : 'auto';

  return (
    <section 
      id={anchorId} 
      data-timeline-section={anchorId.replace('anchor-', '')} 
      className="relative pl-6 sm:pl-16 space-y-6 group/section animate-slide-up scroll-mt-24"
      style={{ minHeight }}
    >
      <div className="absolute left-8 -top-20 bottom-0 w-px bg-gradient-to-b from-primary/5 via-primary/20 to-transparent hidden sm:block" />
      <div className="absolute left-6 top-1.5 w-4 h-4 rounded-full border-4 border-background bg-primary group-hover/section:scale-125 group-hover/section:shadow-[0_0_20px_#7373F0] transition-all z-10 hidden sm:block" />
      
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl sm:text-3xl font-black text-white capitalize font-headline group-hover/section:text-primary transition-colors tracking-tight">
          {label}
        </h2>
        <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest px-1">
          {items.length} activos orquestados
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {items.slice(0, displayLimit).map((item) => (
          <TimelineItem key={item.id} item={item} onClick={onMediaClick} />
        ))}
      </div>

      {displayLimit < items.length ? (
        <div ref={observerRef} className="h-40 flex flex-col items-center justify-center gap-3 opacity-30">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando Bloque...</span>
        </div>
      ) : (
        <div className="h-20" />
      )}
    </section>
  );
};

export default function TimelinePage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    const sessionData = localStorage.getItem('ps_active_session');
    if (sessionData) {
      const currentUser = JSON.parse(sessionData) as User;
      try {
        if (!silent) setLoading(true);
        const allMedia = await getMediaByUser(currentUser.id);
        const activeMedia = allMedia
          .filter(m => !m.isDeleted && isValid(parseISO(m.createdAt)))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMedia(activeMedia);
        
        if (activeMedia.length > 0 && !silent) {
          setActiveAnchor(format(parseISO(activeMedia[0].createdAt), 'yyyy-MM'));
        }
      } catch (error) {
        console.error("Falla en cronología:", error);
      } finally {
        if (!silent) setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();

    // ESCUCHAR ACTUALIZACIONES TEMPORALES
    const onNeuralUpdate = () => fetchData(true);
    window.addEventListener('neural-update', onNeuralUpdate);
    return () => window.removeEventListener('neural-update', onNeuralUpdate);
  }, [fetchData]);

  useEffect(() => {
    if (loading || media.length === 0) return;

    const options = { root: null, rootMargin: '-20% 0px -60% 0px', threshold: 0 };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-timeline-section');
          if (sectionId) setActiveAnchor(sectionId);
        }
      });
    }, options);

    const sections = document.querySelectorAll('[data-timeline-section]');
    sections.forEach(section => observer.observe(section));

    return () => observer.disconnect();
  }, [loading, media.length]);

  const groupedMedia = useMemo(() => {
    const groups: Record<string, { label: string, items: Media[] }> = {};
    media.forEach(m => {
      const date = parseISO(m.createdAt);
      const key = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: es });
      if (!groups[key]) groups[key] = { label, items: [] };
      groups[key].items.push(m);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [media]);

  const timelineAnchors = useMemo(() => {
    return groupedMedia.map(([key, group]) => ({
      key,
      label: group.label
    }));
  }, [groupedMedia]);

  const scrollToAnchor = (key: string) => {
    const element = document.getElementById(`anchor-${key}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveAnchor(key);
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  };

  const totalSizeFormatted = useMemo(() => {
    const bytes = media.reduce((acc, m) => acc + (m.size || 0), 0);
    return formatBytes(bytes);
  }, [media]);

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-in flex flex-col lg:flex-row gap-8">
        
        <div className="flex-1 space-y-16 min-w-0 pb-32">
          <header className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className="bg-primary/20 text-primary border-none font-black text-[9px] uppercase tracking-[0.3em] px-4 py-1 rounded-full shadow-lg">Registro Temporal</Badge>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white font-headline tracking-tighter">
              Cronología <span className="text-primary/60 italic">Neural</span>
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">Navegación física por tu infraestructura de datos de alta fidelidad.</p>
          </header>

          {loading ? (
            <div className="space-y-20">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-8 pl-16 relative">
                  <div className="absolute left-8 top-1 bottom-0 w-px bg-white/5" />
                  <Skeleton className="h-10 w-64 bg-white/5 rounded-xl" />
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                    {Array.from({ length: 12 }).map((_, j) => <Skeleton key={j} className="aspect-square rounded-lg bg-white/5" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-24">
              {groupedMedia.map(([key, group]) => (
                <TimelineMonthGroup 
                  key={key}
                  anchorId={`anchor-${key}`}
                  label={group.label}
                  items={group.items}
                  onMediaClick={setSelectedMedia}
                />
              ))}
            </div>
          )}
        </div>

        {/* HUD LATERAL INTELIGENTE */}
        <aside className="w-full lg:w-[320px] shrink-0">
          <div className="sticky top-6 space-y-4">
            
            <Card className="p-5 rounded-[2rem] bg-card/60 border-white/5 space-y-4 backdrop-blur-xl shadow-2xl overflow-hidden relative">
              <div className="absolute -top-4 -right-4 opacity-5 rotate-12"><Zap className="h-20 w-20 text-primary" /></div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20"><Activity className="h-4 w-4" /></div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Telemetría de Nodo</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 relative z-10">
                <div className="space-y-0.5"><p className="text-[8px] uppercase font-bold text-muted-foreground tracking-widest">Activos</p><p className="text-xl font-black text-white">{media.length}</p></div>
                <div className="text-right space-y-0.5"><p className="text-[8px] uppercase font-bold text-muted-foreground tracking-widest">Peso Físico</p><p className="text-xl font-black text-accent">{totalSizeFormatted}</p></div>
              </div>
            </Card>

            <Card className="bg-card/40 border-white/5 rounded-[2.5rem] backdrop-blur-3xl overflow-hidden shadow-2xl flex flex-col">
              <div className="p-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                  <Timer className="h-3.5 w-3.5" /> Viaje Temporal
                </h3>
                <Badge variant="outline" className="text-[8px] h-4 px-1.5 border-white/10 opacity-60">{groupedMedia.length}</Badge>
              </div>
              
              <ScrollArea className="max-h-[calc(100vh-450px)] sm:max-h-[calc(100vh-480px)]">
                <div className="p-2.5 space-y-1">
                  {timelineAnchors.map((anchor) => {
                    const isActive = activeAnchor === anchor.key;
                    return (
                      <button 
                        key={anchor.key}
                        onClick={() => scrollToAnchor(anchor.key)}
                        className={cn(
                          "w-full text-left px-4 py-4 rounded-2xl transition-all duration-300 group flex items-center justify-between border border-transparent",
                          isActive 
                            ? "bg-primary/20 text-primary border-primary/20 scale-[1.02] shadow-xl" 
                            : "hover:bg-white/5 text-muted-foreground hover:text-white"
                        )}
                      >
                        <span className={cn("text-xs font-bold capitalize truncate", isActive ? "text-white" : "text-white/60")}>
                          {anchor.label}
                        </span>
                        {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>

            <div className="p-6 text-center opacity-10 group hover:opacity-40 transition-opacity">
              <p className="text-[8px] font-black uppercase tracking-[0.5em] text-white">PixelSphere Engine v12.6</p>
            </div>
          </div>
        </aside>

        {/* VISOR MAESTRO */}
        <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && setSelectedMedia(null)}>
          <DialogContent className="max-w-[100vw] lg:max-w-7xl p-0 overflow-hidden bg-black sm:rounded-[2.5rem] shadow-2xl h-[100vh] sm:h-[90vh] lg:h-[85vh] border-none z-[200]">
            {selectedMedia && (
              <div className="flex flex-col lg:flex-row h-full overflow-hidden">
                <div className="relative h-[50vh] sm:h-[60vh] lg:h-full lg:flex-1 bg-black flex items-center justify-center overflow-hidden shrink-0">
                  <Button variant="ghost" size="icon" className="absolute top-6 left-6 z-50 rounded-full bg-black/40 text-white lg:hidden" onClick={() => setSelectedMedia(null)}><X className="h-6 w-6" /></Button>
                  {selectedMedia.type === 'video' ? <NeuralVideoPlayer src={selectedMedia.url} className="w-full h-full" /> : <img src={selectedMedia.url} className="w-full h-full object-contain" alt="" />}
                </div>
                <div className="flex-1 lg:w-[420px] bg-card border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col overflow-hidden">
                  <ScrollArea className="flex-1">
                    <div className="p-10 space-y-10">
                      <div className="space-y-3">
                        <Badge className="bg-primary/20 text-primary border-none text-[10px] font-black uppercase tracking-[0.3em] px-4 py-1 rounded-full">
                          {format(parseISO(selectedMedia.createdAt), 'MMMM yyyy', { locale: es })}
                        </Badge>
                        <DialogTitle className="text-3xl font-black text-white tracking-tight">{selectedMedia.filename}</DialogTitle>
                      </div>
                      
                      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 space-y-6">
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-primary flex items-center gap-2">
                          <Clock className="h-3 w-3" /> Metadatos de Red
                        </p>
                        <div className="space-y-4">
                          <div className="flex justify-between text-[11px] items-center"><span className="text-muted-foreground uppercase font-bold">Fecha</span><span className="text-white">{format(parseISO(selectedMedia.createdAt), 'dd/MM/yyyy', { locale: es })}</span></div>
                          <div className="flex justify-between text-[11px] items-center"><span className="text-muted-foreground uppercase font-bold">Hora</span><span className="text-white font-mono">{format(parseISO(selectedMedia.createdAt), 'HH:mm:ss')}</span></div>
                          <div className="flex justify-between text-[11px] items-center"><span className="text-muted-foreground uppercase font-bold">Peso</span><span className="text-accent font-bold">{formatBytes(selectedMedia.size)}</span></div>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}