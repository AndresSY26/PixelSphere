"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminMetrics, getUsers, updateUserFilterPreferences } from '@/lib/storage';
import { User } from '@/lib/types';
import { 
  ShieldAlert, 
  Users, 
  HardDrive, 
  Database, 
  Cpu, 
  Activity, 
  Box, 
  Layers, 
  ArrowUpRight,
  ChevronRight,
  Zap,
  Globe,
  Server,
  FileCode,
  ImageIcon,
  Search,
  ArrowUpDown,
  Lock,
  Loader2,
  FileQuestion,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatBytes } from '@/lib/utils';
import Link from 'next/link';

interface AdminMetrics {
  multimediaSize: number;
  databaseSize: number;
  projectBaseSize: number;
  totalSystemSize: number;
  userCount: number;
  mediaCount: number;
  usersStats: {
    id: string;
    username: string;
    email: string;
    role: string;
    mediaCount: number;
    albumCount: number;
    storageUsed: number;
    createdAt: string;
  }[];
}

export default function AdminConsolePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'username' | 'storage'>('username');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    async function initAdmin() {
      const sessionData = localStorage.getItem('ps_active_session');
      
      if (!sessionData) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      const currentUser = JSON.parse(sessionData) as User;

      try {
        const allUsers = await getUsers();
        const serverUser = allUsers.find(u => u.id === currentUser.id);

        if (!serverUser || serverUser.role !== 'admin') {
          setIsAuthorized(false);
          setLoading(false);
          return;
        }

        // Sincronización proactiva de sesión local si el rol cambió en el servidor
        if (currentUser.role !== 'admin') {
          const updatedSession = { ...currentUser, role: 'admin' as const, is2FAEnabled: false };
          localStorage.setItem('ps_active_session', JSON.stringify(updatedSession));
          setUser(updatedSession);
        } else {
          setUser(currentUser);
        }

        setIsAuthorized(true);
        const data = await getAdminMetrics();
        setMetrics(data as any);
      } catch (error) {
        console.error("Falla en terminal administrativa:", error);
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    }
    initAdmin();
  }, [router]);

  const filteredUsers = useMemo(() => {
    if (!metrics) return [];
    let result = metrics.usersStats.filter(u => 
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortBy === 'username') {
      result.sort((a, b) => a.username.localeCompare(b.username));
    } else {
      result.sort((a, b) => b.storageUsed - a.storageUsed);
    }

    return result;
  }, [metrics, searchQuery, sortBy]);

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center p-6 text-center space-y-10 animate-fade-in">
        <div className="relative">
          <div className="w-32 h-32 rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex items-center justify-center shadow-2xl relative overflow-hidden">
            <FileQuestion className="h-16 w-16 text-muted-foreground/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
          <div className="absolute -top-2 -right-2 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Error 404</span>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl font-black text-white font-headline tracking-tighter">404 - Página no encontrada</h1>
          <p className="text-muted-foreground max-sm mx-auto text-lg leading-relaxed">
            La ubicación que intentas orquestar no existe en este sector de la red PixelSphere o ha sido movida permanentemente.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild variant="outline" className="h-14 px-8 rounded-2xl border-white/10 bg-white/5 text-white font-bold hover:bg-white/10">
            <Link href="/">
              <ArrowLeft className="mr-2 h-5 w-5" /> Volver al Inicio
            </Link>
          </Button>
          <Button asChild className="h-14 px-8 rounded-2xl bg-primary text-white font-bold shadow-xl shadow-primary/20">
            <Link href="/dashboard">Ir al Dashboard</Link>
          </Button>
        </div>

        <div className="pt-20 opacity-10">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white">PixelSphere Engine • Protocolo de Ofuscación v12.6</p>
        </div>
      </div>
    );
  }

  if (isAuthorized === null || (loading && !metrics)) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Validando Credenciales de Núcleo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6 lg:p-12 selection:bg-red-500/30">
      <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge className="bg-red-500/20 text-red-400 border-none font-black text-[10px] uppercase tracking-widest px-4 py-1 rounded-full shadow-lg shadow-red-500/5">Protocolo de Núcleo</Badge>
              <div className="h-px w-12 bg-white/10" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white font-headline">
              Centro de <span className="text-red-500">Mando Administrativo</span>
            </h1>
            <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">Terminal aislada de telemetría global para la monitorización física del ecosistema PixelSphere.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" className="border-white/10 bg-white/5 rounded-xl h-12 px-6 font-bold text-white hover:bg-white/10" onClick={() => router.push('/dashboard')}>
              Salir a UI Estándar
            </Button>
            <Card className="bg-primary/5 border-primary/20 p-4 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Activity className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Estatus Sistema</p>
                <p className="text-xs font-bold text-white">Óptimo • Nodo Central</p>
              </div>
            </Card>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            icon={Users} 
            label="Usuarios Totales" 
            value={metrics?.userCount || 0} 
            loading={loading}
            color="text-primary"
          />
          <StatCard 
            icon={Layers} 
            label="Activos en Red" 
            value={metrics?.mediaCount || 0} 
            loading={loading}
            color="text-accent"
          />
          <StatCard 
            icon={HardDrive} 
            label="Espacio Multimedia" 
            value={formatBytes(metrics?.multimediaSize || 0)} 
            loading={loading}
            color="text-primary"
          />
          <StatCard 
            icon={Database} 
            label="Nexo de Datos" 
            value={formatBytes(metrics?.databaseSize || 0)} 
            loading={loading}
            color="text-accent"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 bg-card/40 border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl shadow-2xl">
            <CardHeader className="p-8 border-b border-white/5 bg-white/[0.02] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-white">Auditoría de Nodos</CardTitle>
                <CardDescription className="text-xs">Monitorización individual de almacenamiento y actividad.</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Filtrar nodo..." 
                    className="h-9 pl-9 bg-white/5 border-white/10 rounded-full text-xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-full border border-white/5 bg-white/5"
                  onClick={() => setSortBy(prev => prev === 'username' ? 'storage' : 'username')}
                >
                  <ArrowUpDown className="h-4 w-4 text-primary" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader className="bg-white/[0.01]">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-8">Identidad</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Rol</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Activos</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Carga Física</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right pr-8">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && !metrics ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-white/5">
                          <TableCell className="pl-8"><Skeleton className="h-10 w-32 bg-white/5" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-12 bg-white/5" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-12 bg-white/5" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 bg-white/5" /></TableCell>
                          <TableCell className="pr-8 text-right"><Skeleton className="h-8 w-8 ml-auto bg-white/5" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      filteredUsers.map((u) => (
                        <TableRow key={u.id} className="border-white/5 group hover:bg-white/[0.02] transition-all">
                          <TableCell className="pl-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
                                {u.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{u.username}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[8px] font-black uppercase tracking-widest", u.role === 'admin' ? "bg-red-500/20 text-red-400 border-none" : "bg-white/5 text-muted-foreground border-none")}>
                              {u.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-white/5 bg-white/5 text-[10px] font-bold">
                              {u.mediaCount} <span className="opacity-40 ml-1">F / V</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5 w-24">
                              <p className="text-[10px] font-bold text-white">{formatBytes(u.storageUsed)}</p>
                              <Progress value={Math.min((u.storageUsed / (26 * 1024 * 1024 * 1024)) * 100, 100)} className="h-1 bg-white/5" />
                            </div>
                          </TableCell>
                          <TableCell className="pr-8 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/20 hover:text-primary transition-all">
                              <ArrowUpRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <Card className="bg-card/40 border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl shadow-2xl">
              <CardHeader className="p-8 border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-3">
                  <Server className="h-5 w-5 text-accent" /> Desglose de Carga
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="space-y-6">
                  <CargaItem 
                    icon={FileCode} 
                    label="Sistema y Núcleo" 
                    value={formatBytes(metrics?.projectBaseSize || 0)} 
                    percent={metrics ? (metrics.projectBaseSize / metrics.totalSystemSize) * 100 : 0}
                    color="bg-primary"
                  />
                  <CargaItem 
                    icon={ImageIcon} 
                    label="Multimedia de Nodos" 
                    value={formatBytes(metrics?.multimediaSize || 0)} 
                    percent={metrics ? (metrics.multimediaSize / metrics.totalSystemSize) * 100 : 0}
                    color="bg-accent"
                  />
                  <CargaItem 
                    icon={Database} 
                    label="Base de Datos Neural" 
                    value={formatBytes(metrics?.databaseSize || 0)} 
                    percent={metrics ? (metrics.databaseSize / metrics.totalSystemSize) * 100 : 0}
                    color="bg-white/20"
                  />
                </div>

                <div className="pt-8 border-t border-white/5">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Carga Total Ecosistema</p>
                  <h3 className="text-3xl font-black text-white mt-1">{formatBytes(metrics?.totalSystemSize || 0)}</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-red-500/5 border-red-500/20 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-red-500 group-hover:scale-110 transition-transform duration-700">
                <ShieldAlert className="h-24 w-24" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <Zap className="h-5 w-5 text-red-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-widest">Protocolo de Emergencia</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Acciones críticas de purga y mantenimiento del nexo están restringidas a este panel de alta prioridad.</p>
                <Button variant="outline" className="w-full h-12 rounded-xl border-red-500/20 text-red-400 hover:bg-red-500/10 font-bold uppercase text-[10px] tracking-widest">
                  Purgar Temporales
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, loading, color }: any) {
  return (
    <Card className="bg-card/40 border-white/5 rounded-[2rem] overflow-hidden group hover:border-primary/30 transition-all shadow-xl backdrop-blur-xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-2xl bg-white/5 transition-transform group-hover:scale-110", color)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">{label}</p>
          {loading ? <Skeleton className="h-8 w-24 bg-white/5" /> : <h3 className="text-2xl font-black text-white">{value}</h3>}
        </div>
      </CardContent>
    </Card>
  );
}

function CargaItem({ icon: Icon, label, value, percent, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold text-white/80 uppercase">{label}</span>
        </div>
        <span className="text-[10px] font-mono text-white/40">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
