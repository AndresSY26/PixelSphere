
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { User, Media } from '@/lib/types';
import { 
  Cloud, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  Zap,
  HardDrive,
  RefreshCw,
  Loader2,
  Plus,
  ShieldCheck,
  Globe,
  Database,
  Search,
  ArrowRight,
  ImageIcon,
  Play,
  X,
  Settings2,
  KeyRound,
  Info,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from '@/hooks/use-toast';
import { unlockAchievement } from '@/lib/storage';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface CloudProvider {
  id: 'google' | 'icloud' | 'dropbox';
  name: string;
  icon: any;
  color: string;
  description: string;
}

const PROVIDERS: CloudProvider[] = [
  { 
    id: 'google', 
    name: 'Google Photos', 
    icon: Globe, 
    color: 'text-blue-400', 
    description: 'Importa tus fotos de Google directamente a tu servidor privado.' 
  },
  { 
    id: 'icloud', 
    name: 'Apple iCloud', 
    icon: Cloud, 
    color: 'text-gray-400', 
    description: 'Trae tus recuerdos de iPhone a tu infraestructura física.' 
  },
  { 
    id: 'dropbox', 
    name: 'Dropbox', 
    icon: Database, 
    color: 'text-blue-600', 
    description: 'Mueve tus archivos profesionales de la nube a tu nexo seguro.' 
  }
];

export default function CloudBridgePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [clientOrigin, setClientOrigin] = useState('');
  
  // Estado de API
  const [googleClientId, setGoogleClientId] = useState('');
  const [cloudItems, setCloudItems] = useState<any[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [selectedCloudIds, setSelectedCloudIds] = useState<Set<string>>(new Set());
  const [isDemoMode, setIsDemoMode] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    setClientOrigin(window.location.origin);
    const sessionData = localStorage.getItem('ps_active_session');
    if (sessionData) {
      const u = JSON.parse(sessionData);
      setUser(u);
    }
    
    const savedId = localStorage.getItem('ps_google_client_id');
    if (savedId) setGoogleClientId(savedId);

    setLoading(false);

    // Capturar token OAuth de la URL
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('access_token');
    const error = params.get('error');

    if (token) {
      setGoogleToken(token);
      window.location.hash = "";
      toast({ title: "Conexión Establecida", description: "Ya puedes elegir qué fotos traer a tu nexo." });
    }

    if (error) {
      toast({ 
        variant: "destructive", 
        title: "Error de Acceso", 
        description: "Google no ha podido validar la conexión." 
      });
    }
  }, [toast]);

  const saveClientId = () => {
    if (!googleClientId.trim()) return;
    localStorage.setItem('ps_google_client_id', googleClientId.trim());
    setShowConfig(false);
    toast({ title: "Llave Guardada", description: "Configuración de red actualizada." });
  };

  const handleConnectGoogle = () => {
    if (!googleClientId) {
      setShowConfig(true);
      return;
    }

    setIsConnecting('google');
    const scope = encodeURIComponent('https://www.googleapis.com/auth/photoslibrary.readonly');
    const redirectUri = encodeURIComponent(window.location.origin + '/bridge');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
    
    window.location.href = authUrl;
  };

  const handleStartDemo = () => {
    setIsDemoMode(true);
    setSelectedProvider(PROVIDERS[0]);
    setShowPicker(true);
    fetchDemoPhotos();
  };

  const fetchDemoPhotos = async () => {
    setIsLoadingCloud(true);
    setTimeout(() => {
      const demoPhotos = Array.from({ length: 12 }).map((_, i) => ({
        id: `demo_${i}`,
        baseUrl: `https://picsum.photos/seed/cloud_${i}/800/800`,
        filename: `Recuerdo_Nube_${i + 1}.jpg`,
        mimeType: 'image/jpeg'
      }));
      setCloudItems(demoPhotos);
      setIsLoadingCloud(false);
    }, 1500);
  };

  const fetchGooglePhotos = async () => {
    setIsLoadingCloud(true);
    try {
      const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems', {
        headers: { 'Authorization': `Bearer ${googleToken}` }
      });
      const data = await response.json();
      if (data.mediaItems) {
        setCloudItems(data.mediaItems);
      } else if (data.error) {
        setGoogleToken(null);
        toast({ variant: "destructive", title: "Conexión Expirada", description: "Por seguridad, vuelve a conectar tu cuenta." });
      }
    } catch (e) {
      console.error("Error al obtener fotos de Google Photos:", e);
      toast({ variant: "destructive", title: "Error de Red", description: "No se pudieron obtener tus fotos de Google." });
    } finally {
      setIsLoadingCloud(false);
    }
  };

  const handleImportStart = async (provider: CloudProvider) => {
    setSelectedProvider(provider);
    setIsDemoMode(false);
    setShowPicker(true);
    
    if (provider.id === 'google' && googleToken) {
      fetchGooglePhotos();
    }
  };

  const executeImport = async () => {
    if (!user || !selectedProvider || selectedCloudIds.size === 0) return;
    setIsImporting(true);
    setImportProgress(0);

    const itemsToImport = cloudItems.filter(item => selectedCloudIds.has(item.id));
    let successCount = 0;

    for (let i = 0; i < itemsToImport.length; i++) {
      const item = itemsToImport[i];
      try {
        const response = await fetch('/api/cloud/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            externalUrl: isDemoMode ? item.baseUrl : (item.baseUrl + "=w2048-h1024"),
            filename: item.filename || `Imported_Photo_${item.id}.jpg`,
            provider: selectedProvider.id,
            mimeType: item.mimeType
          })
        });

        if (response.ok) successCount++;
      } catch (e) {
        console.error("Error importando:", item.id, e);
      }
      setImportProgress(Math.round(((i + 1) / itemsToImport.length) * 100));
    }

    await unlockAchievement(user.id, 'migration_master');
    toast({ 
      title: "Importación Exitosa", 
      description: `${successCount} fotos ahora están guardadas físicamente en tu servidor.` 
    });
    setIsImporting(false);
    setShowPicker(false);
    setSelectedCloudIds(new Set());
    setIsDemoMode(false);
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedCloudIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCloudIds(next);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-12 animate-fade-in pb-24">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className="bg-primary/20 text-primary border-none font-black text-[10px] uppercase tracking-widest px-4 py-1 rounded-full">Trae tus recuerdos a casa</Badge>
              <div className="h-px w-12 bg-white/10" />
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white font-headline tracking-tighter">
              Nexo de <span className="text-primary">Migración</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
              Descarga tus fotos desde nubes públicas como Google o iCloud directamente a tu propio disco duro. Es la forma más fácil de ser dueño de tu contenido.
            </p>
          </div>
          
          <Button 
            variant="outline" 
            className="rounded-2xl border-white/10 bg-white/5 h-14 px-6 text-white hover:bg-white/10"
            onClick={() => setShowConfig(true)}
          >
            <Settings2 className="h-5 w-5 mr-2 text-primary" /> Configurar Pro
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROVIDERS.map((provider) => {
            const isConnected = provider.id === 'google' ? !!googleToken : false;
            return (
              <Card 
                key={provider.id} 
                className={cn(
                  "bg-card/40 border-white/5 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:border-primary/30 group",
                  isConnected && "border-primary/20 bg-primary/5"
                )}
              >
                <CardContent className="p-8 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className={cn("p-4 rounded-2xl bg-white/5", provider.color)}>
                      <provider.icon className="h-8 w-8" />
                    </div>
                    {isConnected && (
                      <Badge className="bg-green-500/20 text-green-400 border-none px-3 py-1 flex items-center gap-1.5 animate-pulse">
                        <ShieldCheck className="h-3 w-3" /> Listo
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white font-headline">{provider.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{provider.description}</p>
                  </div>

                  <div className="pt-4 space-y-3">
                    {isConnected ? (
                      <Button 
                        onClick={() => handleImportStart(provider)}
                        className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-lg group/btn"
                      >
                        Ver mis fotos <ArrowRight className="ml-2 h-5 w-5 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    ) : (
                      <>
                        <Button 
                          variant="outline"
                          onClick={provider.id === 'google' ? handleConnectGoogle : () => toast({ title: "Próximamente", description: "Estamos trabajando para habilitar esta conexión." })}
                          disabled={isConnecting === provider.id}
                          className="w-full h-14 rounded-2xl border-white/10 bg-white/5 text-white font-bold hover:bg-white/10"
                        >
                          {isConnecting === provider.id ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Conectando...</>
                          ) : (
                            <>Conectar ahora</>
                          )}
                        </Button>
                        <button 
                          onClick={handleStartDemo}
                          className="w-full text-[10px] text-muted-foreground uppercase font-black tracking-widest hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                          <Sparkles className="h-3 w-3" /> Probar con fotos de ejemplo
                        </button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* DIÁLOGO DE CONFIGURACIÓN SIMPLIFICADO */}
        <Dialog open={showConfig} onOpenChange={setShowConfig}>
          <DialogContent className="max-w-2xl bg-[#0a0a0c] border-white/10 rounded-[3rem] p-0 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">Configuración del Puente</DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">Activa la conexión real con tu cuenta de Google.</DialogDescription>
              </div>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="bg-primary/5 border border-primary/20 rounded-[2rem] p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</div>
                  <p className="font-bold text-white">¿Por qué necesito esto?</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pl-11">
                  Por tu seguridad, PixelSphere no usa servidores intermedios. Tú eres el dueño de la conexión. Para que Google te reconozca, necesitas poner tu propia "Llave de Identidad" aquí debajo.
                </p>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Tu Llave de Identidad (Client ID)</Label>
                <Input 
                  placeholder="Ej. 12345678-abcde.apps.googleusercontent.com" 
                  className="h-14 bg-white/5 border-white/10 rounded-2xl text-white font-mono text-xs px-6"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                />
              </div>

              <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen} className="space-y-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between h-10 text-muted-foreground hover:text-white px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <HelpCircle className="h-3 w-3" /> ¿Cómo obtengo mi llave? (Instrucciones)
                    </span>
                    {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-4 text-xs text-muted-foreground leading-relaxed">
                    <p>1. Entra a <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-primary underline">Google Cloud</a> y crea un proyecto.</p>
                    <p>2. Busca "Credenciales" y elige <strong>ID de cliente de OAuth</strong> (Web).</p>
                    <p>3. En "Orígenes" y "Redireccionamiento" pega la dirección de esta página: <code className="bg-white/5 px-2 py-0.5 rounded text-white">{clientOrigin || 'https://tu-dominio.com'}/bridge</code></p>
                    <p>4. Copia el ID que te den y pégalo arriba.</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="p-6 bg-white/[0.02] border-t border-white/5 flex gap-3">
              <Button variant="ghost" onClick={() => setShowConfig(false)} className="flex-1 rounded-xl text-white">Cancelar</Button>
              <Button onClick={saveClientId} disabled={!googleClientId} className="flex-[2] bg-primary text-white rounded-xl font-bold h-12 shadow-lg shadow-primary/20">
                Guardar y Activar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Picker de Archivos Real o Demo */}
        <Dialog open={showPicker} onOpenChange={(o) => !o && !isImporting && setShowPicker(false)}>
          <DialogContent className="max-w-4xl bg-[#0a0a0c] border-white/10 rounded-[3rem] shadow-2xl p-0 overflow-hidden">
            <div className="p-8 border-b border-white/5 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                    {isDemoMode ? (
                      <Sparkles className="h-6 w-6 text-accent" />
                    ) : (
                      selectedProvider?.icon && <selectedProvider.icon className={cn("h-6 w-6", selectedProvider.color)} />
                    )}
                    {isDemoMode ? "Puente de Cortesía" : `Mis fotos en ${selectedProvider?.name || 'Nube'}`}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-muted-foreground text-[10px] uppercase font-black tracking-[0.2em]">
                  {selectedCloudIds.size} elementos elegidos para guardar de verdad
                </DialogDescription>
              </div>
              
              {!isImporting && (
                <Button onClick={executeImport} disabled={selectedCloudIds.size === 0} className="bg-primary text-white rounded-2xl h-12 px-8 font-bold shadow-xl shadow-primary/20">
                  Importar ahora
                </Button>
              )}
            </div>

            <div className="p-8 min-h-[400px]">
              {isImporting ? (
                <div className="flex flex-col items-center justify-center h-full py-20 space-y-8 animate-slide-up">
                  <div className="relative">
                    <RefreshCw className="h-24 w-24 text-primary animate-spin" />
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                  </div>
                  <div className="text-center space-y-4 w-full max-w-sm">
                    <h3 className="text-xl font-bold text-white">Guardando archivos en tu servidor...</h3>
                    <Progress value={importProgress} className="h-2 bg-white/5" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">{importProgress}% Completado</p>
                  </div>
                </div>
              ) : isLoadingCloud ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-white/5 rounded-3xl animate-pulse flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-white/10" />
                    </div>
                  ))}
                </div>
              ) : cloudItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                  <ImageIcon className="h-12 w-12" />
                  <p className="text-xs uppercase font-bold tracking-widest">No hay nada en esta cuenta.</p>
                </div>
              ) : (
                <ScrollArea className="h-[450px]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    {cloudItems.map((item) => {
                      const isSelected = selectedCloudIds.has(item.id);
                      return (
                        <div 
                          key={item.id} 
                          onClick={() => toggleSelection(item.id)}
                          className={cn(
                            "group relative aspect-square rounded-[2rem] overflow-hidden bg-white/5 border border-white/5 cursor-pointer transition-all duration-300",
                            isSelected ? "ring-4 ring-primary border-primary scale-95" : "hover:border-primary/50"
                          )}
                        >
                          <img 
                            src={isDemoMode ? item.baseUrl : (item.baseUrl + "=w400-h400")} 
                            className="w-full h-full object-cover transition-all duration-700" 
                            alt="" 
                          />
                          <div className={cn(
                            "absolute top-4 right-4 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                            isSelected ? "bg-primary border-primary" : "border-white/20 bg-black/40"
                          )}>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                            <p className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{item.filename}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end">
              <Button variant="ghost" onClick={() => !isImporting && setShowPicker(false)} disabled={isImporting} className="rounded-xl text-white">
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
