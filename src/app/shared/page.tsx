"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  getSharedWithMe, 
  getMySharedContent, 
  getUsers, 
  revokeSharedAccess, 
  clearAllSharedAccess 
} from '@/lib/storage';
import { Album, User, Media } from '@/lib/types';
import { 
  Globe, 
  Users, 
  Share2, 
  Inbox,
  ExternalLink, 
  Copy, 
  Check, 
  Lock,
  ImageIcon,
  Search,
  MoreVertical,
  Loader2,
  Sparkles,
  Layers,
  Clock,
  Link as LinkIcon,
  ShieldCheck,
  Download,
  X,
  Trash2,
  UserX,
  Eye,
  Info,
  ChevronRight,
  FolderTree,
  ShieldAlert,
  Timer,
  ShieldX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn, formatRelativeDate } from '@/lib/utils';
import Image from 'next/image';
import NeuralVideoPlayer from '@/components/neural-video-player';

export default function SharedPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [receivedMedia, setReceivedMedia] = useState<Media[]>([]);
  const [receivedAlbums, setReceivedAlbums] = useState<Album[]>([]);
  const [outgoingMedia, setOutgoingMedia] = useState<Media[]>([]);
  const [outgoingAlbums, setOutgoingAlbums] = useState<Album[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  
  const [selectedReceivedMedia, setSelectedReceivedMedia] = useState<Media | null>(null);
  const [detailsItem, setDetailsItem] = useState<any | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  
  const { toast } = useToast();

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const sessionData = localStorage.getItem('ps_active_session');
      if (!sessionData) return;
      const user = JSON.parse(sessionData);
      setCurrentUser(user);

      const [received, outgoing, allUsers] = await Promise.all([
        getSharedWithMe(user.id),
        getMySharedContent(user.id),
        getUsers()
      ]);

      setReceivedMedia(received.media);
      setReceivedAlbums(received.albums);
      setOutgoingMedia(outgoing.media);
      setOutgoingAlbums(outgoing.albums);
      setSystemUsers(allUsers);
      setAllMedia(received.media.concat(outgoing.media));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  const combinedOutgoing = useMemo(() => {
    const rootAlbums = outgoingAlbums.filter(a => !outgoingAlbums.some(p => p.id === a.parentId));
    const items = [
      ...rootAlbums.map(a => ({ ...a, displayType: 'album' as const })),
      ...outgoingMedia.map(m => ({ ...m, displayType: 'media' as const }))
    ];
    return items.filter(item => {
      const title = item.displayType === 'album' ? (item as Album).title : (item as Media).filename;
      return title.toLowerCase().includes(searchQuery.toLowerCase());
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [outgoingAlbums, outgoingMedia, searchQuery]);

  const handleRevokeAll = async (itemId: string) => {
    if (!currentUser) return;
    setIsRevoking(true);
    try { 
      await clearAllSharedAccess(itemId, currentUser.id); 
      toast({ title: "Distribución Finalizada" }); 
      setDetailsItem(null); 
      loadAllData(); 
    } catch (e) { 
      console.error("Error al revocar acceso compartido:", e);
      toast({ title: "Error", variant: "destructive" }); 
    } finally { 
      setIsRevoking(false); 
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-10 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-white font-headline flex items-center gap-3"><Globe className="h-10 w-10 text-primary" /> Red de Distribución</h1>
            <p className="text-muted-foreground max-w-2xl">Gestiona accesos temporales y permisos granulares en el nexo compartido.</p>
          </div>
        </header>

        <Tabs defaultValue="received" className="w-full space-y-8">
          <TabsList className="bg-white/5 p-1 rounded-2xl h-14 w-fit grid grid-cols-2 gap-2">
            <TabsTrigger value="received" className="rounded-xl font-bold gap-2"><Inbox className="h-4 w-4" /> Recibidos</TabsTrigger>
            <TabsTrigger value="outgoing" className="rounded-xl font-bold gap-2"><Share2 className="h-4 w-4" /> Mis Envíos</TabsTrigger>
          </TabsList>

          <TabsContent value="outgoing" className="space-y-4 outline-none">
            {combinedOutgoing.map((item: any) => (
              <Card key={item.id} className="bg-card/40 border-white/5 hover:border-primary/30 transition-all p-4 rounded-2xl group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 relative border border-white/5">
                      {item.thumbnailUrl && <img src={item.thumbnailUrl} className="w-full h-full object-cover opacity-60" alt="" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{item.displayType === 'album' ? item.title : item.filename}</h4>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-[8px] font-black uppercase border-white/10">{item.displayType}</Badge>
                        {item.sharedPermissions && Object.values(item.sharedPermissions as any).some((p: any) => p.expiresAt) && (
                          <Badge className="bg-accent/20 text-accent border-none text-[8px] font-black uppercase flex items-center gap-1"><Timer className="h-2 w-2" /> Temporal</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white" onClick={() => setDetailsItem(item)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-red-400" onClick={() => handleRevokeAll(item.id)}><ShieldX className="h-4 w-4" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>
          
          <TabsContent value="received">
            {/* ... lógica de recibidos simplificada ... */}
            <div className="py-20 text-center opacity-20"><Inbox className="h-16 w-16 mx-auto mb-4" /><p className="font-bold uppercase tracking-widest">Sincronizando flujo de entrada...</p></div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
