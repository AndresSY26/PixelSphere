"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Camera, 
  LayoutDashboard, 
  LayoutGrid, 
  Folder, 
  FolderLock, 
  Globe, 
  History, 
  Wand2, 
  Medal, 
  Users, 
  Trash2, 
  Settings, 
  LogOut, 
  Menu, 
  Search, 
  Plus, 
  ChevronDown,
  ChevronRight,
  FolderOpen,
  ShieldAlert,
  Clock,
  Crown,
  Sparkles,
  HardDrive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from '@/components/ui/sheet';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { User, Album } from '@/lib/types';
import { getAlbums, getAlbumsByUser, addMultipleToAlbum, clearStoredUser } from '@/lib/storage';
import { cn, formatBytes } from '@/lib/utils';
import UploadDialog from '@/components/upload-dialog';
import { UpgradePlanDialog } from '@/components/upgrade-plan-dialog';
import { useNeuralSync } from '@/hooks/use-neural-sync';
import { logoutGoogle } from '@/lib/google-auth';
import { api } from '@/api/client';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  isCollapsible?: boolean;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const SidebarContent = ({
  user,
  isMobile,
  isSidebarOpen,
  pathname,
  albums,
  isDraggingGlobal,
  dragOverAlbumId,
  setDragOverAlbumId,
  onDropOnAlbum,
  handleLogout,
  setIsMobileMenuOpen,
  isLive,
  isAlbumsExpanded,
  setIsAlbumsExpanded,
  onOpenUpgradePlan
}: any) => {
  const quota = (!user?.plan || user?.plan === 'free') ? (3 * 1024 * 1024 * 1024) : (user?.storageQuota || (3 * 1024 * 1024 * 1024));
  const used = user?.storageUsed || 0;
  const usedPercent = Math.min(Math.round((used / quota) * 100), 100);

  const navGroups: NavGroup[] = [
    {
      label: 'MI UNIVERSO',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Galería', href: '/gallery', icon: LayoutGrid },
        { name: 'Álbumes', href: '/albums', icon: Folder, isCollapsible: true },
        { name: 'Carpeta Privada', href: '/vault', icon: FolderLock },
      ]
    },
    { label: 'EXPLORACIÓN', items: [
        { name: 'Mapa Neural', href: '/world', icon: Globe }, 
        { name: 'Cronología', href: '/timeline', icon: History },
        { name: 'Historial', href: '/history', icon: Clock }
    ] },
    { label: 'PROCESADO', items: [{ name: 'Editor', href: '/editor', icon: Wand2, badge: 'PRO' }] },
    { label: 'ECOSISTEMA', items: [
        { name: 'Logros', href: '/achievements', icon: Medal }, 
        { name: 'Compartidos', href: '/shared', icon: Users }
    ] },
    { label: 'SISTEMA', items: [{ name: 'Papelera', href: '/trash', icon: Trash2 }, { name: 'Configuración', href: '/settings', icon: Settings }] }
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c]">
      <div className="h-24 flex items-center px-8 gap-4 overflow-hidden shrink-0">
        <div className="min-w-[40px] h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
          <Camera className="h-6 w-6 text-white" />
        </div>
        {(isSidebarOpen || isMobile) && (
          <div className="flex flex-col">
            <span className="text-2xl font-bold font-headline text-white tracking-tight leading-none">PixelSphere</span>
            <div className="flex items-center gap-1.5 mt-1">
              <div className={cn("w-1.5 h-1.5 rounded-full", isLive ? "bg-green-500 animate-pulse" : "bg-red-500")} />
              <span className="text-[8px] font-black uppercase tracking-widest text-white/40">{isLive ? "Nexo Live" : "Offline"}</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto py-2 px-4 space-y-8 scrollbar-hide">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-3">
            {(isSidebarOpen || isMobile) && <h4 className="px-4 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">{group.label}</h4>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                
                if (item.isCollapsible && (isSidebarOpen || isMobile)) {
                  return (
                    <Collapsible 
                      key={item.name} 
                      open={isAlbumsExpanded || isDraggingGlobal} 
                      onOpenChange={setIsAlbumsExpanded}
                    >
                      <div className="flex items-center w-full">
                        <Link 
                          href={item.href} 
                          onClick={() => isMobile && setIsMobileMenuOpen?.(false)}
                          className={cn(
                            "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group relative flex-1 min-0",
                            isActive ? 'bg-white/[0.05] text-white' : 'text-muted-foreground hover:bg-white/[0.03] hover:text-white'
                          )}
                        >
                          {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-6 bg-primary rounded-r-full" />}
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className={cn("text-sm tracking-wide truncate", isActive ? "font-bold" : "font-medium")}>{item.name}</span>
                        </Link>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-white rounded-xl">
                            {isAlbumsExpanded || isDraggingGlobal ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      
                      <CollapsibleContent className="space-y-1 mt-1 animate-accordion-down overflow-hidden">
                        {albums.length > 0 ? (
                          <div className="ml-4 pl-4 border-l border-white/5 space-y-1 py-1">
                            {albums.slice(0, 10).map((album: any) => (
                              <div 
                                key={album.id} 
                                onDragOver={(e) => { e.preventDefault(); setDragOverAlbumId(album.id); }} 
                                onDrop={(e) => onDropOnAlbum(e, album.id)}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-[11px] font-bold truncate",
                                  dragOverAlbumId === album.id 
                                    ? "bg-primary/20 text-primary scale-[1.02] border border-primary/30" 
                                    : "text-muted-foreground/60 hover:text-white hover:bg-white/5"
                                )}
                              >
                                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{album.title}</span>
                              </div>
                            ))}
                            {albums.length > 10 && (
                              <Link href="/albums" className="block text-[10px] text-primary/60 hover:text-primary font-black uppercase tracking-widest pl-3 pt-2">Ver todos ({albums.length})</Link>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/40 italic pl-10 py-2">Sin álbumes activos</p>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                }

                return (
                  <Link 
                    key={item.name} 
                    href={item.href} 
                    onClick={() => isMobile && setIsMobileMenuOpen?.(false)} 
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group relative", 
                      isActive ? 'bg-white/[0.05] text-white' : 'text-muted-foreground hover:bg-white/[0.03] hover:text-white'
                    )}
                  >
                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-6 bg-primary rounded-r-full" />}
                    <item.icon className="h-5 w-5 shrink-0" />
                    {(isSidebarOpen || isMobile) && (
                      <div className="flex-1 flex items-center justify-between min-w-0">
                        <span className={cn("text-sm tracking-wide truncate", isActive ? "font-bold" : "font-medium")}>{item.name}</span>
                        {item.badge && <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-black border-none bg-accent/20 text-accent uppercase">{item.badge}</Badge>}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      {/* Panel de Cuota de Almacenamiento y Plan */}
      {(isSidebarOpen || isMobile) && (
        <div className="px-4 py-3 border-t border-white/5 bg-white/[0.01]">
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <HardDrive className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider truncate">
                  {user?.plan ? `PLAN ${user.plan.toUpperCase()}` : 'PLAN GRATUITO'}
                </span>
              </div>
              <span className={cn(
                "text-[10px] font-extrabold",
                usedPercent >= 95 ? "text-red-400" : usedPercent >= 80 ? "text-amber-400" : "text-muted-foreground"
              )}>
                {usedPercent}%
              </span>
            </div>

            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500 rounded-full",
                  usedPercent >= 95 ? "bg-red-500" : usedPercent >= 80 ? "bg-amber-400" : "bg-primary"
                )}
                style={{ width: `${Math.min(usedPercent, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
              <span>{formatBytes(used)}</span>
              <span>de {formatBytes(quota)}</span>
            </div>

            <Button
              size="sm"
              onClick={onOpenUpgradePlan}
              className="w-full h-8 text-[11px] font-extrabold rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary/20"
            >
              <Crown className="h-3.5 w-3.5" />
              Mejorar Plan
            </Button>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-white/5 bg-black/40">
        <Button variant="ghost" className="w-full justify-start gap-4 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-2xl h-12 px-3" onClick={handleLogout}>
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0"><LogOut className="h-4 w-4" /></div>
          {(isSidebarOpen || isMobile) && <span className="text-sm font-bold tracking-wide">Desconectar</span>}
        </Button>
      </div>
    </div>
  );
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const sessionData = localStorage.getItem('ps_active_session');
      if (sessionData) {
        try {
          return JSON.parse(sessionData);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });
  const [albums, setAlbums] = useState<Album[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [dragOverAlbumId, setDragOverAlbumId] = useState<string | null>(null);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const [isAlbumsExpanded, setIsAlbumsExpanded] = useState(false);
  
  useNeuralSync(user);
  
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = useCallback(() => {
    logoutGoogle().catch(() => {});
    clearStoredUser();
    localStorage.removeItem('ps_active_session');
    router.push('/login');
  }, [router]);

  useEffect(() => {
    setMounted(true);
    const sessionData = localStorage.getItem('ps_active_session');
    if (sessionData) {
      try {
        const u = JSON.parse(sessionData);
        // Normalizar cuota si era 15GB o 2GB desactualizada de sesiones previas
        if ((!u.plan || u.plan === 'free') && (!u.storageQuota || u.storageQuota === 16106127360 || u.storageQuota === 2147483648)) {
          u.storageQuota = 3 * 1024 * 1024 * 1024;
          localStorage.setItem('ps_active_session', JSON.stringify(u));
          localStorage.setItem('pixelsphere_session_user', JSON.stringify(u));
        }
        setUser(u);
        getAlbums().then(setAlbums);

        // Sincronizar en tiempo real con Neon PostgreSQL
        api.auth.getProfile(u.id).then((freshUser: any) => {
          if (freshUser && freshUser.id) {
            setUser(freshUser);
            localStorage.setItem('ps_active_session', JSON.stringify(freshUser));
            localStorage.setItem('pixelsphere_session_user', JSON.stringify(freshUser));
          }
        }).catch(() => {});
      } catch (e) {
        router.push('/login');
      }
    } else {
      router.push('/login');
    }

    let debounceTimer: NodeJS.Timeout | null = null;
    const onNeural = (event: any) => {
      // Si el evento es específico de una acción que no afecta álbumes ni usuario (ej. visualización puntual), omitir
      const channel = event?.detail?.channel;
      if (channel === 'HISTORY') return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        getAlbums().then(setAlbums).catch(() => {});
        const current = localStorage.getItem('ps_active_session');
        if (current) {
          try {
            const cu = JSON.parse(current);
            if (cu?.id) {
              api.auth.getProfile(cu.id).then((fresh: any) => {
                if (fresh?.id) {
                  setUser(fresh);
                  localStorage.setItem('ps_active_session', JSON.stringify(fresh));
                  localStorage.setItem('pixelsphere_session_user', JSON.stringify(fresh));
                }
              }).catch(() => {});
            }
          } catch (e) {}
        }
      }, 350);
    };
    window.addEventListener('neural-update', onNeural);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('neural-update', onNeural);
    };
  }, []);

  const onDropOnAlbum = async (e: React.DragEvent, albumId: string) => {
    e.preventDefault();
    setDragOverAlbumId(null);
    setIsDraggingGlobal(false);
    const mediaId = e.dataTransfer.getData('mediaId');
    const mediaIdsRaw = e.dataTransfer.getData('mediaIds');
    let idsToLink: string[] = [];
    if (mediaIdsRaw) {
      try { 
        idsToLink = JSON.parse(mediaIdsRaw); 
      } catch (err) { 
        console.error("Error al parsear mediaIds al soltar en álbum:", err);
        idsToLink = mediaId ? [mediaId] : []; 
      }
    } else if (mediaId) idsToLink = [mediaId];

    if (idsToLink.length > 0) {
      const activeUid = user?.id || (typeof window !== 'undefined' && localStorage.getItem('ps_active_session') ? JSON.parse(localStorage.getItem('ps_active_session') || '{}')?.id : null);
      try {
        await addMultipleToAlbum(albumId, activeUid, idsToLink);
        setAlbums(prev => prev.map(a => {
          if (a.id === albumId) {
            const curIds = Array.isArray(a.mediaIds) ? a.mediaIds : [];
            return { ...a, mediaIds: Array.from(new Set([...curIds, ...idsToLink])) };
          }
          return a;
        }));
        toast({ title: "Vínculos Creados", description: `${idsToLink.length} activos orquestados en la colección.` });
      } catch (err) { 
        console.error("Error al añadir múltiples medios al álbum:", err);
        toast({ title: "Error", variant: "destructive" }); 
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('mediaId') || e.dataTransfer.types.includes('mediaIds')) {
      setIsDraggingGlobal(true);
    }
  };

  if (!mounted) return null;

  return (
    <div 
      className="flex h-screen overflow-hidden bg-background" 
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
    >
      <aside className={cn("bg-[#0a0a0c] border-r border-white/5 transition-all duration-300 hidden md:flex flex-col z-50", isSidebarOpen ? 'w-[280px]' : 'w-20')}>
        <SidebarContent 
          user={user}
          isSidebarOpen={isSidebarOpen} 
          pathname={pathname} 
          albums={albums} 
          isDraggingGlobal={isDraggingGlobal} 
          dragOverAlbumId={dragOverAlbumId} 
          setDragOverAlbumId={setDragOverAlbumId} 
          onDropOnAlbum={onDropOnAlbum} 
          handleLogout={handleLogout} 
          isLive={!!user} 
          isAlbumsExpanded={isAlbumsExpanded}
          setIsAlbumsExpanded={setIsAlbumsExpanded}
          onOpenUpgradePlan={() => setIsUpgradeOpen(true)}
        />
      </aside>
      
      <div 
        className="flex-1 flex flex-col min-w-0 overflow-hidden" 
        onDragLeave={(e) => { 
          if (!e.relatedTarget) setIsDraggingGlobal(false); 
        }}
        onDrop={() => { setIsDraggingGlobal(false); setDragOverAlbumId(null); }}
      >
        <header className="h-16 border-b border-white/5 bg-background/50 backdrop-blur-md flex items-center justify-between px-6 z-40">
          <div className="flex items-center gap-4 flex-1">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden text-muted-foreground"><Menu className="h-6 w-6" /></Button></SheetTrigger>
              <SheetContent side="left" className="p-0 border-none w-[280px] bg-[#0a0a0c]">
                <SidebarContent 
                  user={user}
                  isMobile={true} 
                  pathname={pathname} 
                  albums={albums} 
                  setIsMobileMenuOpen={setIsMobileMenuOpen} 
                  handleLogout={handleLogout} 
                  isLive={!!user} 
                  isAlbumsExpanded={isAlbumsExpanded}
                  setIsAlbumsExpanded={setIsAlbumsExpanded}
                  onOpenUpgradePlan={() => {
                    setIsMobileMenuOpen(false);
                    setIsUpgradeOpen(true);
                  }}
                />
              </SheetContent>
            </Sheet>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!isSidebarOpen)} className="md:flex hidden text-muted-foreground"><Menu className="h-5 w-5" /></Button>
            <form onSubmit={(e) => { e.preventDefault(); if(searchVal.trim()) router.push(`/search?q=${encodeURIComponent(searchVal)}`); }} className="relative max-w-md w-full hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchVal} onChange={(e) => setSearchVal(e.target.value)} placeholder="Búsqueda global..." className="pl-10 bg-white/5 border-white/10 rounded-full h-9 text-xs" />
            </form>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setIsUpgradeOpen(true)}
              className="hidden sm:flex border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-full h-9 px-3.5 items-center gap-1.5"
            >
              <Crown className="h-3.5 w-3.5" />
              <span>{user?.plan ? `PLAN ${user.plan.toUpperCase()}` : 'PLAN GRATUITO'}</span>
            </Button>
            <Button onClick={() => setIsUploadOpen(true)} className="bg-primary text-white rounded-full h-9 px-4 font-bold"><Plus className="mr-2 h-4 w-4" /> Ingesta</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer border border-white/10 hover:border-primary/50 transition-all"><AvatarImage src={user?.avatarUrl} /><AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">{user?.username?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-white/10">
                <DropdownMenuLabel>Mi Nodo</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem onClick={() => setIsUpgradeOpen(true)}>Planes y Cuotas</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}>Configuración</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/history')}>Historial</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem className="text-red-400" onClick={handleLogout}>Cerrar Sesión</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto scrollbar-hide p-6">{children}</main>
      </div>
      {user && (
        <>
          <UploadDialog 
            isOpen={isUploadOpen} 
            onClose={() => setIsUploadOpen(false)} 
            user={user} 
            onUploadSuccess={() => {
              window.dispatchEvent(new CustomEvent('neural-update', { 
                detail: { channel: 'MEDIA', data: { userId: user.id } } 
              }));
            }}
          />
          <UpgradePlanDialog
            isOpen={isUpgradeOpen}
            onClose={() => setIsUpgradeOpen(false)}
            user={user}
            onPlanUpdated={(updatedUser) => {
              setUser(updatedUser);
              window.dispatchEvent(new CustomEvent('neural-update', { 
                detail: { channel: 'USER_PLAN', data: updatedUser } 
              }));
            }}
          />
        </>
      )}
    </div>
  );
}
