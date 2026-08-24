"use client";

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { getAchievementsByUser, getMediaByUser, getAlbumsByUser, unlockAchievement, getSharedWithMe } from '@/lib/storage';
import { BADGES, Achievement, User, Badge as BadgeType } from '@/lib/types';
import { 
  Trophy, 
  Upload, 
  Library, 
  Sparkles, 
  Lock, 
  FolderPlus, 
  Globe, 
  Target, 
  Info, 
  Moon, 
  ShieldCheck, 
  Share2,
  CheckCircle2,
  LockKeyhole,
  Star,
  Zap,
  Layers,
  Film,
  ImageIcon,
  HardDrive,
  Database,
  Camera,
  Smartphone,
  Tag,
  Trash2,
  Timer,
  ShieldAlert,
  Wand2,
  EyeOff,
  ChevronRight,
  Users,
  Inbox,
  Link,
  Palette,
  Box,
  Unlock,
  Navigation,
  Sun,
  Gauge,
  Maximize2,
  ShieldX,
  RefreshCcw,
  Type,
  Eye,
  Monitor,
  Copy,
  Paintbrush,
  Layout,
  History,
  BellOff,
  Video,
  Hash,
  Search,
  Trash,
  Download,
  Laptop,
  Calendar,
  FlaskConical
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatRelativeDate } from '@/lib/utils';

const ICON_MAP: Record<string, any> = {
  Upload,
  Library,
  Sparkles,
  Lock,
  FolderPlus,
  Globe,
  Target,
  Info,
  Moon,
  ShieldCheck,
  Share2,
  Layers,
  Film,
  ImageIcon,
  HardDrive,
  Database,
  Camera,
  Smartphone,
  Tag,
  Trash2,
  Timer,
  ShieldAlert,
  Wand2,
  Trophy,
  Zap,
  Users,
  Inbox,
  Link,
  Palette,
  Box,
  Unlock,
  Navigation,
  Sun,
  Gauge,
  Maximize2,
  ShieldX,
  RefreshCcw,
  Type,
  Eye,
  Monitor,
  Copy,
  Paintbrush,
  Layout,
  History,
  BellOff,
  Video,
  Hash,
  Search,
  Trash,
  Download,
  Laptop,
  Calendar,
  FlaskConical
};

type BadgeStatus = 'unlocked' | 'hint';

interface RenderBadge extends BadgeType {
  status: BadgeStatus;
  unlockedAt?: string;
  originalIndex: number;
}

