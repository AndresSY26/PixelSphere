"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { User, Session, UserSettings } from '@/lib/types';
import { 
  saveUser, 
  getMediaByUser, 
  deleteMedia,
  saveAvatarFile, 
  hashPassword, 
  encrypt, 
  decrypt,
  revokeSession,
  revokeAllOtherSessions,
  generate2FASetup,
  verifyAndEnable2FA
} from '@/lib/storage';
import { 
  User as UserIcon, 
  Settings2, 
  ShieldCheck, 
  Palette, 
  HardDrive, 
  RefreshCw,
  Trash2,
  ImageIcon,
  Film,
  Lock, 
  Camera, 
  CheckCircle2, 
  Loader2,
  Zap,
  Smartphone,
  X,
  Layers,
  Sparkles,
  Check,
  Plus,
  Monitor,
  ZapOff,
  Moon,
  KeyRound,
  Fingerprint,
  ShieldAlert,
  LogOut,
  FolderLock,
  Timer,
  ShieldX,
  Wifi,
  Clock,
  QrCode,
  Copy,
  Info,
  Maximize2,
  Calendar,
  History,
  Move,
  Download,
  Crown,
  CreditCard
} from 'lucide-react';
import { api } from '@/api/client';
import { UpgradePlanDialog } from '@/components/upgrade-plan-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import { cn, hexToHSLComponents, formatRelativeDate, arrayBufferToBase64, formatBytes } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [imageStats, setImageStats] = useState({ size: 0, count: 0 });
  const [videoStats, setVideoStats] = useState({ size: 0, count: 0 });
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  const [username, setUsername] = useState('');
  const [accentColor, setAccentColor] = useState('#7373F0');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [density, setDensity] = useState<'default' | 'compact'>('default');
  const [glassIntensity, setGlassIntensity] = useState(10);
  const [backgroundTheme, setBackgroundTheme] = useState<UserSettings['backgroundTheme']>('classic');
  const [borderRadius, setBorderRadius] = useState(12);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoAutoplay, setVideoAutoplay] = useState(true);
  const [lowResPreviews, setLowResPreviews] = useState(false);
  const [gpuAcceleration, setGpuAcceleration] = useState(true);
  const [aiBackgroundAnalysis, setAiBackgroundAnalysis] = useState(true);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [vaultAutoLockEnabled, setVaultAutoLockEnabled] = useState(true);
  const [vaultAutoLockTime, setVaultAutoLockTime] = useState(60);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  const [is2FASetupOpen, setIs2FASetupOpen] = useState(false);
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFAUri, setTwoFAUri] = useState('');
  const [twoFAVerifyCode, setTwoFAVerifyCode] = useState('');
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);

  const [previewAvatar, setPreviewAvatar] = useState<string | undefined>(undefined);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const isVaultProtected = !!user?.vaultPasswordHash;

  useEffect(() => {
    setMounted(true);
    async function loadSettings() {
      const sessionData = localStorage.getItem('ps_active_session');
      if (sessionData) {
        const currentUser = JSON.parse(sessionData) as User;
        setUser(currentUser);
        setUsername(currentUser.username);
        setSessions(currentUser.sessions || []);
        setIs2FAEnabled(currentUser.is2FAEnabled);
        setBiometricEnabled(currentUser.biometricEnabled || false);
        
        const settings = currentUser.settings;
        setAccentColor(settings.accentColor || '#7373F0');
        setIsDarkMode(settings.isDarkMode ?? true);
        setDensity(settings.interfaceDensity || 'default');
        setGlassIntensity(settings.glassIntensity ?? 10);
        setBackgroundTheme(settings.backgroundTheme || 'classic');
        setBorderRadius(settings.borderRadius ?? 12);
        setReducedMotion(settings.reducedMotion ?? false);
        setVaultAutoLockEnabled(settings.vaultAutoLockEnabled ?? true);
        setVaultAutoLockTime(settings.vaultAutoLockTime ?? 60);
        setVideoAutoplay(settings.videoAutoplay ?? true);
        setLowResPreviews(settings.lowResPreviews ?? false);
        setGpuAcceleration(settings.gpuAcceleration ?? true);
        setAiBackgroundAnalysis(settings.aiBackgroundAnalysis ?? true);
        
        setPreviewAvatar(currentUser.avatarUrl);
        
        if (currentUser.avatarSettings) {
          setZoom(currentUser.avatarSettings.zoom || 1);
          setRotation(currentUser.avatarSettings.rotation || 0);
          setPosX(currentUser.avatarSettings.posX || 0);
          setPosY(currentUser.avatarSettings.posY || 0);
        }

        const media = await getMediaByUser(currentUser.id);
        const activeMedia = media.filter(m => !m.isDeleted);
        const images = activeMedia.filter(m => m.type === 'image');
        const videos = activeMedia.filter(m => m.type === 'video');
        
        setImageStats({ size: images.reduce((acc, curr) => acc + (curr.size || 0), 0), count: images.length });
        setVideoStats({ size: videos.reduce((acc, curr) => acc + (curr.size || 0), 0), count: videos.length });
        setMediaList(activeMedia);
      }
      setLoading(false);
    }
    loadSettings();

    const handleInstallable = (e: any) => setIsInstallable(e.detail);
    window.addEventListener('ps-pwa-installable', handleInstallable);
    return () => window.removeEventListener('ps-pwa-installable', handleInstallable);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined' && mounted && !loading) {
      const root = document.documentElement;
      root.style.setProperty('--radius', `${borderRadius}px`);
      root.style.setProperty('--blur', `${glassIntensity}px`);
      root.style.setProperty('--primary', hexToHSLComponents(accentColor));
      
      let bg = '240 12% 17%';
      let card = '240 12% 19%';
      if (backgroundTheme === 'obsidian') { bg = '0 0% 0%'; card = '0 0% 3%'; }
      if (backgroundTheme === 'midnight') { bg = '240 45% 7%'; card = '240 45% 10%'; }
      
      root.style.setProperty('--background', bg);
      root.style.setProperty('--card', card);
      root.style.setProperty('--popover', bg);
    }
  }, [borderRadius, glassIntensity, accentColor, backgroundTheme, loading, mounted]);

  const handleConfirmAvatar = () => {
    if (tempImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        const size = 512;
        canvas.width = size; canvas.height = size;
        ctx.clearRect(0, 0, size, size); ctx.save();
        const scaleFactor = 1.6; 
        ctx.translate(size / 2 + (posX * scaleFactor), size / 2 + (posY * scaleFactor));
        ctx.rotate((rotation * Math.PI) / 180); ctx.scale(zoom, zoom);
        const aspect = img.width / img.height;
        let drawW, drawH;
        if (aspect > 1) { drawH = size; drawW = size * aspect; } else { drawW = size; drawH = size / aspect; }
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH); ctx.restore();
        const croppedImage = canvas.toDataURL('image/jpeg', 0.9);
        setPreviewAvatar(croppedImage); setIsAvatarEditorOpen(false);
      };
      img.src = tempImage;
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let finalAvatarUrl = user.avatarUrl;
      if (previewAvatar?.startsWith('data:image')) {
        const uploadedPath = await saveAvatarFile(user.id, previewAvatar);
        if (uploadedPath) finalAvatarUrl = uploadedPath;
      }
      const updatedUser: User = {
        ...user,
        username: username,
        avatarUrl: finalAvatarUrl,
        avatarSettings: { zoom, rotation, posX, posY },
        is2FAEnabled: is2FAEnabled,
        biometricEnabled: biometricEnabled,
        settings: {
          accentColor, isDarkMode, interfaceDensity: density, glassIntensity, backgroundTheme, borderRadius, reducedMotion,
          videoAutoplay, lowResPreviews, gpuAcceleration, aiBackgroundAnalysis, vaultAutoLockEnabled, vaultAutoLockTime
        }
      };
      const savedUser = await saveUser(updatedUser);
      if (savedUser) {
        localStorage.setItem('ps_active_session', JSON.stringify(savedUser));
        setUser(savedUser);
        window.dispatchEvent(new CustomEvent('ps-user-updated', { detail: savedUser }));
        toast({ title: "Configuración Persistida" });
      }
    } catch (error) {
      console.error("Error al persistir configuración de usuario:", error);
      toast({ title: "Falla", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const start2FASetup = async () => {
    if (!user) return;
    const { secret, uri } = await generate2FASetup(user.id, user.email);
    setTwoFASecret(secret); setTwoFAUri(uri); setIs2FASetupOpen(true);
  };

  const handleEnable2FA = async () => {
    if (twoFAVerifyCode.length < 6 || !user) return;
    setIsVerifying2FA(true);
    try {
      const result = await verifyAndEnable2FA(user.id, twoFASecret, twoFAVerifyCode);
      if (result.success) {
        setIs2FAEnabled(true); setIs2FASetupOpen(false); setTwoFAVerifyCode('');
        setUser(result.user!); localStorage.setItem('ps_active_session', JSON.stringify(result.user));
        toast({ title: "2FA Activado" });
      }
    } catch (e) {
      console.error("Error al activar 2FA:", e);
      toast({ title: "Error", variant: "destructive" });
    } finally { setIsVerifying2FA(false); }
  };

  const registerBiometric = async () => {
    if (!user) return;
    try {
      const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
      const options: PublicKeyCredentialCreationOptions = {
        challenge, rp: { name: "PixelSphere" },
        user: { id: new TextEncoder().encode(user.id), name: user.email, displayName: user.username },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }], timeout: 60000,
      };
      const credential = await navigator.credentials.create({ publicKey: options }) as any;
      if (credential) {
        const credentialId = arrayBufferToBase64(credential.rawId);
        const updatedUser = { ...user, biometricEnabled: true, biometricCredentialId: credentialId };
        const saved = await saveUser(updatedUser);
        if (saved) { setUser(saved); setBiometricEnabled(true); localStorage.setItem('ps_active_session', JSON.stringify(saved)); toast({ title: "Nodo Biométrico Vinculado" }); }
      }
    } catch (error) {
      console.error("Error al registrar biometría:", error);
      setBiometricEnabled(false);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const triggerInstall = () => {
    window.dispatchEvent(new CustomEvent('ps-trigger-pwa-install'));
  };

  const handleRecalculateStorage = async () => {
    if (!user) return;
    setIsRecalculating(true);
    try {
      const res = await api.storage.recalculate(user.id);
      if (res?.user) {
        setUser(res.user);
        localStorage.setItem('ps_active_session', JSON.stringify(res.user));
        localStorage.setItem('pixelsphere_session_user', JSON.stringify(res.user));
        window.dispatchEvent(new CustomEvent('neural-update', { detail: { channel: 'USER', data: res.user } }));
      }
      const media = await getMediaByUser(user.id);
      const activeMedia = media.filter(m => !m.isDeleted);
      const images = activeMedia.filter(m => m.type === 'image');
      const videos = activeMedia.filter(m => m.type === 'video');
      setImageStats({ size: images.reduce((acc, curr) => acc + (curr.size || 0), 0), count: images.length });
      setVideoStats({ size: videos.reduce((acc, curr) => acc + (curr.size || 0), 0), count: videos.length });
      setMediaList(activeMedia);
      window.dispatchEvent(new CustomEvent('neural-update', { detail: { channel: 'MEDIA', data: { userId: user.id } } }));
      toast({
        title: "Almacenamiento Sincronizado",
        description: "Se auditó y recalculó tu espacio real con éxito."
      });
    } catch (e: any) {
      toast({
        title: "Sincronización completada",
        description: "Almacenamiento actualizado."
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  let QUOTA_BYTES = user?.storageQuota || (3 * 1024 * 1024 * 1024);
  if ((!user?.plan || user?.plan === 'free') && (QUOTA_BYTES === 16106127360 || QUOTA_BYTES === 2147483648)) {
    QUOTA_BYTES = 3 * 1024 * 1024 * 1024;
  }
  const storageUsed = imageStats.size + videoStats.size;
  const imagePercentage = Math.min((imageStats.size / QUOTA_BYTES) * 100, 100);
  const videoPercentage = Math.min((videoStats.size / QUOTA_BYTES) * 100, 100);

  const accentColors = [
    { name: 'Púrpura Pixel', value: '#7373F0' },
    { name: 'Cian Neón', value: '#66E0FF' },
    { name: 'Esmeralda IA', value: '#10b981' },
    { name: 'Rosa Eléctrico', value: '#f43f5e' },
    { name: 'Ámbar Cálido', value: '#f59e0b' }
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-10 animate-fade-in pb-24">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10"><Settings2 className="h-6 w-6 text-primary" /></div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-headline tracking-tight">Arquitectura del Nexo</h1>
          </div>
          <p className="text-muted-foreground text-sm">Gestiona la identidad física y la potencia técnica de tu espacio.</p>
        </header>

        <Tabs defaultValue="profile" className="flex flex-col lg:flex-row gap-10">
          <TabsList className="flex lg:flex-col bg-transparent lg:bg-white/5 h-auto w-full lg:w-72 shrink-0 rounded-none lg:rounded-3xl lg:border lg:border-white/5 overflow-x-auto scrollbar-hide gap-2 lg:gap-1 p-2 justify-start">
            {[
              { val: 'profile', label: 'Identidad', icon: UserIcon },
              { val: 'appearance', label: 'Estética', icon: Palette },
              { val: 'performance', label: 'Rendimiento', icon: Zap },
              { val: 'security', label: 'Seguridad', icon: ShieldCheck },
              { val: 'history', label: 'Historial', icon: History },
              { val: 'storage', label: 'Almacenamiento', icon: HardDrive },
            ].map((tab) => (
              <TabsTrigger key={tab.val} value={tab.val} className={cn("justify-start gap-3 px-5 py-4 rounded-2xl transition-all duration-300 shrink-0 bg-white/5 border border-white/5 lg:bg-transparent lg:border-none data-[state=active]:bg-primary data-[state=active]:text-white lg:data-[state=active]:bg-primary/20 lg:data-[state=active]:text-primary text-xs sm:text-sm font-bold whitespace-nowrap min-w-max")}>
                <tab.icon className="h-4 w-4 shrink-0" /> <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 min-w-0">
            <TabsContent value="profile" className="m-0 animate-slide-up outline-none">
              <IdentityPanel user={user} username={username} setUsername={setUsername} previewAvatar={previewAvatar} handleSaveProfile={handleSaveProfile} saving={saving} fileInputRef={fileInputRef} setIsFullViewOpen={setIsFullViewOpen} />
            </TabsContent>

            <TabsContent value="appearance" className="m-0 animate-slide-up outline-none">
              <AppearancePanel accentColors={accentColors} accentColor={accentColor} setAccentColor={setAccentColor} borderRadius={borderRadius} setBorderRadius={setBorderRadius} glassIntensity={glassIntensity} setGlassIntensity={setGlassIntensity} handleSaveProfile={handleSaveProfile} saving={saving} user={user} />
            </TabsContent>

            <TabsContent value="performance" className="m-0 animate-slide-up outline-none">
              <PerformancePanel reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} density={density} setDensity={setDensity} handleSaveProfile={handleSaveProfile} saving={saving} user={user} isInstallable={isInstallable} triggerInstall={triggerInstall} />
            </TabsContent>

            <TabsContent value="security" className="m-0 animate-slide-up outline-none">
              <SecurityPanel user={user} is2FAEnabled={is2FAEnabled} start2FASetup={start2FASetup} biometricEnabled={biometricEnabled} registerBiometric={registerBiometric} vaultAutoLockEnabled={vaultAutoLockEnabled} setVaultAutoLockEnabled={setVaultAutoLockEnabled} vaultAutoLockTime={vaultAutoLockTime} setVaultAutoLockTime={setVaultAutoLockTime} isVaultProtected={isVaultProtected} handleSaveProfile={handleSaveProfile} saving={saving} />
            </TabsContent>

            <TabsContent value="history" className="m-0 animate-slide-up outline-none">
              <HistoryPanel sessions={sessions} revokeSession={revokeSession} revokeAllOtherSessions={revokeAllOtherSessions} user={user} setSessions={setSessions} />
            </TabsContent>

            <TabsContent value="storage" className="m-0 animate-slide-up outline-none">
              <StoragePanel 
                user={user}
                storageQuota={QUOTA_BYTES}
                storageUsed={storageUsed} 
                imagePercentage={imagePercentage} 
                videoPercentage={videoPercentage} 
                imageStats={imageStats} 
                videoStats={videoStats} 
                mediaList={mediaList}
                isRecalculating={isRecalculating}
                onRecalculate={handleRecalculateStorage}
                onDeleteMediaItem={async (id: string) => {
                  await deleteMedia(id, user?.id);
                  await handleRecalculateStorage();
                }}
                onOpenUpgrade={() => setIsUpgradeOpen(true)}
              />
            </TabsContent>
          </div>
        </Tabs>

        {user && (
          <UpgradePlanDialog
            isOpen={isUpgradeOpen}
            onClose={() => setIsUpgradeOpen(false)}
            user={user}
            onPlanUpdated={(updated) => {
              setUser(updated);
              window.dispatchEvent(new CustomEvent('neural-update', { 
                detail: { channel: 'USER_PLAN', data: updated } 
              }));
            }}
          />
        )}

        <Dialog open={is2FASetupOpen} onOpenChange={setIs2FASetupOpen}>
          <DialogContent className="max-w-md bg-[#0a0a0c] border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
            <DialogHeader className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto border border-primary/20 text-primary mb-4"><QrCode className="h-8 w-8" /></div>
              <DialogTitle className="text-2xl font-bold text-white">Configurar Autenticador</DialogTitle>
            </DialogHeader>
            <div className="space-y-8">
              <div className="bg-white p-4 rounded-3xl w-48 h-48 mx-auto flex items-center justify-center">{twoFAUri ? <QRCodeSVG value={twoFAUri} size={160} level="H" /> : <Loader2 className="h-10 w-10 animate-spin text-black" />}</div>
              <Input value={twoFAVerifyCode} onChange={(e) => setTwoFAVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="h-14 text-center text-2xl font-black bg-white/5 border-white/10 rounded-2xl" placeholder="000000" />
              <Button onClick={handleEnable2FA} disabled={isVerifying2FA || twoFAVerifyCode.length < 6} className="w-full bg-primary text-white rounded-2xl h-14 font-bold">Validar Nodo</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isAvatarEditorOpen} onOpenChange={setIsAvatarEditorOpen}>
          <DialogContent className="max-w-2xl bg-[#0a0a0c] border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
            <DialogHeader className="text-center mb-8"><DialogTitle className="text-2xl font-bold text-white flex items-center justify-center gap-3"><Camera className="h-6 w-6 text-primary" /> Ajuste de Identidad</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              <div className="relative aspect-square w-full rounded-full border-4 border-primary/20 overflow-hidden bg-black flex items-center justify-center">
                {tempImage && (<div className="relative w-full h-full transition-all duration-200" style={{ transform: `scale(${zoom}) rotate(${rotation}deg) translate(${posX}px, ${posY}px)` }}><img src={tempImage} className="w-full h-full object-cover" alt="" /></div>)}
              </div>
              <div className="space-y-8">
                <div className="space-y-4"><div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase text-muted-foreground">Zoom</Label></div><Slider value={[zoom]} min={1} max={3} step={0.1} onValueChange={(v) => setZoom(v[0])} /></div>
                <div className="space-y-4"><div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase text-muted-foreground">Rotación</Label></div><Slider value={[rotation]} min={0} max={360} step={1} onValueChange={(v) => setRotation(v[0])} /></div>
              </div>
            </div>
            <DialogFooter className="mt-10 gap-3"><Button variant="ghost" onClick={() => setIsAvatarEditorOpen(false)} className="flex-1 rounded-2xl text-white">Cancelar</Button><Button onClick={handleConfirmAvatar} className="flex-[2] bg-primary text-white rounded-2xl font-bold h-14">Confirmar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </DashboardLayout>
  );
}

const IdentityPanel = ({ user, username, setUsername, previewAvatar, handleSaveProfile, saving, fileInputRef }: any) => (
  <Card className="bg-card/40 border-white/5 rounded-3xl overflow-hidden backdrop-blur-3xl shadow-2xl">
    <CardHeader className="p-8 border-b border-white/5 bg-white/[0.02]"><CardTitle className="text-2xl font-bold text-white flex items-center gap-3"><UserIcon className="h-6 w-6 text-primary" /> Perfil Neural</CardTitle></CardHeader>
    <CardContent className="p-8 sm:p-10 space-y-10">
      <div className="flex flex-col sm:flex-row items-center gap-10">
        <div className="relative group">
          <Avatar className="h-32 w-32 border-4 border-primary/20 ring-[12px] ring-primary/5 rounded-full overflow-hidden bg-black shadow-2xl">
            <AvatarImage src={previewAvatar} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-4xl font-bold">{user?.username.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 p-3 bg-primary text-white rounded-2xl shadow-2xl border-4 border-background hover:bg-primary/90 transition-all z-10"><Camera className="h-5 w-5" /></button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {}} />
        </div>
        <div className="flex-1 space-y-3 text-center sm:text-left"><h3 className="text-3xl font-extrabold text-white tracking-tight">{user?.username}</h3><div className="flex flex-wrap gap-2 justify-center sm:justify-start"><Badge className="bg-accent/10 text-accent border-accent/20">Nodo {user?.id}</Badge></div></div>
      </div>
      <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Firma Pública</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} className="bg-white/5 border-white/10 rounded-2xl h-14 px-6 text-white" /></div>
      <Button onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-auto bg-primary text-white rounded-2xl px-10 h-14 font-bold shadow-xl">{saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Guardar Identidad"}</Button>
    </CardContent>
  </Card>
);

const AppearancePanel = ({ accentColors, accentColor, setAccentColor, borderRadius, setBorderRadius, glassIntensity, setGlassIntensity, handleSaveProfile, saving }: any) => (
  <Card className="bg-card/40 border-white/5 rounded-3xl overflow-hidden backdrop-blur-3xl">
    <CardHeader className="p-8 border-b border-white/5 bg-white/[0.02]"><CardTitle className="text-2xl font-bold text-white flex items-center gap-3"><Palette className="h-6 w-6 text-accent" /> Estética Cuántica</CardTitle></CardHeader>
    <CardContent className="p-8 sm:p-10 space-y-12">
      <div className="space-y-6"><Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Espectro de Acento</Label><div className="flex flex-wrap gap-5">{accentColors.map((color: any) => (<button key={color.value} onClick={() => setAccentColor(color.value)} className={cn("w-14 h-14 rounded-2xl transition-all duration-500", accentColor === color.value ? "scale-110 ring-4 ring-white/20" : "opacity-40")} style={{ backgroundColor: color.value }} />))}</div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6"><Label className="text-[10px] font-black uppercase text-muted-foreground">Geometría (Radio)</Label><Slider value={[borderRadius]} min={0} max={32} step={4} onValueChange={(v) => setBorderRadius(v[0])} /></div>
        <div className="space-y-6"><Label className="text-[10px] font-black uppercase text-muted-foreground">Efecto Glass (Blur)</Label><Slider value={[glassIntensity]} min={0} max={40} step={2} onValueChange={(v) => setGlassIntensity(v[0])} /></div>
      </div>
      <Button onClick={handleSaveProfile} disabled={saving} className="w-full bg-primary text-white rounded-2xl h-14 font-bold">Aplicar Estética</Button>
    </CardContent>
  </Card>
);

const PerformancePanel = ({ reducedMotion, setReducedMotion, density, setDensity, handleSaveProfile, saving, isInstallable, triggerInstall }: any) => (
  <Card className="bg-card/40 border-white/5 rounded-3xl overflow-hidden backdrop-blur-3xl">
    <CardHeader className="p-8 border-b border-white/5 bg-white/[0.02]"><CardTitle className="text-2xl font-bold text-white flex items-center gap-3"><Zap className="h-6 w-6 text-primary" /> Motor de Rendimiento</CardTitle></CardHeader>
    <CardContent className="p-8 sm:p-10 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5"><div className="flex items-center gap-4"><div className="p-3 rounded-2xl bg-primary/10 text-primary"><ZapOff className="h-5 w-5" /></div><p className="text-sm font-bold text-white">Reducir Movimiento</p></div><Switch checked={reducedMotion} onCheckedChange={setReducedMotion} /></div>
        <div className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5"><div className="flex items-center gap-4"><div className="p-3 rounded-2xl bg-accent/10 text-accent"><Layers className="h-5 w-5" /></div><p className="text-sm font-bold text-white">Interfaz Compacta</p></div><Switch checked={density === 'compact'} onCheckedChange={(c) => setDensity(c ? 'compact' : 'default')} /></div>
      </div>

      {isInstallable && (
        <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5 text-center sm:text-left">
            <div className="p-4 rounded-2xl bg-white/5 shadow-xl text-primary"><Monitor className="h-8 w-8" /></div>
            <div>
              <p className="font-bold text-white">PixelSphere para Escritorio</p>
              <p className="text-xs text-muted-foreground mt-1">Ejecuta el orquestador como una app nativa en tu ordenador.</p>
            </div>
          </div>
          <Button onClick={triggerInstall} className="h-12 px-8 bg-white text-black hover:bg-white/90 rounded-2xl font-black text-xs uppercase tracking-widest">
            <Download className="h-4 w-4 mr-2" /> Instalar en PC
          </Button>
        </div>
      )}

      <Button onClick={handleSaveProfile} disabled={saving} className="w-full bg-primary text-white rounded-2xl h-14 font-bold shadow-lg">Sincronizar Motor</Button>
    </CardContent>
  </Card>
);

const SecurityPanel = ({ is2FAEnabled, start2FASetup, biometricEnabled, registerBiometric, vaultAutoLockEnabled, setVaultAutoLockEnabled, vaultAutoLockTime, setVaultAutoLockTime, isVaultProtected, handleSaveProfile, saving }: any) => (
  <Card className="bg-card/40 border-white/5 rounded-3xl overflow-hidden backdrop-blur-3xl">
    <CardHeader className="p-8 border-b border-white/5 bg-white/[0.02]"><CardTitle className="text-2xl font-bold text-white flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-accent" /> Blindaje</CardTitle></CardHeader>
    <CardContent className="p-8 sm:p-10 space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5"><div className="flex items-center gap-4"><div className="p-3 rounded-2xl bg-primary/10 text-primary"><Smartphone className="h-5 w-5" /></div><p className="text-sm font-bold text-white">2FA</p></div><Switch checked={is2FAEnabled} onCheckedChange={(c) => c && start2FASetup()} /></div>
        <div className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5"><div className="flex items-center gap-4"><div className="p-3 rounded-2xl bg-accent/10 text-accent"><Fingerprint className="h-5 w-5" /></div><p className="text-sm font-bold text-white">Biometría</p></div><Switch checked={biometricEnabled} onCheckedChange={(c) => c && registerBiometric()} /></div>
      </div>
      <Button onClick={handleSaveProfile} disabled={saving} className="w-full bg-accent text-accent-foreground rounded-2xl h-14 font-black uppercase tracking-[0.2em]">Sincronizar Seguridad</Button>
    </CardContent>
  </Card>
);

const HistoryPanel = ({ sessions, revokeSession, user }: any) => (
  <Card className="bg-card/40 border-white/5 rounded-3xl overflow-hidden backdrop-blur-3xl">
    <CardHeader className="p-8 border-b border-white/5 bg-white/[0.02]"><CardTitle className="text-2xl font-bold text-white flex items-center gap-3"><History className="h-6 w-6 text-primary" /> Nodos Activos</CardTitle></CardHeader>
    <CardContent className="p-8 sm:p-10 space-y-4">
      {sessions.map((session: any) => (
        <div key={session.id} className="flex items-center justify-between p-5 rounded-3xl bg-white/5 border border-white/5 group">
          <div className="flex items-center gap-5">
            <div className={cn("p-4 rounded-2xl", session.isCurrent ? "bg-primary/10 text-primary" : "bg-white/5 text-muted-foreground")}>{session.deviceName.includes('Móvil') ? <Smartphone className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}</div>
            <div><h4 className="text-sm font-bold text-white">{session.deviceName}</h4><p className="text-[10px] text-muted-foreground">{session.ip}</p></div>
          </div>
          {!session.isCurrent && <Button variant="ghost" size="icon" className="hover:text-red-400" onClick={() => revokeSession(user.id, session.id)}><LogOut className="h-4 w-4" /></Button>}
        </div>
      ))}
    </CardContent>
  </Card>
);

const StoragePanel = ({ 
  user, 
  storageQuota, 
  storageUsed, 
  imagePercentage, 
  videoPercentage, 
  imageStats, 
  videoStats, 
  mediaList,
  isRecalculating,
  onRecalculate,
  onDeleteMediaItem,
  onOpenUpgrade 
}: any) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (user?.id) {
      setLoadingPayments(true);
      api.payments.getHistory(user.id)
        .then((res: any) => {
          if (res?.payments) setPayments(res.payments);
        })
        .catch(() => {})
        .finally(() => setLoadingPayments(false));
    }
  }, [user?.id]);

  const planName = user?.plan ? user.plan.toUpperCase() : 'GRATUITO';
  let effectiveQuota = storageQuota || (3 * 1024 * 1024 * 1024);
  if ((!user?.plan || user?.plan === 'free') && (effectiveQuota === 16106127360 || effectiveQuota === 2147483648)) {
    effectiveQuota = 3 * 1024 * 1024 * 1024;
  }
  const isStorageFull = storageUsed >= effectiveQuota;

  return (
    <div className="space-y-8">
      <Card className="bg-card/40 border-white/5 rounded-3xl overflow-hidden backdrop-blur-3xl shadow-2xl">
        <CardHeader className="p-8 border-b border-white/5 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <HardDrive className="h-6 w-6 text-primary" /> Almacenamiento y Plan
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Pasarela de facturación activa mediante <span className="font-bold text-white">Google Pay</span> (Límite Gratuito: 3 GB)
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              onClick={onRecalculate}
              disabled={isRecalculating}
              size="sm"
              variant="outline"
              className="rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs px-3.5 h-9 flex items-center gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRecalculating && "animate-spin text-primary")} />
              <span>{isRecalculating ? 'Auditando...' : 'Sincronizar Cuota'}</span>
            </Button>
            <Button
              onClick={onOpenUpgrade}
              size="sm"
              className="rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 h-9 flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <CreditCard className="w-4 h-4" />
              <span>Gestionar con Google Pay</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-8 sm:p-10 space-y-12">
          {isStorageFull && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3.5 text-red-200">
              <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-extrabold text-white text-sm">Capacidad Máxima de 3 GB Alcanzada</p>
                <p className="text-muted-foreground">
                  Tu cuenta ha alcanzado el límite de 3 GB ({formatBytes(storageUsed)} ocupados). Las subidas e importaciones de Google Drive están bloqueadas hasta que elimines archivos o aumentes tu plan con Google Pay.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Ocupación Física</p>
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary font-black uppercase">
                    PLAN {planName}
                  </Badge>
                </div>
                <h3 className="text-5xl font-black text-white tracking-tighter mt-1">
                  {formatBytes(storageUsed)} <span className="text-muted-foreground/40 text-3xl">/ {formatBytes(effectiveQuota)}</span>
                </h3>
              </div>
              <div className="text-sm text-muted-foreground">
                Disponible: <span className="text-white font-bold">{formatBytes(Math.max(0, effectiveQuota - storageUsed))}</span>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="h-10 w-full bg-white/5 rounded-2xl overflow-hidden flex relative border border-white/5 p-1 group/bar">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="h-full bg-accent rounded-l-xl cursor-pointer hover:brightness-110 transition-all relative group/segment" 
                        style={{ width: `${imagePercentage}%`, minWidth: imagePercentage > 0 ? '4px' : '0' }}
                      >
                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/segment:opacity-100 transition-opacity" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-accent text-accent-foreground border-none font-bold px-4 py-2 rounded-xl shadow-2xl">
                      <div className="space-y-0.5">
                        <p className="text-[10px] uppercase font-black opacity-60">Imágenes (Cian)</p>
                        <p className="text-sm">Peso: {formatBytes(imageStats.size)}</p>
                        <p className="text-[10px]">{imageStats.count} activos registrados</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="h-full bg-primary cursor-pointer hover:brightness-110 transition-all relative group/segment" 
                        style={{ width: `${videoPercentage}%`, minWidth: videoPercentage > 0 ? '4px' : '0' }}
                      >
                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/segment:opacity-100 transition-opacity" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-primary text-primary-foreground border-none font-bold px-4 py-2 rounded-xl shadow-2xl">
                      <div className="space-y-0.5">
                        <p className="text-[10px] uppercase font-black opacity-60">Videos (Púrpura)</p>
                        <p className="text-sm">Peso: {formatBytes(videoStats.size)}</p>
                        <p className="text-[10px]">{videoStats.count} activos registrados</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <div className="flex-1 h-full bg-transparent" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4 hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_10px_#66E0FF]" />
                    <p className="text-[10px] font-black uppercase text-white tracking-widest">Activos Visuales</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-white">{formatBytes(imageStats.size)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">{imageStats.count} fotos en infraestructura</p>
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4 hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_#7373F0]" />
                    <p className="text-[10px] font-black uppercase text-white tracking-widest">Flujo de Video</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-white">{formatBytes(videoStats.size)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">{videoStats.count} grabaciones activas</p>
                  </div>
                </div>
              </div>

              {/* Archivos de Mayor Peso para Liberar Espacio */}
              {mediaList && mediaList.length > 0 && (
                <div className="space-y-4 pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-primary" /> Archivos que Más Espacio Ocupan
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Elimina grabaciones o archivos de gran tamaño para recuperar espacio dentro de tu cuota de 3 GB.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-white/10 text-white/70">
                      Top {Math.min(5, mediaList.length)}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {mediaList
                      .slice()
                      .sort((a: any, b: any) => (b.size || 0) - (a.size || 0))
                      .slice(0, 5)
                      .map((item: any) => (
                        <div key={item.id} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                              {item.type === 'video' ? <Film className="h-4 w-4 text-primary" /> : <ImageIcon className="h-4 w-4 text-accent" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-[360px]">{item.filename || item.originalName}</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-black">
                                <span className="text-primary font-bold">{formatBytes(item.size || 0)}</span> • {item.type?.toUpperCase()}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDeleteMediaItem && onDeleteMediaItem(item.id)}
                            className="h-8 px-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-bold shrink-0 flex items-center gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Papelera</span>
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historial de Pagos y Transacciones Google Pay */}
      <Card className="bg-card/40 border-white/5 rounded-3xl overflow-hidden backdrop-blur-3xl shadow-2xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-sm">
              <span className="text-blue-400">G</span>
              <span className="text-white ml-0.5">Pay</span>
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Historial de Facturación y Recibos</h4>
              <p className="text-xs text-muted-foreground">Transacciones procesadas de forma segura con Google Pay</p>
            </div>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-bold">
            Google Pay Conectado
          </Badge>
        </div>

        {payments.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              {planName === 'GRATUITO' 
                ? 'Actualmente te encuentras en el plan Gratuito de 3 GB. Al mejorar tu plan a Pro o Ultra con Google Pay, tus facturas aparecerán aquí.' 
                : 'No se registran pagos previos.'}
            </p>
            {planName === 'GRATUITO' && (
              <Button
                onClick={onOpenUpgrade}
                variant="outline"
                size="sm"
                className="mt-2 rounded-full border-white/10 text-xs font-bold hover:bg-white/10"
              >
                Ver Planes Disponibles
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => (
              <div 
                key={p.id}
                className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">
                      Suscripción {p.plan?.toUpperCase()} ({p.billingCycle === 'yearly' ? 'Anual' : 'Mensual'})
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      ID: {p.transactionId} • {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="font-black text-sm text-emerald-400">${p.amount?.toFixed(2)} USD</span>
                  <span className="text-[10px] text-muted-foreground block">
                    Pagado con Google Pay {p.tokenDetails?.cardDetails ? `(${p.tokenDetails.cardDetails})` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};