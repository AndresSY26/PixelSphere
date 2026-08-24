"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  getGalleryLeanData,
  deleteMedia, 
  deleteMultipleMedia, 
  updateMedia, 
  updateMultipleMedia,
  addMultipleToAlbum,
  removeMultipleFromAlbum,
  findUserByUsername,
  recordInteraction,
  getFrequentContacts,
  updateUserFilterPreferences
} from '@/lib/storage';
import { Media, User, Album, GalleryFilters } from '@/lib/types';
import { 
  Filter, 
  LayoutGrid, 
  List, 
  Download, 
  Trash2, 
  Lock, 
  X, 
  CalendarDays, 
  Search,
  PlusCircle,
  Loader2,
  ImageIcon,
  HardDrive,
  ShieldAlert,
  FolderTree,
  Share2,
  UserPlus,
  UserCheck,
  Link as LinkIcon,
  Copy,
  Hash,
  Maximize2,
  Calendar,
  CheckCircle2,
  Timer,
  ShieldCheck,
  Unlock,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import NeuralVideoPlayer from '@/components/neural-video-player';
import { useToast } from '@/hooks/use-toast';
import { cn, formatRelativeDate, formatBytes } from '@/lib/utils';
import { MediaCard } from '@/components/media-card';
import { AlbumBrowser } from '@/components/album-browser';

const ITEMS_PER_PAGE = 50;

export default function GalleryPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [viewMode, setViewMode] = useState<GalleryFilters['viewMode']>('grid');
  const [filterType, setFilterType] = useState<GalleryFilters['filterType']>('all');
  const [adultFilter, setAdultFilter] = useState<GalleryFilters['adultFilter']>('all');
  const [sortBy, setSortBy] = useState<GalleryFilters['sortBy']>('date-desc');

  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [adultToConfirm, setAdultToConfirm] = useState<Media | null>(null);
  const [displayLimit, setDisplayLimit] = useState(ITEMS_PER_PAGE);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragSelectMode, setDragSelectMode] = useState(true);

  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [sharingAsset, setSharingAsset] = useState<Media | null>(null);
  const [shareUsername, setShareUsername] = useState('');
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [frequentContacts, setFrequentContacts] = useState<User[]>([]);
  
  const [linkNavParentId, setLinkNavParentId] = useState<string | null>(null);
  
  const { toast } = useToast();

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const sessionData = localStorage.getItem('ps_active_session');
      if (sessionData) {
        const currentUser = JSON.parse(sessionData) as User;
        setUser(currentUser);
        
        if (!silent && currentUser.filterPreferences?.gallery) {
          const prefs = currentUser.filterPreferences.gallery;
          if (prefs.viewMode) setViewMode(prefs.viewMode);
          if (prefs.filterType) setFilterType(prefs.filterType);
          if (prefs.adultFilter) setAdultFilter(prefs.adultFilter);
          if (prefs.sortBy) setSortBy(prefs.sortBy);
        }

        const { media: userMedia, albums: userAlbums } = await getGalleryLeanData(currentUser.id);
        setMedia(userMedia.filter(m => !m.isPrivate && !m.isDeleted));
        setAlbums(userAlbums);
        
        if (!silent) {
          getFrequentContacts(currentUser.id).then(setFrequentContacts);
        }
      }
    } catch (error) {
      console.error("Falla en actualización de galería:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const onNeuralUpdate = () => fetchData(true);
    window.addEventListener('neural-update', onNeuralUpdate);
    return () => window.removeEventListener('neural-update', onNeuralUpdate);
  }, [fetchData]);

  useEffect(() => {
    if (!user || loading) return;
    const persistFilters = async () => {
      const prefs: GalleryFilters = { viewMode, filterType, adultFilter, sortBy };
      await updateUserFilterPreferences(user.id, 'gallery', prefs);
    };
    const timer = setTimeout(persistFilters, 800); 
    return () => clearTimeout(timer);
  }, [viewMode, filterType, adultFilter, sortBy, user, loading]);

  const filteredMediaTotal = useMemo(() => {
    let result = media.filter(m => 
      m.filename.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (m.tags && m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
    );
    if (filterType !== 'all') result = result.filter(m => m.type === filterType);
    if (adultFilter === 'safe') result = result.filter(m => !m.isAdultContent);
    if (adultFilter === 'adult') result = result.filter(m => m.isAdultContent);
    
    result.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'date-asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'name') return a.filename.localeCompare(b.filename);
      return 0;
    });
    return result;
  }, [media, searchQuery, filterType, adultFilter, sortBy]);

  const paginatedMedia = useMemo(() => filteredMediaTotal.slice(0, displayLimit), [filteredMediaTotal, displayLimit]);

  const groupedMedia = useMemo(() => {
    return paginatedMedia.reduce((acc: { label: string, items: Media[] }[], item) => {
      const label = formatRelativeDate(item.createdAt);
      const existingGroup = acc.find(g => g.label === label);
      if (existingGroup) existingGroup.items.push(item);
      else acc.push({ label, items: [item] });
      return acc;
    }, []);
  }, [paginatedMedia]);

  const loadMoreItems = useCallback(() => {
    if (isMoreLoading || displayLimit >= filteredMediaTotal.length) return;
    setIsMoreLoading(true);
    setTimeout(() => { 
      setDisplayLimit(prev => prev + ITEMS_PER_PAGE); 
      setIsMoreLoading(false); 
    }, 100);
  }, [isMoreLoading, displayLimit, filteredMediaTotal.length]);

  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver((entries) => { 
      if (entries[0].isIntersecting) loadMoreItems(); 
    }, { threshold: 0.1, rootMargin: '600px' });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loading, loadMoreItems]);

  const handleDelete = useCallback(async (mediaId: string) => {
    if (!user) return;
    try { 
      await deleteMedia(mediaId, user.id); 
      toast({ title: "Movido a Papelera" }); 
      setSelectedMedia(null); 
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  }, [user, toast]);

  const handleVault = useCallback(async (mediaId: string) => {
    if (!user) return;
    try { 
      await updateMedia(mediaId, user.id, { isPrivate: true }); 
      toast({ title: "Activo Blindado" }); 
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  }, [user, toast]);

  const handleShareByUsername = async () => {
    if (!shareUsername.trim() || !user || !sharingAsset) return;
    setIsSearchingUser(true);
    try {
      const targetUser = await findUserByUsername(shareUsername.trim());
      if (!targetUser) { toast({ title: "No encontrado", variant: "destructive" }); setIsSearchingUser(false); return; }
      const currentShared = sharingAsset.sharedWith || [];
      const result = await updateMedia(sharingAsset.id, user.id, { sharedWith: [...currentShared, targetUser.id] });
      if (result && selectedMedia?.id === sharingAsset.id) setSelectedMedia(result as Media);
      await recordInteraction(user.id, targetUser.id);
      toast({ title: "Vínculo de Red Creado" });
      setIsShareOpen(false); setShareUsername('');
    } catch (error) { toast({ title: "Falla de Red", variant: "destructive" }); } finally { setIsSearchingUser(false); }
  };

  const toggleSelection = useCallback((id: string) => { 
    setSelectedIds(prev => { 
      const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); 
      if (next.size === 0) setIsSelectionMode(false); return next; 
    }); 
  }, []);

  const openViewer = useCallback((item: Media) => { 
    if (isSelectionMode) toggleSelection(item.id);
    else if (item.isAdultContent) setAdultToConfirm(item);
    else { setSelectedMedia(item); setTagInput(''); setTagSuggestions([]); setLinkNavParentId(null); }
  }, [isSelectionMode, toggleSelection]);

  const handlePointerDown = useCallback((id: string, isSelected: boolean) => {
    if (isSelectionMode) { setIsDragging(true); setDragSelectMode(!isSelected); toggleSelection(id); }
  }, [isSelectionMode, toggleSelection]);

  const getSelectionContext = useCallback(() => Array.from(selectedIds), [selectedIds]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-7xl mx-auto select-none">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {isSelectionMode ? (
            <div className="flex items-center justify-between w-full bg-primary/10 border border-primary/20 p-4 rounded-2xl animate-slide-up">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}><X className="h-5 w-5" /></Button>
                <span className="text-sm font-bold">{selectedIds.size} seleccionados</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl border-white/10 bg-white/5" onClick={async () => { await updateMultipleMedia(Array.from(selectedIds), user!.id, { isPrivate: true }); setSelectedIds(new Set()); setIsSelectionMode(false); }}><Lock className="h-4 w-4" /></Button>
                <Button variant="destructive" size="sm" className="rounded-xl" onClick={async () => { await deleteMultipleMedia(Array.from(selectedIds), user!.id); setSelectedIds(new Set()); setIsSelectionMode(false); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : (
            <>
              <div><h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-headline">Galería Neural</h1><p className="text-muted-foreground text-xs sm:text-sm mt-1">Exploración física en tiempo real.</p></div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" className="rounded-xl border-white/10 text-white h-10 px-4 bg-white/5"><Filter className="h-4 w-4 mr-2 text-primary" /> Filtrar</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 bg-card/95 backdrop-blur-xl border-white/10 shadow-2xl p-2 space-y-4">
                    <div><DropdownMenuLabel className="text-[10px] font-black uppercase text-primary">Tipo</DropdownMenuLabel><DropdownMenuRadioGroup value={filterType} onValueChange={(v) => setFilterType(v as any)}><DropdownMenuRadioItem value="all">Todo</DropdownMenuRadioItem><DropdownMenuRadioItem value="image">Imágenes</DropdownMenuRadioItem><DropdownMenuRadioItem value="video">Videos</DropdownMenuRadioItem></DropdownMenuRadioGroup></div>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <div><DropdownMenuLabel className="text-[10px] font-black uppercase text-primary">Orden</DropdownMenuLabel><DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as any)}><DropdownMenuRadioItem value="date-desc">Recientes</DropdownMenuRadioItem><DropdownMenuRadioItem value="date-asc">Antiguos</DropdownMenuRadioItem><DropdownMenuRadioItem value="name">Nombre</DropdownMenuRadioItem></DropdownMenuRadioGroup></div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="hidden sm:flex border border-white/10 rounded-xl bg-white/5 overflow-hidden"><Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-10 w-10" onClick={() => setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></Button><Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-10 w-10" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button></div>
            </div>
            </>
          )}
        </header>

        <div className="space-y-4">
          <div className="relative flex-1 w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar activos..." className="pl-10 bg-white/5 border-white/10 rounded-full h-11 text-white" /></div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (<div key={i} className="aspect-square rounded-2xl bg-white/5 animate-pulse" />))}
          </div>
        ) : (
          <div className="space-y-12">
            {groupedMedia.map((group) => (
              <div key={group.label} className="space-y-4">
                <div className="flex items-center gap-3 px-1"><CalendarDays className="h-5 w-5 text-accent" /><h2 className="text-base font-bold text-white capitalize">{group.label}</h2><div className="h-px flex-1 bg-white/5" /></div>
                <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" : "flex flex-col gap-2"}>
                  {group.items.map((item, idx) => (
                    <MediaCard 
                      key={item.id} 
                      item={item} 
                      viewMode={viewMode || 'grid'} 
                      index={idx} 
                      isSelected={selectedIds.has(item.id)} 
                      isSelectionMode={isSelectionMode} 
                      onDelete={handleDelete} 
                      onVault={handleVault}
                      onShare={(i) => { setSharingAsset(i); setIsShareOpen(true); }}
                      onGetSelectionContext={getSelectionContext}
                      onClick={openViewer} 
                      onPointerDown={(id, isSelected, e) => handlePointerDown(id, isSelected)}
                      onPointerEnter={(id) => { if (isDragging && isSelectionMode) toggleSelection(id); }}
                      onLongPress={() => { setIsSelectionMode(true); toggleSelection(item.id); }} 
                    />
                  ))}
                </div>
              </div>
            ))}
            <div ref={loaderRef} className="py-8 flex justify-center w-full">{displayLimit < filteredMediaTotal.length && <Loader2 className="h-8 w-8 text-primary animate-spin" />}</div>
          </div>
        )}
      </div>

      <Dialog open={!!adultToConfirm} onOpenChange={(open) => !open && setAdultToConfirm(null)}>
        <DialogContent className="max-w-md bg-card border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
          <DialogHeader className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto border border-accent/20"><ShieldAlert className="h-8 w-8 text-accent" /></div>
            <DialogTitle className="text-2xl font-bold text-white">Contenido Sensible</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">Este activo ha sido clasificado como contenido para adultos. ¿Deseas proceder?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button variant="ghost" onClick={() => setAdultToConfirm(null)} className="flex-1 rounded-xl text-white">Cancelar</Button>
            <Button className="flex-1 bg-accent text-accent-foreground font-bold rounded-xl h-12" onClick={() => { setSelectedMedia(adultToConfirm); setAdultToConfirm(null); }}>Confirmar Acceso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && setSelectedMedia(null)}>
        <DialogContent className="max-w-[100vw] lg:max-w-7xl p-0 overflow-hidden bg-black sm:rounded-[2.5rem] shadow-2xl h-[100vh] sm:h-[90vh] lg:h-[85vh] border-none">
          {selectedMedia && (
            <div className="flex flex-col lg:flex-row h-full overflow-hidden">
              <div className="relative h-[50vh] sm:h-[60vh] lg:h-full lg:flex-1 bg-black flex items-center justify-center overflow-hidden shrink-0">
                <Button variant="ghost" size="icon" className="absolute top-4 left-4 z-50 rounded-full bg-black/40 text-white lg:hidden" onClick={() => setSelectedMedia(null)}><X className="h-6 w-6" /></Button>
                {selectedMedia.type === 'video' ? <NeuralVideoPlayer src={selectedMedia.url} className="w-full h-full" /> : <img src={selectedMedia.url} className="w-full h-full object-contain" alt="" />}
              </div>
              <div className="flex-1 lg:w-[400px] bg-card border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1">
                  <div className="p-6 sm:p-8 space-y-8">
                    <DialogTitle className="text-2xl font-extrabold text-white tracking-tight">{selectedMedia.filename}</DialogTitle>
                    <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent flex items-center gap-2"><HardDrive className="h-3 w-3" /> Info del Contenido</p>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs items-center"><span className="text-muted-foreground uppercase flex items-center gap-2"><Maximize2 className="h-3 w-3" /> Dim.</span><span className="text-white font-mono">{selectedMedia.width} x {selectedMedia.height}</span></div>
                        <div className="flex justify-between text-xs items-center"><span className="text-muted-foreground uppercase flex items-center gap-2"><HardDrive className="h-3 w-3" /> Peso</span><span className="text-white font-mono">{formatBytes(selectedMedia.size)}</span></div>
                        <div className="flex justify-between text-xs items-center"><span className="text-muted-foreground uppercase flex items-center gap-2"><Calendar className="h-3 w-3" /> Ingesta</span><span className="text-white font-mono">{new Date(selectedMedia.createdAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                <div className="p-4 sm:p-6 bg-black/40 border-t border-white/5 flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="h-12 bg-accent text-accent-foreground rounded-xl font-bold" onClick={() => { setSharingAsset(selectedMedia); setIsShareOpen(true); }}><Share2 className="mr-2 h-4 w-4" /> Compartir</Button>
                    <Popover onOpenChange={(o) => !o && setLinkNavParentId(null)}>
                      <PopoverTrigger asChild><Button variant="outline" className="h-12 border-white/10 text-white rounded-xl font-bold bg-white/5"><PlusCircle className="mr-2 h-4 w-4 text-primary" /> Vincular</Button></PopoverTrigger>
                      <PopoverContent align="end" className="w-80 bg-card border-white/10 shadow-2xl p-4">
                        <AlbumBrowser allAlbums={albums} selectedMedia={selectedMedia} linkNavParentId={linkNavParentId} setLinkNavParentId={setLinkNavParentId} onSelect={async (aid) => { if(user) { await addMultipleToAlbum(aid, user.id, [selectedMedia.id]); toast({ title: "Vínculo Creado" }); } }} onRemove={async (aid) => { if(user) { await removeMultipleFromAlbum(aid, user.id, [selectedMedia.id]); toast({ title: "Vínculo Removido" }); } }} />
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

      <Dialog open={isShareOpen} onOpenChange={(o) => { if(!o) { setIsShareOpen(false); setShareUsername(''); } }}>
        <DialogContent className="bg-card border-white/10 rounded-[2.5rem] max-w-md p-8 shadow-2xl">
          <DialogHeader className="text-center space-y-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto border border-primary/20"><Share2 className="h-8 w-8 text-primary" /></div>
            <DialogTitle className="text-2xl font-bold text-white">Distribuir Elemento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Vinculación por Nodo</Label>
            <div className="flex gap-2">
              <Input placeholder="Nombre de usuario..." className="h-12 bg-white/5 border-white/10 rounded-xl text-white" value={shareUsername} onChange={(e) => setShareUsername(e.target.value)} />
              <Button onClick={handleShareByUsername} disabled={isSearchingUser || !shareUsername.trim()} className="h-12 px-4 rounded-xl bg-primary text-white">
                {isSearchingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-5 w-5" />}
              </Button>
            </div>
          </div>
          <DialogFooter className="mt-8">
            <Button variant="ghost" onClick={() => setIsShareOpen(false)} className="w-full text-white/40 hover:text-white">Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}