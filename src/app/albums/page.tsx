"use client";

import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  getAlbumsByUser, 
  getMediaByUser, 
  createAlbum, 
  deleteAlbum,
  updateAlbum,
  updateMedia,
  deleteMedia,
  unlockAchievement,
  getUsers,
  findUserByUsername,
  recordInteraction,
  getFrequentContacts,
  addMultipleToAlbum,
  removeMultipleFromAlbum,
  updateUserFilterPreferences
} from '@/lib/storage';
import { Album, Media, User } from '@/lib/types';
import { 
  FolderPlus, 
  Plus, 
  FolderHeart, 
  MoreVertical, 
  Trash2, 
  ChevronRight, 
  Clock, 
  ShieldCheck, 
  Globe,
  ImageIcon,
  Search,
  FolderOpen,
  Library,
  CheckCircle2,
  X,
  FileVideo,
  Lock,
  Play,
  Download,
  Tag,
  PlusCircle,
  Settings2,
  HardDrive,
  Maximize2,
  Check,
  FolderTree,
  ExternalLink,
  ChevronLeft,
  ArrowUpDown,
  AlertTriangle,
  Loader2,
  Layers,
  ShieldAlert,
  Share2,
  UserPlus,
  UserCheck,
  Link as LinkIcon,
  Copy,
  Sparkles,
  Inbox,
  Unlock,
  MinusCircle,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { cn, formatRelativeDate, formatBytes } from '@/lib/utils';
import NeuralVideoPlayer from '@/components/neural-video-player';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type AlbumSortType = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

const sortLabels: Record<AlbumSortType, string> = {
  'date-desc': 'Más recientes',
  'date-asc': 'Más antiguos',
  'name-asc': 'Nombre (A-Z)',
  'name-desc': 'Nombre (Z-A)',
};

export default function AlbumsPage() {
  const [allAlbums, setAllAlbums] = useState<Album[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [albumSortBy, setAlbumSortBy] = useState<AlbumSortType>('date-desc');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [currentAlbumId, setCurrentAlbumId] = useState<string | null>(null);

  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [adultToConfirm, setAdultToConfirm] = useState<Media | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  
  // Compartir Avanzado
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [sharingAsset, setSharingAsset] = useState<Album | Media | null>(null);
  const [shareUsername, setShareUsername] = useState('');
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [frequentContacts, setFrequentContacts] = useState<User[]>([]);

  // Selector de Multimedia para Album con Selección por Arrastre
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  const [selectorSearchQuery, setSelectorSearchQuery] = useState('');
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<Set<string>>(new Set());
  const [isAddingMedia, setIsAddingMedia] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragSelectMode, setDragSelectMode] = useState(true);

  // Navegador de Vínculo
  const [linkNavParentId, setLinkNavParentId] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const sessionData = localStorage.getItem('ps_active_session');
      if (sessionData) {
        const currentUser = JSON.parse(sessionData) as User;
        setUser(currentUser);
        
        if (!silent && currentUser.filterPreferences?.albums?.sortBy) {
          setAlbumSortBy(currentUser.filterPreferences.albums.sortBy as AlbumSortType);
        }

        const [userAlbums, userMedia] = await Promise.all([
          getAlbumsByUser(currentUser.id),
          getMediaByUser(currentUser.id)
        ]);
        setAllAlbums(userAlbums);
        setMedia(userMedia.filter(m => !m.isDeleted));
        
        if (!silent) {
          getFrequentContacts(currentUser.id).then(setFrequentContacts);
        }
      }
    } catch (error) {
      console.error("Falla en actualización de álbumes:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // SINCRONIZACIÓN NEURAL EN TIEMPO REAL
    const onNeuralUpdate = () => fetchData(true);
    window.addEventListener('neural-update', onNeuralUpdate);
    return () => window.removeEventListener('neural-update', onNeuralUpdate);
  }, [fetchData]);

  const allUniqueTags = useMemo(() => {
    const tags = new Set<string>();
    media.forEach(m => m.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [media]);

  // EFECTO: Persistir Filtros de Álbumes
  useEffect(() => {
    if (!user || loading) return;
    
    const persistAlbumFilters = async () => {
      const prefs = { sortBy: albumSortBy };
      const updatedUser = { ...user, filterPreferences: { ...user.filterPreferences, albums: prefs } };
      localStorage.setItem('ps_active_session', JSON.stringify(updatedUser));
      await updateUserFilterPreferences(user.id, 'albums', prefs);
    };

    const timer = setTimeout(persistAlbumFilters, 500);
    return () => clearTimeout(timer);
  }, [albumSortBy, user, loading]);

  useEffect(() => {
    const handleUp = () => setIsDragging(false);
    window.addEventListener('pointerup', handleUp);
    return () => window.removeEventListener('pointerup', handleUp);
  }, []);

  const currentAlbum = useMemo(() => {
    return allAlbums.find(a => a.id === currentAlbumId) || null;
  }, [allAlbums, currentAlbumId]);

  const handleCreateAlbum = async () => {
    if (!newAlbumTitle.trim() || !user) return;
    setIsCreating(true);
    try {
      const album: Album = {
        id: Math.random().toString(36).substring(2, 11),
        userId: user.id,
        parentId: currentAlbumId || undefined,
        title: newAlbumTitle.trim(),
        description: newAlbumDesc.trim(),
        mediaIds: [],
        isPublic: false,
        theme: 'compact',
        createdAt: new Date().toISOString()
      };
      await createAlbum(album);
      await unlockAchievement(user.id, 'album_creator');
      
      toast({ title: "Colección Creada", description: `"${album.title}" lista para ingesta.` });
      setIsCreateOpen(false);
      setNewAlbumTitle('');
      setNewAlbumDesc('');
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleBatchAddToAlbum = async () => {
    if (!user || !currentAlbumId || selectedGalleryIds.size === 0) return;
    setIsAddingMedia(true);
    try {
      await addMultipleToAlbum(currentAlbumId, user.id, Array.from(selectedGalleryIds));
      toast({ 
        title: "Activos Orquestados", 
        description: `${selectedGalleryIds.size} elementos añadidos a la colección.` 
      });
      setIsMediaSelectorOpen(false);
      setSelectedGalleryIds(new Set());
    } catch (error) {
      toast({ title: "Error de Vinculación", variant: "destructive" });
    } finally {
      setIsAddingMedia(false);
    }
  };

  const handleSingleAddToAlbum = async (albumId: string) => {
    if (!user || !selectedMedia) return;
    try { 
      await addMultipleToAlbum(albumId, user.id, [selectedMedia.id]); 
      const album = allAlbums.find(a => a.id === albumId);
      toast({ title: "Vínculo Creado", description: `Añadido a ${album?.title}` }); 
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleRemoveFromAlbum = async (albumId: string) => {
    if (!user || !selectedMedia) return;
    try {
      await removeMultipleFromAlbum(albumId, user.id, [selectedMedia.id]);
      const album = allAlbums.find(a => a.id === albumId);
      toast({ title: "Vínculo Removido", description: `Retirado de ${album?.title}` });
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleTogglePublic = async (albumId: string, isPublic: boolean) => {
    if (!user) return;
    try {
      await updateAlbum(albumId, user.id, { isPublic });
      if (isPublic) await unlockAchievement(user.id, 'portfolio_star');
      toast({ title: isPublic ? "Álbum Público" : "Álbum Privado" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDeleteAlbum = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const deletedIds = await deleteAlbum(id, user.id);
      if (currentAlbumId && deletedIds.includes(currentAlbumId)) setCurrentAlbumId(null);
      toast({ title: "Rama de Colecciones Purga", description: `${deletedIds.length} álbumes eliminados.` });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    }
  }, [user, currentAlbumId, toast]);

  const handleUpdateMediaMeta = async (updates: Partial<Media>) => {
    if (!selectedMedia || !user) return;
    setIsUpdating(true);
    try { 
      const updated = await updateMedia(selectedMedia.id, user.id, updates); 
      if (updated) setSelectedMedia(updated as Media); 
    } catch (e) { toast({ title: "Error" }); } finally { setIsUpdating(false); }
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

  const handleShareByUsername = async () => {
    if (!shareUsername.trim() || !user || !sharingAsset) return;

    setIsSearchingUser(true);
    try {
      const targetUser = await findUserByUsername(shareUsername.trim());
      if (!targetUser) {
        toast({ title: "No encontrado", description: "Verifica el nombre completo del usuario.", variant: "destructive" });
        setIsSearchingUser(false);
        return;
      }

      const currentShared = sharingAsset.sharedWith || [];
      if ('mediaIds' in sharingAsset) {
        await updateAlbum(sharingAsset.id, user.id, { sharedWith: [...currentShared, targetUser.id] });
      } else {
        const result = await updateMedia(sharingAsset.id, user.id, { sharedWith: [...currentShared, targetUser.id] });
        if (result && selectedMedia?.id === sharingAsset.id) setSelectedMedia(result as Media);
      }
      
      await recordInteraction(user.id, targetUser.id);
      toast({ title: "Elemento Compartido", description: `Acceso concedido a ${targetUser.username}.` });
      setIsShareOpen(false);
      setShareUsername('');
    } catch (error) {
      toast({ title: "Falla de Red", variant: "destructive" });
    } finally {
      setIsSearchingUser(false);
    }
  };

  const openViewer = useCallback((item: Media) => {
    if (item.isAdultContent) {
      setAdultToConfirm(item);
    } else {
      setSelectedMedia(item);
      setTagInput('');
      setTagSuggestions([]);
      setLinkNavParentId(null);
    }
  }, []);

  const filteredSubAlbums = useMemo(() => {
    let result = allAlbums.filter(a => a.parentId === (currentAlbumId || undefined));
    if (searchQuery) result = result.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()));
    
    result.sort((a, b) => {
      if (albumSortBy === 'date-desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (albumSortBy === 'date-asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (albumSortBy === 'name-asc') return a.title.localeCompare(b.title, undefined, { numeric: true });
      if (albumSortBy === 'name-desc') return b.title.localeCompare(a.title, undefined, { numeric: true });
      return 0;
    });
    return result;
  }, [allAlbums, searchQuery, currentAlbumId, albumSortBy]);

  const albumMedia = useMemo(() => {
    if (!currentAlbum) return [];
    return media.filter(m => currentAlbum.mediaIds.includes(m.id) && !m.isPrivate && !m.isDeleted);
  }, [currentAlbum, media]);

  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    let tempId = currentAlbumId;
    while (tempId) {
      const album = allAlbums.find(a => a.id === tempId);
      if (album) {
        crumbs.unshift(album);
        tempId = album.parentId || null;
      } else tempId = null;
    }
    return crumbs;
  }, [allAlbums, currentAlbumId]);

  const getAlbumMediaRecursive = useCallback((albumId: string): Media[] => {
    const uniqueMedia = new Map<string, Media>();
    const crawl = (startId: string) => {
      const album = allAlbums.find(a => a.id === startId);
      if (!album) return;
      (album.mediaIds || []).forEach(mId => {
        const found = media.find(m => m.id === mId && !m.isPrivate && !m.isDeleted);
        if (found) uniqueMedia.set(found.id, found);
      });
      allAlbums.filter(a => a.parentId === startId).forEach(child => crawl(child.id));
    };
    crawl(albumId);
    return Array.from(uniqueMedia.values());
  }, [allAlbums, media]);

  const getFullAlbumPath = useCallback((albumId: string) => {
    const path: string[] = [];
    let cur: string | undefined = albumId;
    while (cur) {
      const a = allAlbums.find(al => al.id === cur);
      if (a) { path.unshift(a.title); cur = a.parentId; }
      else cur = undefined;
    }
    return path.join(' / ');
  }, [allAlbums]);

  const toggleGallerySelection = (id: string) => {
    setSelectedGalleryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePointerDown = (id: string, isSelected: boolean) => {
    setIsDragging(true);
    setDragSelectMode(!isSelected);
    toggleGallerySelection(id);
  };

  const handlePointerEnter = (id: string) => {
    if (!isDragging) return;
    setSelectedGalleryIds(prev => {
      const next = new Set(prev);
      if (dragSelectMode) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Filtrado para el selector de multimedia
  const filteredSelectorMedia = useMemo(() => {
    return media.filter(m => 
      !m.isPrivate && 
      (m.filename.toLowerCase().includes(selectorSearchQuery.toLowerCase()) || 
       m.tags?.some(t => t.toLowerCase().includes(selectorSearchQuery.toLowerCase())))
    );
  }, [media, selectorSearchQuery]);

  const AlbumBrowser = ({ onSelect, onRemove }: { onSelect: (id: string) => void, onRemove: (id: string) => void }) => {
    const currentList = useMemo(() => allAlbums.filter(a => a.parentId === (linkNavParentId || undefined)), [linkNavParentId, allAlbums]);
    const parentAlbum = useMemo(() => allAlbums.find(a => a.id === linkNavParentId), [linkNavParentId, allAlbums]);
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
                    <FolderOpen className={cn("h-5 w-5 mr-3 shrink-0 group-hover:scale-110 transition-transform", hasMedia ? "text-primary" : "text-accent/60")} />
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
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-white font-headline">
              {currentAlbum ? currentAlbum.title : "Tus Colecciones"}
            </h1>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <Button variant="ghost" size="sm" onClick={() => setCurrentAlbumId(null)} className={cn("h-7 px-2 text-xs rounded-full", !currentAlbumId ? "bg-primary/20 text-primary" : "text-muted-foreground")}>Raíz</Button>
              {breadcrumbs.map((crumb) => (
                <div key={crumb.id} className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <Button variant="ghost" size="sm" onClick={() => setCurrentAlbumId(crumb.id)} className={cn("h-7 px-2 text-xs rounded-full", crumb.id === currentAlbumId ? "bg-primary/20 text-primary" : "text-muted-foreground")}>{crumb.title}</Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            {currentAlbumId && (
              <Button onClick={() => setIsMediaSelectorOpen(true)} variant="outline" className="border-accent/30 text-accent hover:bg-accent/10 rounded-xl h-12 px-6">
                <PlusCircle className="mr-2 h-5 w-5" /> Añadir Activos
              </Button>
            )}
            <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90 text-white rounded-xl h-12 px-6 shadow-lg shadow-primary/20">
              <FolderPlus className="mr-2 h-5 w-5" /> Nuevo Álbum
            </Button>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar en este nivel..." className="pl-10 bg-white/5 border-white/10 rounded-full h-11" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-white/10 rounded-full h-11 px-4 bg-white/5 text-white">
                <ArrowUpDown className="mr-2 h-4 w-4 text-primary" />
                Orden: <span className="text-primary ml-1">{sortLabels[albumSortBy]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-white/10">
              <DropdownMenuRadioGroup value={albumSortBy} onValueChange={(v) => setAlbumSortBy(v as any)}>
                <DropdownMenuRadioItem value="date-desc">Recientes</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="date-asc">Antiguos</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name-asc">Nombre (A-Z)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name-desc">Nombre (Z-A)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-12">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-3xl bg-white/5" />)}
            </div>
          ) : (filteredSubAlbums.length === 0 && albumMedia.length === 0) ? (
            <div className="py-32 text-center space-y-8 bg-white/[0.02] border border-dashed border-white/10 rounded-[3.5rem] animate-slide-up">
              <div className="w-24 h-24 rounded-[3rem] bg-white/5 flex items-center justify-center mx-auto border border-white/10">
                <Inbox className="h-12 w-12 text-muted-foreground/20" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-white">Colección Despejada</h3>
                <p className="text-muted-foreground max-sm mx-auto text-sm">Esta ubicación de tu infraestructura física no contiene activos ni sub-nodos por el momento.</p>
                {currentAlbumId && (
                  <div className="pt-4">
                    <Button onClick={() => setIsMediaSelectorOpen(true)} className="bg-accent text-accent-foreground font-bold rounded-2xl h-14 px-8">
                      Poblar con Activos de Galería
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {filteredSubAlbums.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredSubAlbums.map((album) => {
                    const recursiveMedia = getAlbumMediaRecursive(album.id);
                    const coverMedia = recursiveMedia.length > 0 ? recursiveMedia[0] : null;

                    return (
                      <Card key={album.id} className="bg-card/50 border-white/5 group hover:border-primary/50 transition-all overflow-hidden rounded-3xl relative">
                        <div className="relative aspect-square overflow-hidden bg-black/40 cursor-pointer" onClick={() => setCurrentAlbumId(album.id)}>
                          {coverMedia ? (
                            <div className="absolute inset-0">
                                <Image 
                                  src={coverMedia.thumbnailUrl} 
                                  alt={album.title} 
                                  fill 
                                  className={cn("object-cover transition-transform duration-700 group-hover:scale-110", coverMedia.isAdultContent && "blur-2xl opacity-40")} 
                                />
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
                              <FolderOpen className="h-16 w-16" />
                            </div>
                          )}
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                          
                          <div className="absolute bottom-4 left-4 right-4 z-10">
                            <h3 className="text-xl font-bold text-white truncate drop-shadow-lg">{album.title}</h3>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              <p className="text-[10px] text-white/80 uppercase font-bold tracking-widest flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md">
                                <ImageIcon className="h-3 w-3 text-accent" /> {recursiveMedia.length} Activos
                              </p>
                              {(album.sharedWith?.length || 0) > 0 && (
                                <p className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-1 bg-primary/10 backdrop-blur-md px-2 py-1 rounded-md">
                                  <Share2 className="h-3 w-3" /> {album.sharedWith?.length}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="absolute top-4 right-4 z-10 flex gap-2">
                            {album.isPublic && <Badge className="bg-primary/80 backdrop-blur-md border-none"><Globe className="h-3 w-3 mr-1" /> Público</Badge>}
                            {coverMedia?.isAdultContent && <Badge className="bg-accent/80 backdrop-blur-md border-none"><ShieldAlert className="h-3 w-3 mr-1" /> Sensible</Badge>}
                          </div>
                        </div>
                        <CardContent className="p-4 flex justify-between items-center bg-card/80 backdrop-blur-xl border-t border-white/5 relative z-20">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{formatRelativeDate(album.createdAt)}</span>
                          <div className="flex items-center gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 rounded-xl"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent className="bg-card/95 backdrop-blur-2xl border-white/10 shadow-2xl">
                                <DropdownMenuItem onClick={() => setCurrentAlbumId(album.id)}>Abrir Colección</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSharingAsset(album); setIsShareOpen(true); }}>
                                  <Share2 className="h-4 w-4 mr-2" /> Distribuir en Red
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleTogglePublic(album.id, !album.isPublic)}>
                                  {album.isPublic ? <><Lock className="h-4 w-4 mr-2" /> Privar</> : <><Globe className="h-4 w-4 mr-2" /> Hacer Público</>}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/5" />
                                <DropdownMenuItem className="text-red-400" onClick={() => handleDeleteAlbum(album.id)}>Eliminar</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {albumMedia.length > 0 && (
                <div className="space-y-6">
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-accent" /> Activos Orquestados
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {albumMedia.map((item, idx) => (
                      <MediaCardItem key={item.id} item={item} index={idx} onClick={openViewer} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Protocolo de Confirmación para Contenido Adulto */}
      <Dialog open={!!adultToConfirm} onOpenChange={(open) => !open && setAdultToConfirm(null)}>
        <DialogContent className="max-w-md bg-card border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
          <DialogHeader className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto border border-accent/20">
              <ShieldAlert className="h-8 w-8 text-accent" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white">Contenido Sensible</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Este activo ha sido clasificado como contenido para adultos. ¿Deseas proceder con la visualización?
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

      {/* Selector de Multimedia desde Galería con Soporte de Arrastre y Búsqueda */}
      <Dialog open={isMediaSelectorOpen} onOpenChange={(o) => { setIsMediaSelectorOpen(o); if(!o) setSelectorSearchQuery(''); }}>
        <DialogContent className="max-w-4xl bg-[#0a0a0c] border-white/10 rounded-[2.5rem] shadow-2xl p-0 overflow-hidden select-none">
          <div className="p-8 border-b border-white/5 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                <Library className="h-6 w-6 text-accent" /> Inventario de Activos
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-[10px] uppercase font-black tracking-[0.2em]">Selecciona elementos para vincular</DialogDescription>
            </div>
            
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                value={selectorSearchQuery} 
                onChange={(e) => setSelectorSearchQuery(e.target.value)} 
                placeholder="Filtrar por nombre o nexo..." 
                className="pl-10 bg-white/5 border-white/10 rounded-full h-10 text-xs text-white" 
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-white">{selectedGalleryIds.size} Seleccionados</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Protocolo de Vínculo</p>
              </div>
              <Button onClick={handleBatchAddToAlbum} disabled={isAddingMedia || selectedGalleryIds.size === 0} className="bg-primary text-white rounded-xl h-12 px-6 font-bold">
                {isAddingMedia ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Vincular
              </Button>
            </div>
          </div>
          
          <ScrollArea className="h-[500px] p-8">
            {filteredSelectorMedia.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
                <HardDrive className="h-12 w-12 mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest">Sin coincidencias en infraestructura</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {filteredSelectorMedia.map((item) => {
                  const isSelected = selectedGalleryIds.has(item.id);
                  const alreadyInAlbum = currentAlbum?.mediaIds.includes(item.id);

                  return (
                    <div 
                      key={item.id} 
                      onPointerDown={() => !alreadyInAlbum && handlePointerDown(item.id, isSelected)}
                      onPointerEnter={() => !alreadyInAlbum && handlePointerEnter(item.id)}
                      className={cn(
                        "group relative aspect-square rounded-3xl overflow-hidden bg-white/5 border transition-all duration-500 touch-none",
                        alreadyInAlbum ? "opacity-40 cursor-not-allowed border-white/5 grayscale" : "cursor-pointer border-white/5 hover:border-primary",
                        isSelected && "ring-4 ring-primary border-primary scale-95"
                      )}
                    >
                      <Image 
                        src={item.thumbnailUrl} 
                        alt="" 
                        fill 
                        className={cn("object-cover", item.isAdultContent && "blur-xl")} 
                      />
                      {isSelected && (
                        <div className="absolute top-3 right-3 bg-primary text-white rounded-full p-1.5 shadow-lg animate-zoom-in z-20">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                      {alreadyInAlbum && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                          <CheckCircle2 className="h-8 w-8 text-white/60" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                        <p className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{item.filename}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          
          <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end">
            <Button variant="ghost" onClick={() => setIsMediaSelectorOpen(false)} className="rounded-xl text-white">Cerrar Explorador</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visor de Medios Profesional (Consistente con Galería) */}
      <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && setSelectedMedia(null)}>
        <DialogContent className="max-w-[100vw] lg:max-w-7xl p-0 overflow-hidden bg-black sm:rounded-[2.5rem] shadow-2xl h-[100vh] sm:h-[90vh] lg:h-[85vh] border-none">
          {selectedMedia && (
            <div className="flex flex-col lg:flex-row h-full overflow-hidden">
              <div className="relative h-[50vh] sm:h-[60vh] lg:h-full lg:flex-1 bg-black flex items-center justify-center overflow-hidden shrink-0">
                <Button variant="ghost" size="icon" className="absolute top-4 left-4 z-50 rounded-full bg-black/40 text-white lg:hidden" onClick={() => setSelectedMedia(null)}><X className="h-6 w-6" /></Button>
                {selectedMedia.type === 'video' ? <NeuralVideoPlayer src={selectedMedia.url} className="w-full h-full" /> : <img src={selectedMedia.url} className="w-full h-full object-contain" alt="" />}
              </div>
              <div className="flex-1 lg:w-[400px] bg-card border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col overflow-hidden rounded-t-[2.5rem] lg:rounded-none">
                <ScrollArea className="flex-1">
                  <div className="p-6 sm:p-8 space-y-8">
                    <DialogTitle className="text-2xl font-extrabold text-white tracking-tight">{selectedMedia.filename}</DialogTitle>
                    <div className="flex flex-wrap gap-2">
                      {selectedMedia.isAdultContent && <Badge className="bg-accent/20 text-accent border-none"><ShieldAlert className="h-3 w-3 mr-2" /> Adulto</Badge>}
                      {(selectedMedia.sharedWith?.length || 0) > 0 && <Badge className="bg-primary/20 text-primary border-none font-bold">Compartido ({selectedMedia.sharedWith?.length})</Badge>}
                      {selectedMedia.metadata?.cameraSource && <Badge variant="outline" className="bg-white/5 border-white/10 text-white/60 capitalize font-bold"><Smartphone className="h-3 w-3 mr-2" /> Cámara {selectedMedia.metadata.cameraSource}</Badge>}
                    </div>

                    <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent flex items-center gap-2"><HardDrive className="h-3 w-3" /> Info del Contenido</p>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs items-center"><span className="text-muted-foreground uppercase flex items-center gap-2"><Maximize2 className="h-3 w-3" /> Dimensiones</span><span className="text-white font-mono">{selectedMedia.width} x {selectedMedia.height}</span></div>
                        <div className="flex justify-between text-xs items-center"><span className="text-muted-foreground uppercase flex items-center gap-2"><HardDrive className="h-3 w-3" /> Peso Físico</span><span className="text-white font-mono">{formatBytes(selectedMedia.size)}</span></div>
                        <div className="flex justify-between text-xs items-center"><span className="text-muted-foreground uppercase flex items-center gap-2"><Calendar className="h-3 w-3" /> Ingesta</span><span className="text-white font-mono">{new Date(selectedMedia.createdAt).toLocaleDateString()}</span></div>
                        <div className="flex justify-between text-xs items-center"><span className="text-muted-foreground uppercase flex items-center gap-2"><Layers className="h-3 w-3" /> Formato</span><span className="text-white font-mono uppercase">{selectedMedia.mimeType.split('/')[1]}</span></div>
                      </div>
                    </div>

                    <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2"><FolderTree className="h-3 w-3" /> Estado de Orquestación</p>
                      <div className="space-y-2">
                        {allAlbums.filter(a => a.mediaIds.includes(selectedMedia.id)).length > 0 ? (
                          allAlbums.filter(a => a.mediaIds.includes(selectedMedia.id)).map(a => (
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
                          <Badge key={tag} className="bg-white/5 text-white border-white/5 px-3 py-1 rounded-full text-xs transition-all hover:bg-white/10">{tag} <X className="h-3 w-3 ml-2 cursor-pointer opacity-40 hover:opacity-100" onClick={() => handleUpdateMediaMeta({ tags: selectedMedia.tags.filter(t => t !== tag) })} /></Badge>
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
                    <Button className="h-12 bg-accent text-accent-foreground rounded-xl font-bold" onClick={() => { setSharingAsset(selectedMedia); setIsShareOpen(true); }}><Share2 className="mr-2 h-4 w-4" /> Compartir</Button>
                    
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
                  <div className="flex gap-2 w-full"><Button asChild className="flex-1 h-12 bg-primary text-white rounded-xl font-bold"><a href={selectedMedia.url} download={selectedMedia.filename}><Download className="mr-2 h-4 w-4" /> Descargar</a></Button><Button variant="outline" className="h-12 w-12 rounded-xl border-white/10 text-red-400" onClick={async () => {
                      if (!user || !currentAlbumId) return;
                      const updatedIds = currentAlbum!.mediaIds.filter(id => id !== selectedMedia.id);
                      await updateAlbum(currentAlbumId, user.id, { mediaIds: updatedIds });
                      setSelectedMedia(null);
                      toast({ title: "Vínculo Removido", description: "El activo ha sido retirado del álbum." });
                    }}><MinusCircle className="h-5 w-5" /></Button></div>
                    <Button variant="outline" className="w-full h-10 rounded-xl border-white/10 text-red-400 text-[10px] uppercase font-black tracking-widest hover:bg-red-500/10 transition-all" onClick={async () => {
                      if (!user) return;
                      await deleteMedia(selectedMedia.id, user.id);
                      setSelectedMedia(null);
                      toast({ title: "Movido a Papelera", description: "Tienes 30 días para recuperarlo." });
                    }}><Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar Activo</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Compartir */}
      <Dialog open={isShareOpen} onOpenChange={(o) => { if(!o) { setIsShareOpen(false); setShareUsername(''); } }}>
        <DialogContent className="bg-card border-white/10 rounded-[2.5rem] max-w-md p-8 shadow-2xl">
          <DialogHeader className="text-center space-y-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto border border-primary/20"><Share2 className="h-8 w-8 text-primary" /></div>
            <DialogTitle className="text-2xl font-bold text-white">Distribuir Elemento</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs uppercase tracking-widest font-bold">Protocolo de acceso externo</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-8">
            {frequentContacts.length > 0 && (
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-primary ml-1 flex items-center gap-2">
                  <Sparkles className="h-3 w-3" /> Sugerencias del Sistema
                </Label>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {frequentContacts.map(contact => (
                    <button 
                      key={contact.id} 
                      onClick={() => { setShareUsername(contact.username); }}
                      className="flex flex-col items-center gap-2 group shrink-0"
                    >
                      <div className="relative">
                        <Avatar className="h-14 w-14 border-2 border-white/5 group-hover:border-primary transition-all">
                          <AvatarImage src={contact.avatarUrl} className="object-cover" />
                          <AvatarFallback className="bg-white/5 text-white font-bold">{contact.username.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {shareUsername === contact.username && (
                          <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-1 shadow-lg animate-zoom-in">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-muted-foreground group-hover:text-white truncate max-w-[60px]">{contact.username}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Vinculación por Nodo</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Nombre de usuario completo" 
                    className="h-12 pl-12 bg-white/5 border-white/10 rounded-xl focus:ring-primary text-white text-sm"
                    value={shareUsername}
                    onChange={(e) => setShareUsername(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleShareByUsername} 
                  disabled={isSearchingUser || !shareUsername.trim()}
                  className="h-12 px-4 rounded-xl bg-primary text-white"
                >
                  {isSearchingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Enlace de Auto-Detección</Label>
              <Button 
                variant="outline" 
                className="w-full h-14 border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-accent/50 rounded-2xl group flex justify-between px-6"
                onClick={() => {
                  if (sharingAsset) {
                    const link = `${window.location.origin}/p/${sharingAsset.id}`;
                    navigator.clipboard.writeText(link);
                    toast({ title: "Enlace de Red Copiado" });
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:scale-110 transition-transform"><LinkIcon className="h-5 w-5" /></div>
                  <span className="font-bold text-white">Generar Enlace de Red</span>
                </div>
                <Copy className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
          
          <DialogFooter className="mt-8">
            <Button variant="ghost" onClick={() => setIsShareOpen(false)} className="w-full text-white/40 hover:text-white">Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-white/10 rounded-3xl">
          <DialogHeader><DialogTitle className="text-white">Nueva Colección</DialogTitle><DialogDescription>Crea un contenedor para tus activos multimedia.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4"><div className="space-y-2"><Label htmlFor="title" className="text-white">Título</Label><Input id="title" value={newAlbumTitle} onChange={(e) => setNewAlbumTitle(e.target.value)} placeholder="Ej. Viaje a la Playa" className="bg-white/5 border-white/10 text-white" /></div><div className="space-y-2"><Label htmlFor="desc" className="text-white">Descripción (Opcional)</Label><Input id="desc" value={newAlbumDesc} onChange={(e) => setNewAlbumDesc(e.target.value)} placeholder="Detalles de la colección..." className="bg-white/5 border-white/10 text-white" /></div></div>
          <DialogFooter><Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-white">Cancelar</Button><Button onClick={handleCreateAlbum} disabled={isCreating} className="bg-primary text-white">{isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Álbum"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

const MediaCardItem = memo(({ item, index, onClick }: { item: Media, index: number, onClick: (item: Media) => void }) => {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsInView(true); observer.disconnect(); }
    }, { threshold: 0.01, rootMargin: '200px' });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={cardRef}
      onClick={() => onClick(item)}
      className="group relative aspect-square rounded-[2rem] overflow-hidden bg-white/[0.02] border border-white/5 hover:border-primary/50 transition-all cursor-pointer"
    >
      {!isLoaded && <div className="absolute inset-0 bg-white/[0.03] animate-pulse" />}
      {isInView && (
        <div className="w-full h-full relative">
          <img 
            src={item.thumbnailUrl} 
            alt={item.filename}
            onLoad={() => setIsLoaded(true)}
            className={cn(
              "w-full h-full object-cover transition-all duration-700 group-hover:scale-110", 
              !isLoaded && "opacity-0",
              item.isAdultContent && "blur-2xl opacity-40 scale-125"
            )} 
          />
          {item.type === 'video' && (
            <div className="absolute top-3 right-3 z-10 p-1.5 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
              <Play className="h-3 w-3 text-white fill-white" />
            </div>
          )}
        </div>
      )}
      <div className="absolute inset-0 z-30 transition-opacity duration-300 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
        <p className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{item.filename}</p>
        <div className="flex items-center gap-2 opacity-80">
          <span className="text-[8px] font-bold text-white">{formatBytes(item.size)}</span>
          {item.type === 'video' && <Badge className="h-3 px-1 text-[6px] bg-primary/20 text-primary border-none">VIDEO</Badge>}
        </div>
      </div>
    </div>
  );
});

MediaCardItem.displayName = 'MediaCardItem';