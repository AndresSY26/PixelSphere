"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  getMediaByUser, 
  restoreMedia, 
  restoreMultipleMedia, 
  deleteMedia, 
  deleteMultipleMedia,
  getStoredUser
} from '@/lib/storage';
import { Media, User } from '@/lib/types';
import { 
  Trash2, 
  RotateCcw, 
  X, 
  Search, 
  LayoutGrid, 
  List, 
  CalendarDays,
  ShieldAlert,
  Loader2,
  Inbox,
  AlertTriangle,
  History,
  Check,
  CheckCircle2,
  Trash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { cn, formatRelativeDate } from '@/lib/utils';

export default function TrashPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let currentUser: User | null = null;
      const sessionData = localStorage.getItem('ps_active_session');
      if (sessionData) {
        try {
          currentUser = JSON.parse(sessionData) as User;
        } catch (e) {
          currentUser = null;
        }
      }
      if (!currentUser) {
        currentUser = getStoredUser();
      }

      if (currentUser) {
        setUser(currentUser);
        const allMedia = await getMediaByUser(currentUser.id);
        setMedia(allMedia.filter(m => m.isDeleted === true));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredMedia = useMemo(() => {
    let result = media.filter(m => m.filename.toLowerCase().includes(searchQuery.toLowerCase()));
    result.sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
    return result;
  }, [media, searchQuery]);

  const handleRestore = async (id: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await restoreMedia(id, user.id);
      setMedia(prev => prev.filter(m => m.id !== id));
      toast({ title: "Activo Restaurado", description: "El archivo ha vuelto a su ubicación original." });
    } catch (e) {
      console.error("Error al restaurar medio de la papelera:", e);
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await deleteMedia(id, user.id);
      setMedia(prev => prev.filter(m => m.id !== id));
      toast({ title: "Purga Física Completada", description: "El activo ha sido eliminado permanentemente del disco." });
    } catch (e) {
      console.error("Error al purgar medio permanentemente:", e);
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkRestore = async () => {
    if (!user || selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      await restoreMultipleMedia(Array.from(selectedIds), user.id);
      setMedia(prev => prev.filter(m => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      toast({ title: "Restauración Masiva Exitosa" });
    } catch (e) {
      console.error("Error en restauración masiva de papelera:", e);
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (!user || selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      await deleteMultipleMedia(Array.from(selectedIds), user.id);
      setMedia(prev => prev.filter(m => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      toast({ title: "Purga Masiva Completada" });
    } catch (e) {
      console.error("Error en eliminación permanente masiva:", e);
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (!user || media.length === 0) return;
    setIsProcessing(true);
    try {
      const allIds = media.map(m => m.id);
      await deleteMultipleMedia(allIds, user.id);
      setMedia([]);
      setConfirmEmptyTrash(false);
      toast({ title: "Papelera Vaciada", description: "Toda la infraestructura de residuos ha sido purgada." });
    } catch (e) {
      console.error("Error al vaciar papelera:", e);
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setIsSelectionMode(false);
      return next;
    });
  };

  const getDaysRemaining = (deletedAt: string) => {
    const deletionDate = new Date(deletedAt);
    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const elapsed = now.getTime() - deletionDate.getTime();
    const remaining = Math.max(0, Math.ceil((thirtyDaysMs - elapsed) / (24 * 60 * 60 * 1000)));
    return remaining;
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-white font-headline flex items-center gap-3">
              <Trash2 className="h-10 w-10 text-primary" /> Papelera Neural
            </h1>
            <p className="text-muted-foreground max-w-xl">
              Zona de cuarentena. Los archivos se purgarán físicamente después de 30 días de inactividad.
            </p>
          </div>
          {media.length > 0 && (
            <Button 
              variant="outline" 
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-2xl h-12 px-6"
              onClick={() => setConfirmEmptyTrash(true)}
            >
              <Trash className="h-4 w-4 mr-2" /> Vaciar Papelera
            </Button>
          )}
        </header>

        <div className="flex flex-col sm:flex-row items-center gap-4 h-16 relative">
          {isSelectionMode ? (
            <div className="flex items-center justify-between w-full bg-primary/10 border border-primary/20 p-4 rounded-2xl animate-slide-up">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}>
                  <X className="h-5 w-5" />
                </Button>
                <span className="text-sm font-bold">{selectedIds.size} seleccionados</span>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl border-white/10 bg-white/5" 
                  onClick={handleBulkRestore}
                  disabled={isProcessing}
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Restaurar
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="rounded-xl" 
                  onClick={handleBulkPermanentDelete}
                  disabled={isProcessing}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Purgar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  placeholder="Buscar en la papelera..." 
                  className="pl-10 bg-white/5 border-white/10 rounded-full h-11 text-white" 
                />
              </div>
              <div className="flex border border-white/10 rounded-xl overflow-hidden bg-white/5">
                <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-10 w-10" onClick={() => setViewMode('grid')}>
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-10 w-10" onClick={() => setViewMode('list')}>
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-3xl bg-white/5" />)}
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center bg-white/[0.02] rounded-[3rem] border border-dashed border-white/10">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
              <Inbox className="h-12 w-12 text-muted-foreground opacity-20" />
            </div>
            <h3 className="text-xl font-bold text-white">Papelera Despejada</h3>
            <p className="text-muted-foreground text-sm mt-2">No hay activos en proceso de purga física.</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6" : "flex flex-col gap-3"}>
            {filteredMedia.map((item) => (
              <div 
                key={item.id} 
                className={cn(
                  "group relative transition-all duration-500",
                  viewMode === 'grid' ? "aspect-square rounded-[2rem] overflow-hidden bg-white/[0.02] border border-white/5" : "flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl",
                  selectedIds.has(item.id) && "ring-4 ring-primary border-primary"
                )}
              >
                {viewMode === 'grid' ? (
                  <>
                    <img 
                      src={item.thumbnailUrl || item.url} 
                      alt="" 
                      className={cn("w-full h-full object-cover opacity-40 grayscale group-hover:opacity-60 transition-all", item.isAdultContent && "blur-xl")} 
                    />
                    <div className="absolute top-4 left-4 z-20">
                      <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                        <History className="h-3 w-3 text-primary" />
                        <span className="text-[9px] font-black text-white uppercase">{getDaysRemaining(item.deletedAt!)} días</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 z-30 flex flex-col justify-end p-5 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity">
                      <p className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{item.filename}</p>
                      <div className="flex gap-2 mt-4">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="flex-1 h-9 rounded-xl bg-white text-black font-bold"
                          onClick={() => handleRestore(item.id)}
                          disabled={isProcessing}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-2" /> Restaurar
                        </Button>
                        <Button 
                          size="icon" 
                          variant="destructive" 
                          className="h-9 w-9 rounded-xl"
                          onClick={() => handlePermanentDelete(item.id)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setIsSelectionMode(true); toggleSelection(item.id); }}
                      className="absolute inset-0 z-10"
                    />
                    {isSelectionMode && (
                      <div className="absolute top-4 right-4 z-40">
                        <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center", selectedIds.has(item.id) ? "bg-primary border-primary" : "bg-black/40 border-white/40")}>
                          {selectedIds.has(item.id) && <Check className="h-4 w-4 text-white" />}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-black overflow-hidden relative border border-white/10 shrink-0">
                        <img src={item.thumbnailUrl || item.url} alt="" className="w-full h-full object-cover opacity-40 grayscale" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white truncate max-w-[200px]">{item.filename}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                          <History className="h-3 w-3" /> Expira en {getDaysRemaining(item.deletedAt!)} días
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => handleRestore(item.id)} disabled={isProcessing}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-400 hover:bg-red-500/10" onClick={() => handlePermanentDelete(item.id)} disabled={isProcessing}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {isSelectionMode && (
                        <div 
                          onClick={() => toggleSelection(item.id)}
                          className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center ml-4 cursor-pointer", selectedIds.has(item.id) ? "bg-primary border-primary" : "bg-white/5 border-white/20")}
                        >
                          {selectedIds.has(item.id) && <Check className="h-3 w-3 text-white" />}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Auditoría de Purga */}
        <Dialog open={confirmEmptyTrash} onOpenChange={setConfirmEmptyTrash}>
          <DialogContent className="max-w-md bg-[#0a0a0c] border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
            <DialogHeader className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto border border-red-500/20">
                <ShieldAlert className="h-8 w-8 text-red-400" />
              </div>
              <DialogTitle className="text-2xl font-bold text-white">¿Vaciar Papelera?</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Esta acción ejecutará una purga física inmediata de los {media.length} archivos seleccionados. Los activos no podrán ser recuperados por ningún protocolo de red.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button variant="ghost" onClick={() => setConfirmEmptyTrash(false)} className="flex-1 rounded-xl text-white">Cancelar</Button>
              <Button 
                variant="destructive"
                className="flex-[2] rounded-xl font-bold h-12"
                onClick={handleEmptyTrash}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Confirmar Purga Permanente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