export default function AchievementsPage() {
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAndSyncData() {
      const sessionData = localStorage.getItem('ps_active_session');
      if (sessionData) {
        const currentUser = JSON.parse(sessionData) as User;
        setUser(currentUser);
        try {
          const [achievements, media, albums, shared] = await Promise.all([
            getAchievementsByUser(currentUser.id),
            getMediaByUser(currentUser.id),
            getAlbumsByUser(currentUser.id),
            getSharedWithMe(currentUser.id)
          ]);
          
          const syncPromises = [];
          
          // --- Hitos de Carga Total ---
          if (media.length > 0) syncPromises.push(unlockAchievement(currentUser.id, 'first_upload'));
          if (media.length >= 10) syncPromises.push(unlockAchievement(currentUser.id, 'ten_uploads'));
          if (media.length >= 50) syncPromises.push(unlockAchievement(currentUser.id, 'fifty_uploads'));
          if (media.length >= 100) syncPromises.push(unlockAchievement(currentUser.id, 'hundred_uploads'));
          if (media.length >= 500) syncPromises.push(unlockAchievement(currentUser.id, 'five_hundred_uploads'));
          if (media.length >= 1000) syncPromises.push(unlockAchievement(currentUser.id, 'thousand_uploads'));
          
          // --- Hitos de Videos ---
          const videos = media.filter(m => m.type === 'video');
          if (videos.length > 0) syncPromises.push(unlockAchievement(currentUser.id, 'first_video'));
          if (videos.length >= 10) syncPromises.push(unlockAchievement(currentUser.id, 'ten_videos'));
          if (videos.length >= 50) syncPromises.push(unlockAchievement(currentUser.id, 'fifty_videos'));
          
          // --- Hitos de Fotos ---
          const photos = media.filter(m => m.type === 'image');
          if (photos.length > 0) syncPromises.push(unlockAchievement(currentUser.id, 'first_photo'));
          if (photos.length >= 10) syncPromises.push(unlockAchievement(currentUser.id, 'ten_photos'));
          if (photos.length >= 50) syncPromises.push(unlockAchievement(currentUser.id, 'fifty_photos'));
          
          // --- Seguridad ---
          if (currentUser.vaultPasswordHash) syncPromises.push(unlockAchievement(currentUser.id, 'vault_setup'));
          if (media.some(m => m.isPrivate)) syncPromises.push(unlockAchievement(currentUser.id, 'vault_secure'));
          if (media.filter(m => m.isPrivate).length >= 10) syncPromises.push(unlockAchievement(currentUser.id, 'vault_expert'));
          if (currentUser.is2FAEnabled && currentUser.biometricEnabled) syncPromises.push(unlockAchievement(currentUser.id, 'full_shield'));
          if (currentUser.settings.vaultAutoLockEnabled) syncPromises.push(unlockAchievement(currentUser.id, 'vault_timer'));

          // --- Colecciones ---
          if (albums.length > 0) syncPromises.push(unlockAchievement(currentUser.id, 'album_creator'));
          if (albums.length >= 5) syncPromises.push(unlockAchievement(currentUser.id, 'five_albums'));
          if (albums.length >= 10) syncPromises.push(unlockAchievement(currentUser.id, 'ten_albums'));
          if (albums.length >= 25) syncPromises.push(unlockAchievement(currentUser.id, 'collection_master'));
          if (albums.some(a => a.parentId)) syncPromises.push(unlockAchievement(currentUser.id, 'nested_master'));
          if (albums.some(a => a.isPublic)) syncPromises.push(unlockAchievement(currentUser.id, 'portfolio_star'));
          if (albums.some(a => {
            const hasParent = a.parentId;
            if (!hasParent) return false;
            const parent = albums.find(p => p.id === hasParent);
            return parent && parent.parentId;
          })) syncPromises.push(unlockAchievement(currentUser.id, 'deep_folders'));
          if (albums.some(a => a.mediaIds.length >= 50)) syncPromises.push(unlockAchievement(currentUser.id, 'mega_album'));

          // --- Edición e IA ---
          const manualEdits = media.filter(m => m.tags?.includes('manual-edit')).length;
          const aiEdits = media.filter(m => m.tags?.includes('ai-edit')).length;
          if (manualEdits > 0) syncPromises.push(unlockAchievement(currentUser.id, 'manual_tweak'));
          if (manualEdits >= 10) syncPromises.push(unlockAchievement(currentUser.id, 'manual_pro'));
          if (aiEdits > 0) syncPromises.push(unlockAchievement(currentUser.id, 'ai_editor'));
          if (aiEdits >= 5) syncPromises.push(unlockAchievement(currentUser.id, 'ai_pro'));
          if (aiEdits >= 25) syncPromises.push(unlockAchievement(currentUser.id, 'ai_god'));

          // --- Captura ---
          const captures = media.filter(m => m.metadata?.cameraSource);
          if (captures.length > 0) syncPromises.push(unlockAchievement(currentUser.id, 'first_capture'));
          if (captures.length >= 10) syncPromises.push(unlockAchievement(currentUser.id, 'camera_fan'));
          if (captures.filter(m => m.metadata?.cameraSource === 'front').length >= 5) syncPromises.push(unlockAchievement(currentUser.id, 'selfie_king'));
          if (captures.filter(m => m.metadata?.cameraSource === 'front').length >= 10) syncPromises.push(unlockAchievement(currentUser.id, 'selfie_pro'));
          if (captures.filter(m => m.metadata?.cameraSource === 'back').length >= 5) syncPromises.push(unlockAchievement(currentUser.id, 'back_cam_pro'));
          if (captures.filter(m => m.metadata?.cameraSource === 'back').length >= 10) syncPromises.push(unlockAchievement(currentUser.id, 'back_cam_expert'));

          // --- Almacenamiento ---
          const totalSize = media.reduce((acc, curr) => acc + (curr.size || 0), 0);
          if (totalSize >= 1024 * 1024 * 1024) syncPromises.push(unlockAchievement(currentUser.id, 'storage_1gb'));
          if (totalSize >= 10 * 1024 * 1024 * 1024) syncPromises.push(unlockAchievement(currentUser.id, 'storage_10gb'));
          if (totalSize >= 25 * 1024 * 1024 * 1024) syncPromises.push(unlockAchievement(currentUser.id, 'storage_full'));
          if (media.some(m => m.size > 100 * 1024 * 1024)) syncPromises.push(unlockAchievement(currentUser.id, 'heavy_media'));
          if (media.some(m => m.size > 500 * 1024 * 1024)) syncPromises.push(unlockAchievement(currentUser.id, 'giant_file'));
          if (media.some(m => m.size > 1024 * 1024 * 1024)) syncPromises.push(unlockAchievement(currentUser.id, 'data_beast'));

          // --- Estética y Sistema ---
          if (currentUser.avatarUrl && !currentUser.avatarUrl.includes('placeholder')) syncPromises.push(unlockAchievement(currentUser.id, 'avatar_master'));
          if (currentUser.settings.accentColor !== '#7373F0') syncPromises.push(unlockAchievement(currentUser.id, 'style_expert'));
          if (currentUser.settings.backgroundTheme === 'obsidian') syncPromises.push(unlockAchievement(currentUser.id, 'obsidian_night'));
          if (currentUser.settings.backgroundTheme === 'midnight') syncPromises.push(unlockAchievement(currentUser.id, 'midnight_voyager'));
          if (currentUser.settings.glassIntensity !== 10) syncPromises.push(unlockAchievement(currentUser.id, 'glass_pro'));
          if (currentUser.settings.interfaceDensity === 'compact') syncPromises.push(unlockAchievement(currentUser.id, 'density_ninja'));

          // --- Omega ---
          if (achievements.length >= BADGES.length - 1) syncPromises.push(unlockAchievement(currentUser.id, 'omega_orchestrator'));
          
          if (syncPromises.length > 0) {
            await Promise.all(syncPromises);
            const finalAchievements = await getAchievementsByUser(currentUser.id);
            setUnlockedAchievements(finalAchievements);
          } else {
            setUnlockedAchievements(achievements);
          }
        } catch (error) {
          console.error("Fallo en sincronización:", error);
        } finally {
          setLoading(false);
        }
      }
    }
    loadAndSyncData();
  }, []);

  const { badgesToRender, progressData } = useMemo(() => {
    const unlocked: RenderBadge[] = [];
    const locked: RenderBadge[] = [];

    BADGES.forEach((badge, index) => {
      const achievement = unlockedAchievements.find(a => a.badgeId === badge.id);
      if (achievement) {
        unlocked.push({
          ...badge,
          status: 'unlocked',
          unlockedAt: achievement.unlockedAt,
          originalIndex: index
        });
      } else {
        locked.push({
          ...badge,
          status: 'hint',
          originalIndex: index
        });
      }
    });

    unlocked.sort((a, b) => a.originalIndex - b.originalIndex);
    // Para no saturar, mostramos todos los desbloqueados + un pool de próximos retos
    const hints = locked.slice(0, 12);
    const finalRenderList = [...unlocked, ...hints];
    const percentage = Math.round((unlocked.length / BADGES.length) * 100);

    return { 
      badgesToRender: finalRenderList, 
      progressData: { 
        total: BADGES.length, 
        unlocked: unlocked.length, 
        percentage 
      } 
    };
  }, [unlockedAchievements]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-10 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge className="bg-primary/20 text-primary border-none font-black text-[10px] uppercase tracking-widest px-4 py-1 rounded-full">Protocolo de Prestigio</Badge>
              <div className="h-px w-12 bg-white/10" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white font-headline">
              Récords de <span className="text-primary">Orquestación</span>
            </h1>
            <p className="text-muted-foreground max-w-xl">
              Has desbloqueado {progressData.unlocked} de {progressData.total} hitos en tu infraestructura multimedia.
            </p>
          </div>
          <Card className="bg-primary/10 border-primary/20 p-6 min-w-[280px] shadow-2xl shadow-primary/10 rounded-3xl">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-32 bg-white/5" />
                <Skeleton className="h-2 w-full bg-white/5" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-3 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Estatus Global</p>
                    <p className="text-2xl font-bold text-white">{progressData.unlocked} / {progressData.total}</p>
                  </div>
                </div>
                <Progress value={progressData.percentage} className="h-1.5 bg-white/5" />
                <p className="text-[10px] text-primary font-bold mt-2 text-right uppercase tracking-widest">
                  {progressData.percentage}% Completado
                </p>
              </>
            )}
          </Card>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/5 rounded-[2rem] h-[320px]">
                <CardContent className="p-8 flex flex-col items-center justify-center space-y-6">
                  <Skeleton className="w-20 h-20 rounded-[2rem] bg-white/5" />
                  <Skeleton className="h-6 w-32 bg-white/5" />
                  <Skeleton className="h-4 w-48 bg-white/5" />
                </CardContent>
              </Card>
            ))
          ) : (
            badgesToRender.map((badge, idx) => {
              const Icon = ICON_MAP[badge.icon] || Star;
              const isUnlocked = badge.status === 'unlocked';
              
              return (
                <Card 
                  key={badge.id} 
                  className={cn(
                    "relative group border-white/5 overflow-hidden transition-all duration-500 rounded-[2.5rem] animate-slide-up",
                    isUnlocked 
                      ? "bg-card/80 border-primary/30 shadow-lg shadow-primary/5 hover:border-primary/60" 
                      : "bg-white/[0.03] border-white/10"
                  )}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  {isUnlocked && (
                    <div className="absolute top-4 right-4 z-20">
                      <div className="bg-primary/20 backdrop-blur-md p-1.5 rounded-full border border-primary/30">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  )}
                  
                  <CardContent className="p-8 flex flex-col items-center text-center space-y-6 h-full">
                    <div className={cn(
                      "w-20 h-20 rounded-[2.5rem] flex items-center justify-center transition-all duration-500 relative",
                      isUnlocked 
                        ? "gradient-primary text-white shadow-xl shadow-primary/20 scale-110" 
                        : "bg-white/5 text-muted-foreground/40"
                    )}>
                      {!isUnlocked && <LockKeyhole className="absolute -top-1 -right-1 h-5 w-5 text-muted-foreground/40" />}
                      <Icon className={cn("h-10 w-10", !isUnlocked && "opacity-40")} />
                    </div>

                    <div className="space-y-3 flex-1">
                      <h3 className={cn(
                        "text-xl font-bold font-headline transition-colors",
                        isUnlocked ? "text-white" : "text-muted-foreground"
                      )}>
                        {badge.title}
                      </h3>
                      
                      <div className="space-y-2">
                        <p className={cn(
                          "text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-1.5",
                          isUnlocked ? "text-primary" : "text-muted-foreground/40"
                        )}>
                          {isUnlocked ? "Misión Completada" : "Objetivo del Nexo"}
                        </p>
                        <p className={cn(
                          "text-xs leading-relaxed px-2",
                          isUnlocked ? "text-muted-foreground" : "text-muted-foreground/60 italic"
                        )}>
                          {badge.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 w-full">
                      {isUnlocked ? (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 rounded-full text-[9px] uppercase font-bold tracking-widest w-full justify-center">
                          {formatRelativeDate(badge.unlockedAt!)}
                        </Badge>
                      ) : (
                        <div className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-white/5 text-[9px] uppercase font-bold text-muted-foreground/40 tracking-widest bg-white/[0.02]">
                          <Star className="h-3 w-3" /> Standby
                        </div>
                      )}
                    </div>
                  </CardContent>

                  {isUnlocked && (
                    <div className="absolute -inset-1 bg-primary/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  )}
                </Card>
              );
            })
          )}
        </div>

        <section className="pt-12">
          <Card className="bg-white/[0.02] border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 text-primary">
              <Star className="h-40 w-40 fill-current" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <Info className="h-8 w-8 text-accent" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h4 className="text-xl font-bold text-white mb-2 font-headline">Guía del Maestro Orquestador</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Has desbloqueado una nueva gama de desafíos. Ahora PixelSphere monitorea tu impacto en la red, tu estilo visual y la profundidad de tu organización física. Se han habilitado un total de **96 medallas de prestigio** para marcar tu evolución en el nexo.
                </p>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
