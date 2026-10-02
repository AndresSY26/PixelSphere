"use client";

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { getUnifiedDashboardData, deleteMedia, updateMedia, addMultipleToAlbum, removeMultipleFromAlbum, updateUserFilterPreferences } from '@/lib/storage';
import { Media, Album, User } from '@/lib/types';
import { 
  Search, 
  ImageIcon, 
  FolderOpen, 
  Layers, 
  ShieldAlert, 
  Clock, 
  MoreVertical, 
  Globe, 
  Lock,
  Play,
  X,
  ShieldCheck,
  Download,
  Trash2,
  Share2,
  ChevronRight,
  Loader2,
  ChevronLeft,
  Folder,
  FolderTree,
  PlusCircle,
  Maximize2,
  Calendar,
  Info,
  Check,
  CheckCircle2,
  MinusCircle,
  Plus,
  HardDrive,
  Navigation
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import NeuralVideoPlayer from '@/components/neural-video-player';
import { useToast } from '@/hooks/use-toast';
import { cn, formatRelativeDate, formatBytes } from '@/lib/utils';
import Link from 'next/link';

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const { toast } = useToast();
  
  const [media, setMedia] = useState<Media[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [adultToConfirm, setAdultToConfirm] = useState<Media | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  // Filtros Persistentes de Búsqueda
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');
  const [adultFilter, setAdultFilter] = useState<'all' | 'safe' | 'adult'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name'>('date-desc');

  const [linkNavParentId, setLinkNavParentId] = useState<string | null>(null);

  // EFECTO: Carga Inicial y Preferencias de Búsqueda
  useEffect(() => {
    const loadData = async () => {
      const sessionData = localStorage.getItem('ps_active_session');
      if (sessionData) {
        const currentUser = JSON.parse(sessionData) as User;
        setUser(currentUser);
        
        // Aplicar preferencias guardadas para búsqueda
        if (currentUser.filterPreferences?.search) {
          const prefs = currentUser.filterPreferences.search;
          if (prefs.filterType) setFilterType(prefs.filterType);
          if (prefs.adultFilter) setAdultFilter(prefs.adultFilter);
          if (prefs.sortBy) setSortBy(prefs.sortBy);
        }

        try {
          setLoading(true);
          const data = await getUnifiedDashboardData(currentUser.id);
          // FILTRAR EXCLUYENDO ELIMINADOS
          setMedia(data.media.filter(m => !m.isPrivate && !m.isDeleted));
          setAlbums(data.albums);
        } catch (error) {
          console.error("Error cargando datos de búsqueda:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    loadData();
  }, []);

  const allUniqueTags = useMemo(() => {
    const tags = new Set<string>();
    media.forEach(m => m.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [media]);

  // EFECTO: Persistir Filtros de Búsqueda
  useEffect(() => {
    if (!user || loading) return;
    const persistSearchFilters = async () => {
      const prefs = { filterType, adultFilter, sortBy };
      const updatedUser = { ...user, filterPreferences: { ...user.filterPreferences, search: prefs } };
      localStorage.setItem('ps_active_session', JSON.stringify(updatedUser));
      await updateUserFilterPreferences(user.id, 'search', prefs);
    };
    const timer = setTimeout(persistSearchFilters, 500);
    return () => clearTimeout(timer);
  }, [filterType, adultFilter, sortBy, user, loading]);

  const getFullAlbumPath = useCallback((albumId: string) => {
    const path: string[] = [];
    let cur: string | undefined = albumId;
    while (cur) {
      const a = albums.find(al => al.id === cur);
      if (a) { path.unshift(a.title); cur = a.parentId; }
      else cur = undefined;
    }
    return path.join(' / ');
  }, [albums]);

  const results = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return { albums: [], media: [] };

    const filteredAlbums = albums.filter(a => 
      a.title.toLowerCase().includes(q) || 
      (a.description && a.description.toLowerCase().includes(q))
    );

    let filteredMedia = media.filter(m => 
      m.filename.toLowerCase().includes(q) || 
      (m.tags && m.tags.some(t => t.toLowerCase().includes(q)))
    );

    // Aplicar filtros de búsqueda
    if (filterType !== 'all') filteredMedia = filteredMedia.filter(m => m.type === filterType);
    if (adultFilter === 'safe') filteredMedia = filteredMedia.filter(m => !m.isAdultContent);
    if (adultFilter === 'adult') filteredMedia = filteredMedia.filter(m => m.isAdultContent);

    filteredMedia.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'date-asc') return new Date(a.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'name') return a.filename.localeCompare(b.filename);
      return 0;
    });

    return { albums: filteredAlbums, media: filteredMedia };
  }, [albums, media, query, filterType, adultFilter, sortBy]);

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteMedia(id, user.id);
      setMedia(prev => prev.filter(m => m.id !== id));
      toast({ title: "Movido a Papelera", description: "Tienes 30 días para recuperarlo." });
      setSelectedMedia(null);
    } catch (e) {
      console.error("Error al eliminar medio en búsqueda:", e);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleUpdateMediaMeta = async (updates: Partial<Media>) => {
    if (!selectedMedia || !user) return;
    setIsUpdating(true);
    try {
      const updated = await updateMedia(selectedMedia.id, user.id, updates);
      if (updated) {
        setMedia(prev => prev.map(m => m.id === selectedMedia.id ? (updated as Media) : m));
        setSelectedMedia(updated as Media);
      }
    } catch (e) {
      console.error("Error al actualizar metadatos del medio en búsqueda:", e);
      toast({ title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddTag = async () => {
    if (!tagInput.trim() || !selectedMedia) return;
    const currentTags = selectedMedia.tags || [];
    if (currentTags.includes(tagInput.trim())) return;
    await handleUpdateMediaMeta({ tags: [...currentTags, tagInput.trim()] });
    setTagInput('');
    setTagSuggestions([]);
  };

  const handleTagInputChange = (val: string) => {
    setTagInput(val);
    if (val.trim()) {
      const filtered = allUniqueTags.filter(t => 
        t.toLowerCase().includes(val.toLowerCase()) && 
        !selectedMedia?.tags?.includes(t)
      );
      setTagSuggestions(filtered);
    } else {
      setTagSuggestions([]);
    }
  };

  const handleSelectSuggestion = (tag: string) => {
    if (selectedMedia && !selectedMedia.tags?.includes(tag)) {
      handleUpdateMediaMeta({ tags: [...(selectedMedia.tags || []), tag] });
    }
    setTagInput('');
    setTagSuggestions([]);
  };

  const handleSingleAddToAlbum = async (albumId: string) => {
    if (!user || !selectedMedia) return;
    try { 
      const result = await addMultipleToAlbum(albumId, user.id, [selectedMedia.id]); 
      if (result) {
        setAlbums(prev => prev.map(a => a.id === albumId ? (result as Album) : a));
      }
      const album = albums.find(a => a.id === albumId);
      toast({ title: "Vínculo Creado", description: `Añadido a ${album?.title}` }); 
    } catch (e) {
      console.error("Error al añadir al álbum en búsqueda:", e);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleRemoveFromAlbum = async (albumId: string) => {
    if (!user || !selectedMedia) return;
    try {
      const result = await removeMultipleFromAlbum(albumId, user.id, [selectedMedia.id]);
      if (result) {
        setAlbums(prev => prev.map(a => a.id === albumId ? (result as Album) : a));
      }
      const album = albums.find(a => a.id === albumId);
      toast({ title: "Vínculo Removido", description: `Retirado de ${album?.title}` });
    } catch (e) {
      console.error("Error al remover del álbum en búsqueda:", e);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const openViewer = (item: Media) => {
    if (item.isAdultContent) {
      setAdultToConfirm(item);
    } else {
      setSelectedMedia(item);
      setTagInput('');
      setTagSuggestions([]);
      setLinkNavParentId(null);
    }
  };

  const AlbumBrowser = ({ onSelect, onRemove }: { onSelect: (id: string) => void, onRemove: (id: string) => void }) => {
    const currentList = useMemo(() => albums.filter(a => a.parentId === (linkNavParentId || undefined)), [linkNavParentId, albums]);
    const parentAlbum = useMemo(() => albums.find(a => a.id === linkNavParentId), [linkNavParentId, albums]);
    const isAlreadyLinked = selectedMedia ? parentAlbum?.mediaIds.includes(selectedMedia.id) : false;

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            {linkNavParentId ? (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] uppercase font-bold text-primary hover:bg-primary/10" onClick={() => setLinkNavParentId(parentAlbum?.parentId || null)}>
                <ChevronLeft className="h-3 w-3 mr-1" /> Volver
              </Button>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Infraestructura Raíz</span>
            )}
            {linkNavParentId && (
              <span className="text-[10px] font-bold text-white truncate max-w-[120px]">{parentAlbum?.title}</span>
            )}
          </div>
          
          {linkNavParentId && (
            isAlreadyLinked ? (
              <Button 
                className="w-full h-12 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-bold gap-2 group transition-all"
                onClick={() => onRemove(linkNavParentId)}
              >
                <MinusCircle className="h-4 w-4" /> Desvincular de "{parentAlbum?.title}"
              </Button>
            ) : (
              <Button 
                className="w-full h-12 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-xl text-xs font-bold gap-2 group transition-all"
                onClick={() => onSelect(linkNavParentId)}
              >
                <Check className="h-4 w-4" /> Vincular en "{parentAlbum?.title}"
              </Button>
            )
          )}
          {!linkNavParentId && (
            <div className="w-full h-12 bg-white/5 text-muted-foreground/40 border border-white/5 rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Selecciona una carpeta
            </div>
          )}
        </div>

        <Separator className="bg-white/5" />

        <ScrollArea className="h-64 pr-2">
          <div className="space-y-1">
            {currentList.map(album => {
              const hasMedia = selectedMedia && album.mediaIds.includes(selectedMedia.id);
              return (
                <Button 
                  key={album.id}
                  variant="ghost" 
                  className={cn(
                    "w-full justify-between h-14 px-4 rounded-xl hover:bg-white/5 group border border-transparent transition-all",
                    hasMedia && "bg-primary/5 border-primary/10"
                  )}
                  onClick={() => setLinkNavParentId(album.id)}
                >
                  <div className="flex items-center min-w-0">
                    <Folder className={cn("h-5 w-5 mr-3 shrink-0 group-hover:scale-110 transition-transform", hasMedia ? "text-primary" : "text-accent/60")} />
                    <div className="text-left min-w-0">
                      <p className={cn("text-sm font-bold truncate", hasMedia ? "text-primary" : "text-white")}>{album.title}</p>
                      <p className="text-[9px] uppercase font-black text-muted-foreground/40">{album.mediaIds.length} activos vinculados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasMedia && <CheckCircle2 className="h-3 w-3 text-primary" />}
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Button>
              );
            })}
            {currentList.length === 0 && (
              <div className="py-12 text-center opacity-20">
                <FolderTree className="h-10 w-10 mx-auto mb-2" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-white">Carpeta Despejada</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-fade-in max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary/20 text-primary border-none font-black text-[10px] uppercase tracking-widest px-3 py-1">Motor de Búsqueda</Badge>
            <div className="h-px w-12 bg-white/10" />
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Resultados para:</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white font-headline tracking-tighter">
            &ldquo;{query}&rdquo;
          </h1>
          <p className="text-muted-foreground text-sm">
            Encontrados {results.albums.length} álbumes y {results.media.length} activos multimedia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl border-white/10 bg-white/5 text-white h-12 px-6">
                <Search className="h-4 w-4 mr-2 text-primary" /> Filtrar Resultados
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 bg-card/95 backdrop-blur-xl border-white/10 shadow-2xl p-2 space-y-4">
              <div>
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Tipo de Activo</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                  <DropdownMenuRadioItem value="all" className="text-xs">Todo</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="image" className="text-xs">Imágenes</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="video" className="text-xs">Videos</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </div>
              <DropdownMenuSeparator className="bg-white/5" />
              <div>
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-accent mb-1">Sensibilidad</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={adultFilter} onValueChange={(v) => setAdultFilter(v as any)}>
                  <DropdownMenuRadioItem value="all" className="text-xs">Todo</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="safe" className="text-xs">Seguro</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="adult" className="text-xs">Adulto</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </div>
              <DropdownMenuSeparator className="bg-white/5" />
              <div>
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Ordenamiento</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <DropdownMenuRadioItem value="date-desc" className="text-xs">Recientes</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="date-asc" className="text-xs">Antiguos</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name" className="text-xs">Nombre</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {loading ? (
        <div className="space-y-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-3xl bg-white/5" />)}
          </div>
        </div>
      ) : results.albums.length === 0 && results.media.length === 0 ? (
        <div className="py-32 text-center space-y-6 bg-white/[0.02] border border-dashed border-white/10 rounded-[3rem]">
          <div className="w-20 h-20 rounded-[2.5rem] bg-white/5 flex items-center justify-center mx-auto">
            <Search className="h-10 w-10 text-muted-foreground opacity-20" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Sin coincidencias en el nexo</h3>
            <p className="text-muted-foreground max-sm mx-auto text-sm">
              No hemos localizado activos ni colecciones físicas que respondan a ese patrón de búsqueda.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl border-white/10 text-white">
            <Link href="/dashboard">Volver al Panel</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-16">
          {results.albums.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-sm font-black uppercase tracking-[0.3em] text-accent flex items-center gap-2 px-1">
                <Layers className="h-4 w-4" /> Colecciones Encontradas
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {results.albums.map((album) => (
                  <Card key={album.id} className="bg-card/50 border-white/5 group hover:border-primary/50 transition-all overflow-hidden rounded-[2.5rem] relative shadow-xl">
                    <Link href={`/albums?id=${album.id}`} className="block">
                      <div className="relative aspect-square overflow-hidden bg-black/40">
                        <div className="absolute inset-0 flex items-center justify-center text-white/5">
                          <FolderOpen className="h-20 w-20" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
                        <div className="absolute bottom-6 left-6 right-6 z-10">
                          <h3 className="text-xl font-bold text-white truncate">{album.title}</h3>
                          <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-1 flex items-center gap-2">
                            <ImageIcon className="h-3 w-3" /> {album.mediaIds.length} Activos vinculados
                          </p>
                        </div>
                      </div>
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {results.media.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-sm font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 px-1">
                <ImageIcon className="h-4 w-4" /> Activos Multimedia
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {results.media.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => openViewer(item)}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-white/[0.02] border border-white/5 hover:border-primary/50 transition-all cursor-pointer shadow-lg"
                  >
                    <Image 
                      src={item.thumbnailUrl} 
                      alt="" 
                      fill 
                      className={cn("object-cover transition-transform duration-500 group-hover:scale-110", item.isAdultContent && "blur-2xl opacity-40 scale-125")} 
                    />
                    {item.type === 'video' && (
                      <div className="absolute top-3 right-3 z-10 p-1.5 bg-black/40 backdrop-blur-md rounded-lg">
                        <Play className="h-3 w-3 fill-white text-white" />
                      </div>
                    )}
                    <div className="absolute inset-0 z-30 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300">
                      <p className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{item.filename}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!adultToConfirm} onOpenChange={(open) => !open && setAdultToConfirm(null)}>
        <DialogContent className="max-w-md bg-card border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
          <DialogHeader className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto border border-accent/20">
              <ShieldAlert className="h-8 w-8 text-accent" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white">Contenido Sensible</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Este activo ha sido clasificado como contenido para adultos. ¿Deseas proceder?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button variant="ghost" onClick={() => setAdultToConfirm(null)} className="flex-1 rounded-xl text-white">Cancelar</Button>
            <Button 
              className="flex-1 bg-accent text-accent-foreground font-bold rounded-xl h-12"
              onClick={() => {
                setSelectedMedia(adultToConfirm);
                setAdultToConfirm(null);
                setTagInput('');
                setTagSuggestions([]);
              }}
            >
              Confirmar Acceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div className="flex-1 lg:w-[400px] bg-card border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col overflow-hidden rounded-t-[2.5rem] lg:rounded-none">
                <ScrollArea className="flex-1">
                  <div className="p-6 sm:p-8 space-y-8">
                    <DialogTitle className="text-2xl font-extrabold text-white tracking-tight">{selectedMedia.filename}</DialogTitle>
                    
                    <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent flex items-center gap-2">
                        <HardDrive className="h-3 w-3" /> Info del Contenido
                      </p>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs items-center"><span className="text-muted-foreground uppercase flex items-center gap-2"><Maximize2 className="h-3 w-3" /> Dim.</span><span className="text-white font-mono">{selectedMedia.width} x {selectedMedia.height}</span></div>
                        <div className="flex justify-between text-xs items-center"><span className="text-muted-foreground uppercase flex items-center gap-2"><HardDrive className="h-3 w-3" /> Peso</span><span className="text-white font-mono">{formatBytes(selectedMedia.size)}</span></div>
                        <div className="flex justify-between text-xs items-center"><span className="text-muted-foreground uppercase flex items-center gap-2"><Calendar className="h-3 w-3" /> Ingesta</span><span className="text-white font-mono">{new Date(selectedMedia.createdAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>

                    <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2"><FolderTree className="h-3 w-3" /> Estado de Orquestación</p>
                      <div className="space-y-2">
                        {albums.filter(a => a.mediaIds.includes(selectedMedia.id)).length > 0 ? (
                          albums.filter(a => a.mediaIds.includes(selectedMedia.id)).map(a => (
                            <div key={a.id} className="text-[10px] text-primary uppercase font-bold tracking-widest flex items-center gap-2 bg-primary/5 p-2 rounded-lg border border-primary/10">
                              <CheckCircle2 className="h-3 w-3" /> {getFullAlbumPath(a.id)}
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-muted-foreground italic px-1">Sin vínculos a colecciones externas.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground px-1">Nexos (Etiquetas)</p>
                      <div className="flex flex-wrap gap-2">
                        {(selectedMedia.tags || []).map(tag => (
                          <Badge key={tag} className="bg-white/5 text-white border-white/5 px-3 py-1 rounded-full text-xs">#{tag} <X className="h-3 w-3 ml-2 cursor-pointer opacity-40 hover:opacity-100" onClick={() => handleUpdateMediaMeta({ tags: selectedMedia.tags.filter(t => t !== tag) })} /></Badge>
                        ))}
                        <div className="relative flex-1 min-w-[120px]">
                          <Input 
                            value={tagInput} 
                            onChange={(e) => handleTagInputChange(e.target.value)} 
                            placeholder="Añadir..." 
                            className="h-9 text-xs bg-white/5 rounded-full pr-8 border-white/5" 
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()} 
                          />
                          <PlusCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary cursor-pointer transition-transform active:scale-90" onClick={handleAddTag} />
                          
                          {tagSuggestions.length > 0 && (
                            <div className="absolute bottom-full left-0 w-full mb-2 bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-slide-up">
                              <ScrollArea className="max-h-40">
                                <div className="p-2 space-y-1">
                                  {tagSuggestions.map(tag => (
                                    <button 
                                      key={tag} 
                                      onClick={() => handleSelectSuggestion(tag)}
                                      className="w-full text-left px-3 py-2 text-[10px] font-bold text-white/70 hover:text-white hover:bg-primary/20 rounded-xl transition-all flex items-center justify-between group"
                                    >
                                      #{tag}
                                      <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary" />
                                    </button>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                <div className="p-4 sm:p-6 bg-black/40 border-t border-white/5 flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="h-12 bg-accent text-accent-foreground rounded-xl font-bold"><Share2 className="mr-2 h-4 w-4" /> Compartir</Button>
                    <Popover onOpenChange={(o) => !o && setLinkNavParentId(null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-12 border-white/10 text-white rounded-xl font-bold bg-white/5">
                          <PlusCircle className="mr-2 h-4 w-4 text-primary" /> Vincular
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-80 bg-card border-white/10 shadow-2xl p-4">
                        <AlbumBrowser onSelect={handleSingleAddToAlbum} onRemove={handleRemoveFromAlbum} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex gap-2 w-full"><Button asChild className="flex-1 h-12 bg-primary text-white rounded-xl font-bold"><a href={selectedMedia.url} download={selectedMedia.filename}><Download className="mr-2 h-4 w-4" /> Descargar</a></Button><Button variant="outline" className="h-12 w-12 rounded-xl border-white/10 text-red-400" onClick={() => handleDelete(selectedMedia.id)}><Trash2 className="h-5 w-5" /></Button></div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
        <SearchResultsContent />
      </Suspense>
    </DashboardLayout>
  );
}