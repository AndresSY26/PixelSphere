"use client";

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  Bell, 
  CheckCircle2, 
  Trophy, 
  ShieldCheck, 
  Info, 
  Trash2, 
  CalendarDays,
  Zap,
  Filter,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuRadioGroup, 
  DropdownMenuRadioItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn, formatRelativeDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'achievement' | 'security';
  timestamp: string;
  read: boolean;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'success' | 'achievement' | 'security' | 'info'>('all');
  const { toast } = useToast();

  useEffect(() => {
    const sessionData = localStorage.getItem('ps_active_session');
    if (sessionData) {
      const user = JSON.parse(sessionData);
      const saved = localStorage.getItem(`ps_notifs_${user.id}`);
      if (saved) {
        setNotifications(JSON.parse(saved));
      }
    }
  }, []);

  const filteredNotifications = useMemo(() => {
    let result = [...notifications].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    if (filterType !== 'all') {
      result = result.filter(n => n.type === filterType);
    }
    return result;
  }, [notifications, filterType]);

  const groupedNotifications = useMemo(() => {
    return filteredNotifications.reduce((acc: { label: string, items: Notification[] }[], item) => {
      const label = formatRelativeDate(item.timestamp);
      const existingGroup = acc.find(g => g.label === label);
      if (existingGroup) existingGroup.items.push(item);
      else acc.push({ label, items: [item] });
      return acc;
    }, []);
  }, [filteredNotifications]);

  const clearAll = () => {
    setNotifications([]);
    const sessionData = localStorage.getItem('ps_active_session');
    if (sessionData) {
      const user = JSON.parse(sessionData);
      localStorage.setItem(`ps_notifs_${user.id}`, JSON.stringify([]));
    }
    toast({ title: "Historial limpiado", description: "Tu centro de nexos está despejado." });
  };

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    const sessionData = localStorage.getItem('ps_active_session');
    if (sessionData) {
      const user = JSON.parse(sessionData);
      localStorage.setItem(`ps_notifs_${user.id}`, JSON.stringify(updated));
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-white font-headline">
              Historial de Nexos
            </h1>
            <p className="text-muted-foreground">
              Bitácora completa de orquestación, seguridad y logros en PixelSphere.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl border-white/10 bg-white/5 text-white">
                  <Filter className="h-4 w-4 mr-2 text-primary" />
                  Filtrar: <span className="text-primary ml-1 uppercase">{filterType === 'all' ? 'Todo' : filterType}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-white/10">
                <DropdownMenuLabel>Tipo de Evento</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuRadioGroup value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                  <DropdownMenuRadioItem value="all">Todo el historial</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="success">Ingestas</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="achievement">Logros</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="security">Seguridad</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="info">Información</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={markAllRead} className="h-10 w-10 text-muted-foreground hover:text-white rounded-xl border border-white/10">
              <Check className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={clearAll} className="h-10 w-10 text-muted-foreground hover:text-red-400 rounded-xl border border-white/10">
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {groupedNotifications.length > 0 ? (
          <div className="space-y-12">
            {groupedNotifications.map((group) => (
              <div key={group.label} className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                  <CalendarDays className="h-5 w-5 text-primary/60" />
                  <h2 className="text-lg font-bold text-white/80 font-headline uppercase tracking-widest">{group.label}</h2>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
                <div className="grid gap-4">
                  {group.items.map((item) => (
                    <Card 
                      key={item.id} 
                      className={cn(
                        "bg-card/40 border-white/5 hover:border-primary/30 transition-all rounded-[2rem] overflow-hidden group",
                        !item.read && "bg-white/[0.03] border-primary/20"
                      )}
                    >
                      <CardContent className="p-6">
                        <div className="flex gap-6 items-start">
                          <div className={cn(
                            "p-4 rounded-2xl shrink-0 shadow-lg",
                            item.type === 'success' && "bg-green-500/10 text-green-400 shadow-green-500/5",
                            item.type === 'achievement' && "bg-primary/10 text-primary shadow-primary/5",
                            item.type === 'security' && "bg-accent/10 text-accent shadow-accent/5",
                            item.type === 'info' && "bg-blue-500/10 text-blue-400 shadow-blue-500/5",
                          )}>
                            {item.type === 'success' && <CheckCircle2 className="h-6 w-6" />}
                            {item.type === 'achievement' && <Trophy className="h-6 w-6" />}
                            {item.type === 'security' && <ShieldCheck className="h-6 w-6" />}
                            {item.type === 'info' && <Info className="h-6 w-6" />}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-bold text-white">{item.title}</h3>
                              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest border-white/5 opacity-40">
                                {formatRelativeDate(item.timestamp)}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">
                              {item.description}
                            </p>
                            {!item.read && (
                              <div className="pt-2">
                                <Badge className="bg-primary/20 text-primary border-none rounded-full px-2 py-0.5 text-[9px] uppercase font-bold tracking-tighter">Nueva Alerta</Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-6 bg-white/[0.02] border border-dashed border-white/10 rounded-[3rem]">
            <div className="w-20 h-20 rounded-[2.5rem] bg-white/5 flex items-center justify-center">
              <Bell className="h-10 w-10 text-muted-foreground opacity-20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Nexo Despejado</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                No hay registros de actividad recientes en tu infraestructura física.
              </p>
            </div>
          </div>
        )}

        <section className="pt-12">
          <Card className="bg-primary/5 border-primary/10 p-8 rounded-[2.5rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Zap className="h-40 w-40 text-primary" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Info className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h4 className="text-xl font-bold text-white mb-2 font-headline">Auditoría de Sistemas</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Este historial refleja cada interacción física con tu base de datos y archivos. La persistencia está garantizada mediante escritura directa en JSON con encriptación SHA-512. Las alertas de logros se orquestan automáticamente al detectar cambios de estado en tu inventario.
                </p>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
