"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { getUnifiedDashboardData, unlockAchievement } from '@/lib/storage';
import { Media, Album, User } from '@/lib/types';
import { 
  HardDrive, 
  ImageIcon, 
  Film, 
  ShieldCheck, 
  Clock,
  Lock,
  Play,
  ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn, formatRelativeDate, formatBytes } from '@/lib/utils';

export default function DashboardPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (silent = false) => {
    const sessionData = localStorage.getItem('ps_active_session');
    if (sessionData) {
      const user = JSON.parse(sessionData) as User;
      try {
        if (!silent) setLoading(true);
        const { media: userMedia, achievements: userAchievements, albums: userAlbums } = 
          await getUnifiedDashboardData(user.id);
        
        const activeMedia = userMedia.filter(m => !m.isDeleted);
        setMedia(activeMedia);
        setAchievements(userAchievements);
        
        // Sincronización proactiva de logros
        if (!silent) {
          const syncPromises = [];
          if (activeMedia.length > 0) syncPromises.push(unlockAchievement(user.id, 'first_upload'));
          if (activeMedia.length >= 10) syncPromises.push(unlockAchievement(user.id, 'ten_uploads'));
          if (activeMedia.some(m => m.isPrivate)) syncPromises.push(unlockAchievement(user.id, 'vault_secure'));
          if (userAlbums.length > 0) syncPromises.push(unlockAchievement(user.id, 'album_creator'));
          if (userAlbums.some(a => a.isPublic)) syncPromises.push(unlockAchievement(user.id, 'portfolio_star'));
          if (userAlbums.length >= 10) syncPromises.push(unlockAchievement(user.id, 'collection_master'));
          if (syncPromises.length > 0) await Promise.all(syncPromises);
        }
      } catch (error) {
        console.error("Falla en actualización de dashboard:", error);
      } finally {
        if (!silent) setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();

    // ESCUCHAR EVENTOS NEURALES PARA ACTUALIZACIÓN EN TIEMPO REAL
    const onNeuralUpdate = () => fetchData(true);
    window.addEventListener('neural-update', onNeuralUpdate);
    return () => window.removeEventListener('neural-update', onNeuralUpdate);
  }, [fetchData]);

  const stats = useMemo(() => {
    const totalSizeBytes = media.reduce((acc, curr) => acc + (curr.size || 0), 0);
    const quotaGB = 26;
    const usedPercentage = Math.min(Math.round((totalSizeBytes / (quotaGB * 1024 * 1024 * 1024)) * 100), 100);

    return [
      { label: 'Espacio Usado', value: formatBytes(totalSizeBytes), total: `${quotaGB} GB`, progress: usedPercentage, icon: HardDrive, color: 'text-primary' },
      { label: 'Fotos', value: media.filter(m => m.type === 'image').length.toString(), icon: ImageIcon, color: 'text-accent' },
      { label: 'Videos', value: media.filter(m => m.type === 'video').length.toString(), icon: Film, color: 'text-primary' },
      { label: 'Privados', value: media.filter(m => m.isPrivate).length.toString(), icon: ShieldCheck, color: 'text-accent' },
    ];
  }, [media]);

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white font-headline">Resumen Neural</h1>
            <p className="text-muted-foreground mt-1">Monitorea tu almacenamiento físico de imágenes y videos.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <Card key={stat.label} className={`bg-card/50 border-white/5 overflow-hidden group hover:border-primary/50 transition-all`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2.5 rounded-xl bg-white/5 ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{stat.value}</h3>
                </div>
                {stat.total && (
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      <span>{stat.value} / {stat.total}</span>
                      <span>{stat.progress}%</span>
                    </div>
                    <Progress value={stat.progress} className="h-1 bg-white/5" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-white">Ingestas Recientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 w-full bg-white/5 animate-pulse rounded-lg" />
                ))
              ) : (
                media.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-black border border-white/5 overflow-hidden relative">
                        <img 
                          src={item.thumbnailUrl} 
                          alt={item.filename} 
                          className={cn(
                            "w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all", 
                            (item.isPrivate || item.isAdultContent) && "blur-md opacity-40"
                          )} 
                        />
                        {item.isPrivate && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Lock className="h-4 w-4 text-white" />
                          </div>
                        )}
                        {item.isAdultContent && !item.isPrivate && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <ShieldAlert className="h-4 w-4 text-accent" />
                          </div>
                        )}
                        {item.type === 'video' && !item.isPrivate && !item.isAdultContent && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <Play className="h-4 w-4 text-white fill-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate max-w-[150px]">{item.filename}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {formatRelativeDate(item.createdAt)}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase border-white/5 shrink-0">{item.type}</Badge>
                  </div>
                ))
              )}
              {media.length === 0 && !loading && (
                <p className="text-center py-8 text-sm text-muted-foreground">No hay archivos recientes.</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-white">Infraestructura Física</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 flex items-start gap-3">
                <Film className="h-5 w-5 text-accent shrink-0" />
                <div>
                  <p className="text-sm font-bold text-accent">Streaming por Rango</p>
                  <p className="text-xs text-accent/80">Soporte nativo HTTP Range para reproducción instantánea de videos masivos.</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-start gap-3">
                <HardDrive className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-bold text-primary">Persistencia Node.js</p>
                  <p className="text-xs text-primary/80">Carga por fragmentos binarios optimizada para archivos de hasta 26GB.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}