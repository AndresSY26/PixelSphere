"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { getMedia, getUsers, recordMediaView } from '@/lib/storage';
import { Media, User, ViewHistoryEntry } from '@/lib/types';
import { 
  History, 
  Trash2, 
  Search, 
  CalendarDays, 
  Play, 
  ImageIcon, 
  X, 
  Loader2,
  Inbox,
  Clock,
  ExternalLink,
  ChevronRight,
  Monitor
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
  
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const sessionData = localStorage.getItem('ps_active_session');
      if (sessionData) {
        const currentUser = JSON.parse(sessionData) as User;
        const [users, media] = await Promise.all([getUsers(), getMedia()]);
        const dbUser = users.find(u => u.id === currentUser.id);
        
        setUser(dbUser || currentUser);
        setHistoryEntries(dbUser?.viewHistory || []);
        setAllMedia(media.filter(m => !m.isDeleted));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const historyWithMedia = useMemo(() => {
    return historyEntries.map(entry => {
      const media = allMedia.find(m => m.id === entry.mediaId);
      return media ? { ...entry, media } : null;
    }).filter((e): e is (ViewHistoryEntry & { media: Media }) => e !== null);
  }, [historyEntries, allMedia]);

  const filteredHistory = useMemo(() => {
    return historyWithMedia.filter(h => 
      h.media.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.media.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [historyWithMedia, searchQuery]);

  const groupedHistory = useMemo(() => {
    return filteredHistory.reduce((acc: { label: string, items: any[] }[], item) => {
      const label = formatRelativeDate(item.viewedAt);
      const existingGroup = acc.find(g => g.label === label);
      if (existingGroup) existingGroup.items.push(item);
      else acc.push({ label, items: [item] });
      return acc;
    }, []);
  }, [filteredHistory]);

  const openMedia = (media: Media) => {
    setSelectedMedia(media);
    if (user) recordMediaView(user.id, media.id);
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-10 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-white font-headline flex items-center gap-3">
              <History className="h-10 w-10 text-primary" /> Historial de Visualización
            </h1>
            <p className="text-muted-foreground">Tu rastro en la red PixelSphere. Lo que has visto, cuando lo has visto.</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Buscar en historial..." 
              className="pl-10 bg-white/5 border-white/10 rounded-full h-11 text-white" 
            />
          </div>
        </header>

        {loading ? (
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-6 w-32 bg-white/5 rounded-lg" />
                <div className="grid gap-3">
                  {Array.from({ length: 2 }).map((_, j) => <Skeleton key={j} className="h-20 w-full bg-white/5 rounded-2xl" />)}
                </div>
              </div>
            ))}
          </div>
        ) : historyEntries.length === 0 ? (
          <div className="py-32 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-[3rem] space-y-6">
            <div className="w-20 h-20 rounded-[2rem] bg-white/5 flex items-center justify-center mx-auto opacity-20">
              <Monitor className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Nexo sin Actividad</h3>
              <p className="text-muted-foreground max-w-xs mx-auto text-sm">Empieza a explorar tu galería para generar registros temporales.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {groupedHistory.map((group) => (
              <div key={group.label} className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                  <CalendarDays className="h-5 w-5 text-primary/60" />
                  <h2 className="text-lg font-bold text-white font-headline uppercase tracking-widest">{group.label}</h2>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
                <div className="grid gap-3">
                  {group.items.map((item) => (
                    <Card 
                      key={item.viewedAt} 
                      className="bg-card/40 border-white/5 hover:border-primary/30 transition-all rounded-2xl overflow-hidden group cursor-pointer"
                      onClick={() => openMedia(item.media)}
                    >
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-xl overflow-hidden relative bg-black/40 border border-white/5">
                            <Image 
                              src={item.media.thumbnailUrl} 
                              alt="" 
                              fill 
                              className={cn("object-cover opacity-60 group-hover:opacity-100 transition-all", item.media.isAdultContent && "blur-md")} 
                            />
                            {item.media.type === 'video' && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Play className="h-5 w-5 text-white fill-white drop-shadow-lg" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm group-hover:text-primary transition-colors">{item.media.filename}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {new Date(item.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <Badge variant="outline" className="text-[8px] uppercase border-white/10 opacity-60">{item.media.type}</Badge>
                              {user?.videoProgress?.[item.media.id] && item.media.type === 'video' && (
                                <Badge className="bg-accent/10 text-accent border-none text-[8px] uppercase">
                                  Progreso: {Math.floor(user.videoProgress[item.media.id] / 60)}:{(Math.floor(user.videoProgress[item.media.id] % 60)).toString().padStart(2, '0')}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-muted-foreground group-hover:text-primary transition-all rounded-xl">
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedMedia} onOpenChange={(o) => !o && setSelectedMedia(null)}>
        <DialogContent className="max-w-6xl p-0 bg-black border-none rounded-none sm:rounded-[2.5rem] overflow-hidden shadow-2xl h-[90vh]">
          {selectedMedia && (
            <div className="flex flex-col h-full">
              <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
                {selectedMedia.type === 'video' ? (
                  <NeuralVideoPlayer 
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
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-muted-foreground" onClick={() => setSelectedMedia(null)}><X className="h-6 w-6" /></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
