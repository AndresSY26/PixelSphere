
"use client";

import { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { 
  getMedia, 
  getAlbums, 
  registerSharedAccess,
  getUsers
} from '@/lib/storage';
import { Media, Album, User } from '@/lib/types';
import { 
  Camera, 
  ArrowLeft, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  Loader2,
  Lock,
  Globe,
  ImageIcon,
  Layers,
  ChevronRight,
  User as UserIcon,
  Play,
  FolderOpen,
  X,
  FileVideo,
  ChevronLeft,
  Eye,
  FolderTree
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import NeuralVideoPlayer from '@/components/neural-video-player';
import { useToast } from '@/hooks/use-toast';
import { cn, formatRelativeDate } from '@/lib/utils';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function SharedExplorerPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [item, setItem] = useState<Media | Album | null>(null);
  const [itemType, setItemType] = useState<'media' | 'album' | null>(null);
  const [author, setAuthor] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  
  // Contenido del álbum (recursivo)
  const [albumMedia, setAlbumMedia] = useState<Media[]>([]);
  const [subAlbums, setSubAlbums] = useState<Album[]>([]);
  
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);

  // Historial de navegación para breadcrumbs locales
  const [navHistory, setNavHistory] = useState<Album[]>([]);

  useEffect(() => {
    async function loadSharedData() {
      try {
        setLoading(true);
        const sessionData = localStorage.getItem('ps_active_session');
        const currentUser = sessionData ? JSON.parse(sessionData) : null;
        setSessionUser(currentUser);

        const [allMedia, allAlbums, allUsers] = await Promise.all([
          getMedia(),
          getAlbums(),
          getUsers()
        ]);

        const foundMedia = allMedia.find(m => m.id === id);
        const foundAlbum = allAlbums.find(a => a.id === id);

        if (foundMedia) {
          setItem(foundMedia);
          setItemType('media');
          setAuthor(allUsers.find(u => u.id === foundMedia.userId) || null);
          
          // Vincular si es necesario
          if (currentUser && foundMedia.userId !== currentUser.id && !foundMedia.sharedWith?.includes(currentUser.id)) {
            await registerSharedAccess(foundMedia.id, currentUser.id);
          }
        } else if (foundAlbum) {
          setItem(foundAlbum);
          setItemType('album');
          setAuthor(allUsers.find(u => u.id === foundAlbum.userId) || null);

          // Cargar contenido del álbum
          const mediaInAlbum = allMedia.filter(m => foundAlbum.mediaIds.includes(m.id));
          const childrenAlbums = allAlbums.filter(a => a.parentId === foundAlbum.id);
          
          setAlbumMedia(mediaInAlbum);
          setSubAlbums(childrenAlbums);

          // Construir breadcrumbs (recursivo local)
          const crumbs: Album[] = [];
          let cur: string | undefined = foundAlbum.id;
          while(cur) {
            const a = allAlbums.find(alb => alb.id === cur);
            if(a) { crumbs.unshift(a); cur = a.parentId; }
            else cur = undefined;
          }
          setNavHistory(crumbs);

          // Vincular si es necesario
          if (currentUser && foundAlbum.userId !== currentUser.id && !foundAlbum.sharedWith?.includes(currentUser.id)) {
            await registerSharedAccess(foundAlbum.id, currentUser.id);
          }
        }
      } catch (error) {
        console.error("Error en explorador shared:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSharedData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-[10px] uppercase font-black tracking-[0.2em]">Sincronizando con la Red...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center p-6 text-center space-y-8">
        <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <Lock className="h-12 w-12 text-red-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-white font-headline">Acceso Revocado</h1>
          <p className="text-muted-foreground max-w-sm">El protocolo de red ha finalizado o el activo no está disponible en este nodo.</p>
        </div>
        <Button asChild className="rounded-2xl bg-white text-black font-bold h-14 px-10">
          <Link href="/">Volver al Nexo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-primary/30">
      <header className="h-20 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-6 sm:px-12 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link href={sessionUser ? "/dashboard" : "/"} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Camera className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold font-headline tracking-tighter hidden sm:inline">PixelSphere</span>
          </Link>
          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-white rounded-full">
              <Link href="/shared">Red</Link>
            </Button>
            {navHistory.map((crumb, idx) => (
              <div key={crumb.id} className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                <Button asChild variant="ghost" size="sm" className={cn("rounded-full h-8 px-3 text-xs", idx === navHistory.length - 1 ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                  <Link href={`/p/${crumb.id}`}>{crumb.title}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
            <Avatar className="h-6 w-6">
              <AvatarImage src={author?.avatarUrl} />
              <AvatarFallback className="text-[8px] bg-primary/20 text-primary">{author?.username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-[10px] font-bold text-white/60 uppercase">Autor: {author?.username}</span>
          </div>
          {sessionUser ? (
            <Button asChild variant="outline" className="rounded-xl border-white/10 h-10 bg-white/5 font-bold">
              <Link href="/shared">Buzón de Red</Link>
            </Button>
          ) : (
            <Button asChild className="rounded-xl bg-primary text-white font-bold">
              <Link href="/login">Ingresar</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary/20 text-primary border-none text-[10px] uppercase font-black tracking-widest px-3 py-1">Contenido de Red</Badge>
            <Badge variant="outline" className="border-white/10 text-muted-foreground text-[10px] uppercase font-black px-3 py-1">Solo Lectura Blindada</Badge>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black font-headline tracking-tight">
            {itemType === 'media' ? (item as Media).filename : (item as Album).title}
          </h1>
          {itemType === 'album' && (item as Album).description && (
            <p className="text-xl text-muted-foreground max-w-3xl leading-relaxed">{(item as Album).description}</p>
          )}
        </section>

        {itemType === 'album' ? (
          <div className="space-y-16">
            {/* Sub-álbumes Adaptativos */}
            {subAlbums.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-accent flex items-center gap-2 px-1">
                  <FolderTree className="h-4 w-4" /> Sub-Colecciones Relacionadas
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {subAlbums.map(album => (
                    <Link key={album.id} href={`/p/${album.id}`}>
                      <Card className="bg-white/5 border-white/5 hover:border-accent/50 transition-all rounded-[2rem] overflow-hidden group cursor-pointer h-full">
                        <div className="aspect-square bg-black flex items-center justify-center relative">
                          <FolderOpen className="h-16 w-16 text-white/5 group-hover:scale-110 group-hover:text-accent/20 transition-all duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />
                          <div className="absolute bottom-6 left-6 right-6">
                            <h3 className="font-bold text-xl text-white truncate">{album.title}</h3>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">Explorar Rama</p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Media del álbum con Proporción Adaptativa */}
            <div className="space-y-6">
              <h2 className="text-sm font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 px-1">
                <ImageIcon className="h-4 w-4" /> Activos del Autor
              </h2>
              {albumMedia.length === 0 && subAlbums.length === 0 ? (
                <div className="py-20 text-center bg-white/[0.02] border border-dashed border-white/5 rounded-[2.5rem]">
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Esta colección aún no tiene activos visibles.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {albumMedia.map(m => (
                    <div 
                      key={m.id} 
                      onClick={() => setSelectedMedia(m)}
                      className="group relative aspect-square rounded-[2rem] overflow-hidden bg-white/[0.02] border border-white/5 hover:border-primary/50 transition-all cursor-pointer"
                    >
                      <Image 
                        src={m.thumbnailUrl} 
                        alt="" 
                        fill 
                        className={cn("object-cover transition-transform duration-700 group-hover:scale-110", m.isAdultContent && "blur-2xl opacity-40 scale-125")} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-4 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{m.filename}</p>
                      </div>
                      {m.type === 'video' && <div className="absolute top-3 right-3 p-1.5 bg-black/40 backdrop-blur-md rounded-lg border border-white/10"><Play className="h-3 w-3 fill-white" /></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <section className="relative rounded-[3rem] overflow-hidden bg-black/60 border border-white/5 shadow-2xl group">
            <div className="aspect-video w-full flex items-center justify-center bg-black">
              {(item as Media).type === 'video' ? (
                <NeuralVideoPlayer src={(item as Media).url} className="w-full h-full" />
              ) : (
                <img src={(item as Media).url} alt="" className="max-w-full max-h-full object-contain" />
              )}
            </div>
            <div className="absolute bottom-8 left-8 right-8 flex items-center justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="px-6 py-3 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center gap-3">
                <Eye className="h-4 w-4 text-accent" />
                <span className="text-xs font-bold text-white">Solo Lectura Protegida</span>
              </div>
              <Button asChild className="pointer-events-auto h-12 px-6 rounded-xl bg-white text-black font-bold shadow-xl">
                <a href={(item as Media).url} download={(item as Media).filename}><Download className="mr-2 h-4 w-4" /> Obtener Activo</a>
              </Button>
            </div>
          </section>
        )}
      </main>

      {/* Visor Blindado para Media Seleccionada */}
      <Dialog open={!!selectedMedia} onOpenChange={(o) => !o && setSelectedMedia(null)}>
        <DialogContent className="max-w-6xl p-0 bg-black border-none rounded-none sm:rounded-[2.5rem] overflow-hidden shadow-2xl h-[90vh]">
          {selectedMedia && (
            <div className="flex flex-col h-full">
              <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
                {selectedMedia.type === 'video' ? (
                  <NeuralVideoPlayer src={selectedMedia.url} className="w-full h-full" />
                ) : (
                  <img src={selectedMedia.url} className="max-w-full max-h-full object-contain" alt="" />
                )}
              </div>
              <div className="h-24 bg-[#0a0a0c] border-t border-white/5 flex items-center justify-between px-8 shrink-0">
                <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold text-white">{selectedMedia.filename}</DialogTitle>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3 text-accent" /> Datos Técnicos Ofuscados por Privacidad
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button asChild variant="outline" className="rounded-xl border-white/10 bg-white/5 text-white h-12 px-6 font-bold">
                    <a href={selectedMedia.url} download={selectedMedia.filename}><Download className="mr-2 h-4 w-4" /> Descargar</a>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-muted-foreground" onClick={() => setSelectedMedia(null)}><X className="h-6 w-6" /></Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <footer className="max-w-7xl mx-auto px-6 py-20 border-t border-white/5 text-center space-y-4 opacity-20 hover:opacity-100 transition-opacity duration-700">
        <div className="flex items-center justify-center gap-3">
          <Camera className="h-5 w-5 text-primary" />
          <span className="font-bold font-headline text-white">PixelSphere Red</span>
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.4em]">Protocolo de Distribución v12.6 — Nodo Propietario: {author?.username}</p>
      </footer>
    </div>
  );
}
