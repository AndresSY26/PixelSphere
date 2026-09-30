"use client";

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  getMedia, 
  deleteMedia, 
  deleteMultipleMedia, 
  updateMedia, 
  updateMultipleMedia,
  saveUser,
  encrypt,
  decrypt,
  getAlbumsByUser,
  addMultipleToAlbum,
  removeMultipleFromAlbum,
  findUserByUsername,
  recordInteraction,
  getFrequentContacts
} from '@/lib/storage';
import { Media, User, Album } from '@/lib/types';
import { 
  LockKeyhole, 
  ShieldCheck, 
  Unlock, 
  Trash2, 
  Search, 
  LayoutGrid, 
  List, 
  X, 
  Check, 
  AlertTriangle, 
  HardDrive,
  Download,
  FolderLock,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Fingerprint,
  Timer,
  ShieldAlert,
  Zap,
  Smartphone,
  Maximize2,
  Calendar,
  Layers,
  FolderTree,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Folder,
  Share2,
  UserPlus,
  UserCheck,
  Link as LinkIcon,
  Copy,
  Sparkles,
  MinusCircle,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import NeuralVideoPlayer from '@/components/neural-video-player';
import { useToast } from '@/hooks/use-toast';
import { cn, formatRelativeDate, base64ToArrayBuffer, formatBytes } from '@/lib/utils';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type VaultViewState = 'CHECKING' | 'SETUP' | 'LOCKED' | 'UNLOCKED';

export default function PrivateFolderPage() {
  const [viewState, setViewState] = useState<VaultViewState>('CHECKING');
  const [media, setMedia] = useState<Media[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [adultToConfirm, setAdultToConfirm] = useState<Media | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  
  // Selección por Arrastre
  const [isDragging, setIsDragging] = useState(false);
  const [dragSelectMode, setDragSelectMode] = useState(true);

  // Estados de contraseña
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Estados de Compartir
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [sharingAsset, setSharingAsset] = useState<Media | null>(null);
  const [shareUsername, setShareUsername] = useState('');
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [frequentContacts, setFrequentContacts] = useState<User[]>([]);

  // Estados de Exportación
  const [isExporting, setIsExporting] = useState(false);

  // Estados de Temporizador
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        
        if (!silent) {
          if (!currentUser.vaultPasswordHash) {
            setViewState('SETUP');
          } else {
            setViewState('LOCKED');
          }
        }

        const [allMedia, userAlbums, contacts] = await Promise.all([
          getMedia(),
          getAlbumsByUser(currentUser.id),
          getFrequentContacts(currentUser.id)
        ]);
        
        setMedia(allMedia.filter(m => m.userId === currentUser.id && m.isPrivate === true && !m.isDeleted));
        setAlbums(userAlbums);
        if (!silent) setFrequentContacts(contacts);
      }
    } catch (error) { 
      console.error(error); 
    } finally { 
      if (!silent) setLoading(false); 
    }
  }, []);

  useEffect(() => {
    fetchData();

    // SINCRONIZACIÓN EN TIEMPO REAL CON LA BÓVEDA
    const onNeuralUpdate = () => fetchData(true);
    window.addEventListener('neural-update', onNeuralUpdate);
    return () => window.removeEventListener('neural-update', onNeuralUpdate);
  }, [fetchData]);

  const allUniqueTags = useMemo(() => {
    const tags = new Set<string>();
    media.forEach(m => m.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [media]);

  // Función para reiniciar el temporizador
  const startAutoLockTimer = useCallback(() => {
    if (!user?.settings.vaultAutoLockEnabled) return;
    
    if (autoLockTimerRef.current) clearInterval(autoLockTimerRef.current);
    
    const duration = user.settings.vaultAutoLockTime || 60;
    setTimeLeft(duration);

    autoLockTimerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev !== null && prev > 0) return prev - 1;
        return 0;
      });
    }, 1000);
  }, [user]);

  // Manejar el bloqueo real basado en timeLeft
  useEffect(() => {
    if (timeLeft === 0 && viewState === 'UNLOCKED') {
      if (autoLockTimerRef.current) clearInterval(autoLockTimerRef.current);
      setViewState('LOCKED');
      setPasswordInput('');
      setTimeLeft(null);
      // Notificación diferida para evitar errores de renderizado
      setTimeout(() => {
        toast({ 
          title: "Bóveda Auto-Bloqueada", 
          description: "Protocolo de inactividad ejecutado por seguridad." 
        });
      }, 100);
    }
  }, [timeLeft, viewState, toast]);

  useEffect(() => {
    if (viewState === 'UNLOCKED') {
      startAutoLockTimer();
      const reset = () => startAutoLockTimer();
      window.addEventListener('mousemove', reset);
      window.addEventListener('keydown', reset);
      window.addEventListener('touchstart', reset);
      
      return () => {
        if (autoLockTimerRef.current) clearInterval(autoLockTimerRef.current);
        window.removeEventListener('mousemove', reset);
        window.removeEventListener('keydown', reset);
        window.removeEventListener('touchstart', reset);
      };
    }
  }, [viewState, startAutoLockTimer]);

  const handleSetupPassword = async () => {
    if (!passwordInput || !user) return;
    if (passwordInput !== confirmPasswordInput) {
      toast({ title: "Error de Validación", description: "Las contraseñas no coinciden.", variant: "destructive" });
      return;
    }
    if (passwordInput.length < 4) {
      toast({ title: "Contraseña Débil", description: "Define al menos 4 caracteres.", variant: "destructive" });
      return;
    }

    setIsAuthenticating(true);
    try {
      const encrypted = await encrypt(passwordInput);
      const updatedUser = { ...user, vaultPasswordHash: encrypted };
      await saveUser(updatedUser);
      localStorage.setItem('ps_active_session', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setViewState('UNLOCKED');
      toast({ title: "Carpeta Privada Inicializada", description: "Contraseña blindada correctamente." });
    } catch (e) {
      console.error("Error al inicializar contraseña de la bóveda:", e);
      toast({ title: "Falla de Sistema", variant: "destructive" });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleUnlock = async () => {
    if (!passwordInput || !user?.vaultPasswordHash) return;
    
    setIsAuthenticating(true);
    try {
      const decrypted = await decrypt(user.vaultPasswordHash);
      if (passwordInput === decrypted) {
        setViewState('UNLOCKED');
        toast({ title: "Acceso Autorizado", description: "Bóveda decodificada con éxito." });
      } else {
        toast({ title: "Acceso Denegado", description: "Contraseña incorrecta.", variant: "destructive" });
      }
    } catch (e) {
      console.error("Error al autenticar y desbloquear bóveda:", e);
      toast({ title: "Error de Autenticación", variant: "destructive" });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!user?.biometricEnabled || !user?.biometricCredentialId) {
      toast({ title: "Biometría Inactiva", description: "Activa el acceso biométrico en Configuración." });
      return;
    }
    
    setIsScanning(true);
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const options: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [{
          id: base64ToArrayBuffer(user.biometricCredentialId),
          type: "public-key",
        }],
        userVerification: "required",
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({ publicKey: options });
      
      if (assertion) {
        setViewState('UNLOCKED');
        toast({ title: "Identidad Neural Confirmada", description: "Acceso biométrico concedido." });
      }
    } catch (e) {
      console.error("Falla en desbloqueo biométrico:", e);
      toast({ title: "Falla de Reconocimiento", description: "No se pudo validar la identidad física.", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  const filteredMedia = useMemo(() => {
    let result = media.filter(m => m.filename.toLowerCase().includes(searchQuery.toLowerCase()));
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [media, searchQuery]);

  const stats = useMemo(() => {
    const totalSize = media.reduce((acc, curr) => acc + curr.size, 0);
    return { count: media.length, size: formatBytes(totalSize) };
  }, [media]);

  const toggleSelection = useCallback((id: string) => { 
    setSelectedIds(prev => { 
      const next = new Set(prev); 
      if (next.has(id)) next.delete(id); 
      else next.add(id); 
      if (next.size === 0) setIsSelectionMode(false); 
      return next; 
    }); 
  }, []);

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

  const handleUpdateMediaMeta = async (updates: Partial<Media>) => {
    if (!selectedMedia || !user) return;
    setIsUpdating(true);
    try { 
      const updated = await updateMedia(selectedMedia.id, user.id, updates); 
      if (updated) { 
        setSelectedMedia(updated as Media); 
      } 
    } catch (e) {
      console.error("Error al actualizar metadatos en bóveda:", e);
      toast({ title: "Error" });
    } finally { setIsUpdating(false); }
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
      await addMultipleToAlbum(albumId, user.id, [selectedMedia.id]); 
      const album = albums.find(a => a.id === albumId);
      toast({ title: "Vínculo Creado", description: `Añadido a ${album?.title}` }); 
    } catch (e) {
      console.error("Error al añadir medio a álbum en bóveda:", e);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleRemoveFromAlbum = async (albumId: string) => {
    if (!user || !selectedMedia) return;
    try {
      await removeMultipleFromAlbum(albumId, user.id, [selectedMedia.id]);
      const album = albums.find(a => a.id === albumId);
      toast({ title: "Vínculo Removido", description: `Retirado de ${album?.title}` });
    } catch (e) {
      console.error("Error al remover medio de álbum en bóveda:", e);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleRestore = async () => {
    if (!selectedMedia || !user) return;
    try {
      await updateMedia(selectedMedia.id, user.id, { isPrivate: false });
      toast({ title: "Restaurado", description: "El activo ha vuelto a la galería común." });
      setSelectedMedia(null);
    } catch (e) { 
      console.error("Error al restaurar medio de la bóveda:", e);
      toast({ title: "Error", variant: "destructive" }); 
    }
  };

  const handleDeleteToTrash = async () => {
    if (!selectedMedia || !user) return;
    try {
      await deleteMedia(selectedMedia.id, user.id);
      toast({ title: "Movido a Papelera", description: "Tienes 30 días para recuperarlo." });
      setSelectedMedia(null);
    } catch (e) {
      console.error("Error al enviar medio de bóveda a papelera:", e);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleBulkDownload = async () => {
    if (selectedIds.size === 0) return;
    setIsExporting(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = (await import('file-saver'));
      
      const zip = new JSZip();
      const selectedMediaItems = media.filter(m => selectedIds.has(m.id));
      
      const downloadPromises = selectedMediaItems.map(async (item) => {
        try {
          const response = await fetch(item.url);
          const blob = await response.blob();
          zip.file(item.filename || `${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`, blob);
        } catch (e) {
          console.error(`Falla al descargar ${item.filename}`, e);
        }
      });
      
      await Promise.all(downloadPromises);
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `PixelSphere_Vault_Export_${new Date().getTime()}.zip`);
      
      toast({ title: "Exportación de Bóveda Exitosa", description: "El paquete blindado ha sido generado." });
    } catch (error) {
      console.error("Error en exportación masiva de bóveda:", error);
      toast({ title: "Error de Exportación", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleItemPointerDown = (id: string, isSelected: boolean) => {
    if (!isSelectionMode) return;
    setIsDragging(true);
    setDragSelectMode(!isSelected);
    toggleSelection(id);
  };

  const handleItemPointerEnter = (id: string) => {
    if (!isDragging || !isSelectionMode) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (dragSelectMode) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleShareByUsername = async () => {
    if (!shareUsername.trim() || !user || !selectedMedia) return;
    setIsSearchingUser(true);
    try {
      const targetUser = await findUserByUsername(shareUsername.trim());
      if (!targetUser) { toast({ title: "No encontrado", variant: "destructive" }); setIsSearchingUser(false); return; }
      const currentShared = selectedMedia.sharedWith || [];
      const result = await updateMedia(selectedMedia.id, user.id, { sharedWith: [...currentShared, targetUser.id] });
      if (result) {
        setSelectedMedia(result as Media);
      }
      await recordInteraction(user.id, targetUser.id);
      toast({ title: "Vínculo de Red Creado" });
      setIsShareOpen(false); setShareUsername('');
    } catch (error) {
      console.error("Error al compartir medio de bóveda por nombre de usuario:", error);
      toast({ title: "Falla de Red", variant: "destructive" });
    } finally { setIsSearchingUser(false); }
  };

  const copyShareLink = () => {
    if (!selectedMedia) return;
    const link = `${window.location.origin}/p/${selectedMedia.id}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Enlace Copiado" });
  };

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

  if (viewState === 'CHECKING') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (viewState === 'SETUP') {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-20 space-y-8 animate-slide-up">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto border border-primary/20">
              <FolderLock className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold text-white font-headline">Blindar Carpeta</h1>
            <p className="text-muted-foreground text-sm">Define una contraseña secundaria para tus activos manuales. Se almacenará cifrada mediante AES-256.</p>
          </div>

          <Card className="bg-card/40 border-white/5 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Contraseña de Carpeta</Label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="h-14 pl-12 bg-white/5 border-white/10 rounded-2xl focus:ring-primary"
                    placeholder="Mínimo 4 caracteres"
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Confirmar Blindaje</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className="h-14 pl-12 bg-white/5 border-white/10 rounded-2xl focus:ring-primary"
                    placeholder="Repite la contraseña"
                  />
                </div>
              </div>

              <Button onClick={handleSetupPassword} disabled={isAuthenticating || !passwordInput} className="w-full h-14 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 text-lg">
                {isAuthenticating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                Inicializar Carpeta Privada
              </Button>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (viewState === 'LOCKED') {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-20 space-y-8 animate-slide-up">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center mx-auto border border-accent/20">
              <LockKeyhole className="h-10 w-10 text-accent" />
            </div>
            <h1 className="text-3xl font-extrabold text-white font-headline">Carpeta Blindada</h1>
            <p className="text-muted-foreground text-sm">Ingresa tu clave de decodificación física para autorizar el acceso a tus activos privados.</p>
          </div>

          <Card className="bg-card/40 border-white/5 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Clave de Acceso</Label>
                  {user?.biometricEnabled && (
                    <button onClick={handleBiometricUnlock} className="text-[10px] font-black text-primary uppercase hover:text-accent transition-colors flex items-center gap-1">
                      <Fingerprint className="h-3 w-3" /> Usar Biometría
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="h-14 pl-12 bg-white/5 border-white/10 rounded-2xl focus:ring-primary"
                    placeholder="Ingresa tu clave"
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button onClick={handleUnlock} disabled={isAuthenticating || !passwordInput} className="w-full h-14 bg-accent text-accent-foreground rounded-2xl font-black shadow-lg shadow-accent/20 text-lg uppercase tracking-widest">
                {isAuthenticating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Unlock className="h-5 w-5 mr-2" />}
                Decodificar Acceso
              </Button>
            </div>
          </Card>
        </div>

        <Dialog open={isScanning} onOpenChange={setIsScanning}>
          <DialogContent className="max-w-md bg-black/95 border-accent/30 rounded-[2.5rem] p-10 shadow-[0_0_50px_rgba(102,224,255,0.2)] backdrop-blur-2xl">
            <div className="flex flex-col items-center text-center space-y-8 relative">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-accent/10 border-2 border-accent/20 flex items-center justify-center relative overflow-hidden">
                  <Fingerprint className="h-16 w-16 text-accent" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/40 to-transparent h-1 w-full animate-scan-line shadow-[0_0_15px_#66E0FF]" />
                </div>
                <div className="absolute -inset-4 border border-accent/10 rounded-full animate-pulse" />
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-2xl font-bold text-white font-headline">Validación de Bóveda</DialogTitle>
                <DialogDescription className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em]">Accediendo a infraestructura blindada...</DialogDescription>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map(i => <div key={i} className="w-8 h-1 rounded-full bg-accent/20 overflow-hidden"><div className="h-full bg-accent animate-pulse" style={{ animationDelay: `${i*200}ms` }} /></div>)}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto select-none">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-extrabold tracking-tight text-white font-headline flex items-center gap-3">
                <FolderLock className="h-10 w-10 text-accent" /> Carpeta Privada
              </h1>
              {timeLeft !== null && timeLeft > 0 && (
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                  <Timer className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-mono text-white font-bold">{timeLeft}s</span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground max-xl">Entorno blindado. {user?.settings.vaultAutoLockEnabled ? `Auto-bloqueo activo en ${user.settings.vaultAutoLockTime}s.` : 'Auto-bloqueo desactivado.'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-white/5 border-white/5 p-4 rounded-2xl min-w-[140px]"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Archivos</p><p className="text-2xl font-bold text-white mt-1">{stats.count}</p></Card>
            <Card className="bg-white/5 border-white/5 p-4 rounded-2xl min-w-[140px]"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Peso</p><p className="text-2xl font-bold text-accent mt-1">{stats.size}</p></Card>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row items-center gap-4 h-16 relative">
          {isSelectionMode ? (
            <div className="flex items-center justify-between w-full bg-accent/10 border border-accent/20 p-4 rounded-2xl animate-slide-up">
              <div className="flex items-center gap-4"><Button variant="ghost" size="icon" className="text-white" onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}><X className="h-5 w-5" /></Button><span className="text-sm font-bold text-white">{selectedIds.size} seleccionados</span></div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl border-white/10 text-white bg-white/5" onClick={handleBulkDownload} disabled={isExporting}>{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button>
                <Button variant="outline" size="sm" className="rounded-xl border-white/10 text-white bg-white/5" onClick={async () => { await updateMultipleMedia(Array.from(selectedIds), user!.id, { isPrivate: false }); setSelectedIds(new Set()); setIsSelectionMode(false); }}><Unlock className="h-4 w-4" /> Restaurar</Button>
                <Button variant="destructive" size="sm" className="rounded-xl" onClick={async () => { await deleteMultipleMedia(Array.from(selectedIds), user!.id); setSelectedIds(new Set()); setIsSelectionMode(false); }}><Trash2 className="h-4 w-4" /> Borrar</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative flex-1 w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar en carpeta privada..." className="pl-10 bg-white/5 border-white/10 rounded-full h-11 text-white" /></div>
              <div className="flex border border-white/10 rounded-xl overflow-hidden bg-white/5"><Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-10 w-10" onClick={() => setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></Button><Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-10 w-10" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button></div>
            </>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {Array.from({ length: 10 }).map((_, i) => (<Skeleton key={i} className="aspect-square rounded-3xl bg-white/5" />))}
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center bg-white/[0.02] rounded-[3rem] border border-dashed border-white/10"><div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6"><ShieldCheck className="h-12 w-12 text-muted-foreground opacity-20" /></div><h3 className="text-xl font-bold text-white">Bóveda Vacía</h3><p className="text-muted-foreground text-sm mt-2">Mueve archivos aquí desde la galería para blindarlos.</p></div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6" : "flex flex-col gap-3"}>
            {filteredMedia.map((item, idx) => (
              <VaultItem 
                key={item.id} 
                item={item} 
                viewMode={viewMode} 
                index={idx} 
                isSelected={selectedIds.has(item.id)} 
                isSelectionMode={isSelectionMode} 
                onLongPress={() => { setIsSelectionMode(true); toggleSelection(item.id); }} 
                onPointerDown={() => handleItemPointerDown(item.id, selectedIds.has(item.id))}
                onPointerEnter={() => handleItemPointerEnter(item.id)}
                onClick={() => openViewer(item)} 
              />
            ))}
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
            <Button className="flex-1 bg-accent text-accent-foreground font-bold rounded-xl h-12" onClick={() => { setSelectedMedia(adultToConfirm); setAdultToConfirm(null); setTagInput(''); setTagSuggestions([]); }}>Confirmar Acceso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && setSelectedMedia(null)}>
        <DialogContent className="max-w-[100vw] lg:max-w-7xl p-0 overflow-hidden bg-black sm:rounded-[2.5rem] h-[100vh] sm:h-[90vh] lg:h-[85vh] border-none shadow-2xl">
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
                      <Badge className="bg-accent/20 text-accent border-none"><ShieldCheck className="h-3 w-3 mr-2" /> Estatus: Blindado</Badge>
                      {selectedMedia.isAdultContent && <Badge className="bg-accent/20 text-accent border-none"><ShieldAlert className="h-3 w-3 mr-2" /> Adulto</Badge>}
                      {selectedMedia.metadata?.cameraSource && <Badge variant="outline" className="bg-white/5 border-white/10 text-white/60 font-bold capitalize"><Smartphone className="h-3 w-3 mr-2" /> Cámara {selectedMedia.metadata.cameraSource}</Badge>}
                    </div>

                    <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent flex items-center gap-2"><HardDrive className="h-3 w-3" /> Info del Contenido</p>
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
                  <div className="flex gap-2 w-full"><Button asChild className="flex-1 h-12 bg-primary text-white rounded-xl font-bold"><a href={selectedMedia.url} download={selectedMedia.filename}><Download className="mr-2 h-4 w-4" /> Descargar</a></Button><Button variant="destructive" size="icon" className="h-12 w-12 rounded-xl" onClick={handleDeleteToTrash}><Trash2 className="h-6 w-6" /></Button></div>
                  <Button variant="outline" className="w-full h-10 rounded-xl border-white/10 text-white/60 text-[10px] uppercase font-black tracking-widest hover:text-white transition-all" onClick={handleRestore}><Unlock className="mr-2 h-3.5 w-3.5" /> Restaurar a Galería</Button>
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
            <DialogTitle className="text-2xl font-bold text-white">Distribuir en la Red</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs uppercase tracking-widest font-bold">Identifica un nodo o genera un enlace</DialogDescription>
          </DialogHeader>
          <div className="space-y-8">
            {frequentContacts.length > 0 && (
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-primary ml-1 flex items-center gap-2"><Sparkles className="h-3 w-3" /> Nodos Frecuentes</Label>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">{frequentContacts.map(contact => (<button key={contact.id} onClick={() => { setShareUsername(contact.username); }} className="flex flex-col items-center gap-2 group shrink-0"><div className="relative"><Avatar className="h-14 w-14 border-2 border-white/5 group-hover:border-primary transition-all shadow-lg"><AvatarImage src={contact.avatarUrl} className="object-cover" /><AvatarFallback className="bg-white/5 text-white font-bold">{contact.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>{shareUsername === contact.username && (<div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-1 shadow-lg animate-zoom-in"><Check className="h-3 w-3" /></div>)}</div><span className="text-[9px] font-bold text-muted-foreground group-hover:text-white truncate max-w-[60px]">{contact.username}</span></button>))}</div>
              </div>
            )}
            <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Vinculación Directa</Label><div className="flex gap-2"><div className="relative flex-1"><UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Nombre de usuario..." className="h-12 pl-12 bg-white/5 border-white/10 rounded-xl focus:ring-primary text-white text-sm" value={shareUsername} onChange={(e) => setShareUsername(e.target.value)} /></div><Button onClick={handleShareByUsername} disabled={isSearchingUser || !shareUsername.trim()} className="h-12 px-4 rounded-xl bg-primary text-white">{isSearchingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-5 w-5" />}</Button></div></div>
            <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Enlace de Red</Label><Button variant="outline" className="w-full h-14 border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-accent/50 rounded-2xl group flex justify-between px-6" onClick={copyShareLink}><div className="flex items-center gap-4"><div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:scale-110 transition-transform"><LinkIcon className="h-5 w-5" /></div><span className="font-bold text-white">Copiar Enlace</span></div><Copy className="h-4 w-4 text-muted-foreground" /></Button></div>
          </div>
          <DialogFooter className="mt-8"><Button variant="ghost" onClick={() => setIsShareOpen(false)} className="w-full text-white/40 hover:text-white">Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

const VaultItem = memo(({ item, viewMode, index, isSelected, isSelectionMode, onClick, onPointerDown, onPointerEnter, onLongPress }: any) => {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIsInView(true); observer.disconnect(); } }, { threshold: 0.01, rootMargin: '200px' });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const handleStart = () => { if (!isSelectionMode) timerRef.current = setTimeout(onLongPress, 600); };
  const handleEnd = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  if (viewMode === 'list') {
    return (
      <div 
        onClick={onClick} 
        onMouseDown={handleStart} 
        onMouseUp={handleEnd} 
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
        className={cn("flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all cursor-pointer touch-none", isSelected && "bg-accent/20 border-accent/50")}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-black border border-white/10 flex items-center justify-center relative overflow-hidden">
            {isInView && (
              <img 
                src={item.thumbnailUrl} 
                alt="" 
                onLoad={() => setIsLoaded(true)}
                className={cn("w-full h-full object-cover blur-sm opacity-40 transition-opacity", !isLoaded && "opacity-0")} 
              />
            )}
            <LockKeyhole className="absolute inset-0 m-auto h-4 w-4 text-accent" />
          </div>
          <div><p className="font-bold text-sm text-white truncate max-w-[250px]">{item.filename}</p><p className="text-[10px] text-muted-foreground font-bold">{formatRelativeDate(item.createdAt)}</p></div>
        </div>
        {isSelectionMode && <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center", isSelected ? "bg-accent border-accent" : "bg-black/40 border-white/40")}>{isSelected && <Check className="h-3 w-3 text-white" />}</div>}
      </div>
    );
  }

  return (
    <div 
      ref={cardRef} 
      onClick={onClick} 
      onMouseDown={handleStart} 
      onMouseUp={handleEnd} 
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      className={cn("group relative aspect-square rounded-[2rem] overflow-hidden bg-white/[0.02] border border-white/5 transition-all duration-500 cursor-pointer touch-none", isSelected ? "ring-4 ring-accent border-accent scale-95" : "hover:border-accent/50")}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10 flex items-center justify-center group-hover:opacity-0 transition-opacity"><LockKeyhole className="h-8 w-8 text-accent/60" /></div>
      {isInView && (
        <img 
          src={item.thumbnailUrl} 
          alt="" 
          onLoad={() => setIsLoaded(true)}
          className={cn("w-full h-full object-cover blur-2xl opacity-40 scale-110 transition-opacity", !isLoaded && "opacity-0")} 
        />
      )}
      {isSelectionMode && <div className="absolute top-4 left-4 z-30"><div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center", isSelected ? "bg-accent border-accent" : "bg-black/40 border-white/40")}>{isSelected && <Check className="h-4 w-4 text-black" />}</div></div>}
      <div className="absolute inset-0 z-30 flex flex-col justify-end p-5 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
        <p className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{item.filename}</p>
        <p className="text-[8px] font-bold text-white uppercase tracking-widest">{formatBytes(item.size)}</p>
      </div>
    </div>
  );
});

VaultItem.displayName = 'VaultItem';