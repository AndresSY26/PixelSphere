"use client";

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Camera, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  ShieldCheck, 
  Loader2, 
  Fingerprint, 
  ShieldAlert,
  Zap,
  KeyRound,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { findUserByEmail, findUserByUsername, saveUser, hashPassword, recordSession, getUsers, verify2FALogin } from '@/lib/storage';
import { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { base64ToArrayBuffer } from '@/lib/utils';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [view, setView] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'credentials' | '2fa' | 'biometric'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);

  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const sessionData = localStorage.getItem('ps_active_session');
    if (sessionData) {
      router.replace('/dashboard');
    }
  }, []);

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'register') setView('register');
    else setView('login');
  }, [searchParams]);

  useEffect(() => {
    if (view !== 'login') {
      setCanUseBiometrics(false);
      return;
    }

    const validateBiometrics = async () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(email.trim())) {
        try {
          const userFound = await findUserByEmail(email.trim().toLowerCase());
          setCanUseBiometrics(!!(userFound && userFound.biometricEnabled && userFound.biometricCredentialId));
        } catch (e) {
          console.error("Error al validar biometría:", e);
          setCanUseBiometrics(false);
        }
      } else {
        setCanUseBiometrics(false);
      }
    };

    const timer = setTimeout(validateBiometrics, 500);
    return () => clearTimeout(timer);
  }, [email, view]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const user = await findUserByEmail(email.trim().toLowerCase());
      
      if (!user) {
        toast({ title: "Acceso Denegado", description: "Este correo no está registrado.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const hashedPassword = await hashPassword(password.trim());
      
      if (user.passwordHash === hashedPassword) {
        // Validación atómica de 2FA del servidor (ignora estados corruptos)
        if (user.is2FAEnabled) {
          setPendingUser(user);
          setStep('2fa');
          toast({ title: "2FA Requerido", description: "Ingresa el código de tu aplicación de autenticación." });
        } else {
          await completeLogin(user);
        }
      } else {
        toast({ title: "Credenciales Incorrectas", description: "Verifica tu contraseña.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error en inicio de sesión:", error);
      toast({ title: "Falla de Sistema", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;
    setIsLoading(true);

    try {
      const isValid = await verify2FALogin(pendingUser.id, otpCode);
      if (isValid) {
        await completeLogin(pendingUser);
      } else {
        toast({ title: "Código Inválido", description: "El código no coincide con tu autenticador.", variant: "destructive" });
      }
    } catch (e) {
      console.error("Error al verificar código 2FA:", e);
      toast({ title: "Error de Validación", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!email.trim()) {
      toast({ title: "Identidad Requerida", description: "Ingresa tu correo para buscar tu nodo biométrico.", variant: "destructive" });
      return;
    }

    const userFound = await findUserByEmail(email.trim().toLowerCase());
    if (!userFound || !userFound.biometricEnabled || !userFound.biometricCredentialId) {
      toast({ title: "Biometría Inactiva", description: "Este nodo no tiene credenciales de hardware vinculadas.", variant: "destructive" });
      return;
    }

    setIsScanning(true);
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const options: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [{
          id: base64ToArrayBuffer(userFound.biometricCredentialId),
          type: "public-key",
        }],
        userVerification: "required",
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({ publicKey: options });
      
      if (assertion) {
        await completeLogin(userFound);
        toast({ title: "Identidad Confirmada", description: "Acceso biométrico autorizado." });
      }
    } catch (e) {
      console.error("Falla en login biométrico:", e);
      toast({ title: "Falla de Sensor", description: "No se pudo validar la identidad física.", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  const completeLogin = async (user: User) => {
    const updatedUser = await recordSession(user.id, navigator.userAgent);
    const sessionUser = updatedUser || user;
    localStorage.setItem('ps_active_session', JSON.stringify(sessionUser));
    if (sessionUser.sessions && sessionUser.sessions.length > 0) {
      localStorage.setItem('ps_session_id', sessionUser.sessions[0].id);
    }
    router.push('/dashboard');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const existingEmail = await findUserByEmail(email.trim().toLowerCase());
      if (existingEmail) {
        toast({ title: "Correo en uso", variant: "destructive" });
        setIsLoading(false); return;
      }
      const existingUsername = await findUserByUsername(username.trim().toLowerCase());
      if (existingUsername) {
        toast({ title: "Nombre de usuario no disponible", variant: "destructive" });
        setIsLoading(false); return;
      }

      const hashedPassword = await hashPassword(password.trim());
      const newUser: User = {
        id: Math.random().toString(36).substring(2, 11),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: hashedPassword,
        role: 'user',
        is2FAEnabled: false,
        createdAt: new Date().toISOString(),
        settings: {
          accentColor: '#7373F0',
          isDarkMode: true,
          interfaceDensity: 'default',
          glassIntensity: 10,
          backgroundTheme: 'classic',
          borderRadius: 12,
          reducedMotion: false,
          videoAutoplay: true,
          lowResPreviews: false,
          gpuAcceleration: true,
          aiBackgroundAnalysis: true,
          vaultAutoLockEnabled: true,
          vaultAutoLockTime: 60
        }
      };
      await saveUser(newUser);
      await completeLogin(newUser);
    } catch (error) {
      console.error("Error en registro de usuario:", error);
      toast({ title: "Error de Escritura", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(115,115,240,0.15),transparent_40%)]" />
      <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_80%,rgba(102,224,255,0.1),transparent_40%)]" />

      <div className="w-full max-w-md space-y-8 animate-fade-in relative z-10">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="group mb-6">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-2xl shadow-primary/40 group-hover:scale-110 transition-transform">
              <Camera className="h-7 w-7 text-white" />
            </div>
          </Link>
          <h2 className="text-3xl font-extrabold text-white font-headline tracking-tight">
            {step === '2fa' ? 'Validación de Token' : view === 'login' ? 'PixelSphere Nexus' : 'Crea tu Cuenta'}
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            {step === '2fa' ? 'Ingresa el código de tu app de autenticación' : view === 'login' ? 'Acceso seguro a tu bóveda neural' : 'Empieza a orquestar tu universo multimedia'}
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          {step === 'credentials' ? (
            <>
              <Tabs value={view} onValueChange={(v) => setView(v as 'login' | 'register')} className="w-full mb-8">
                <TabsList className="grid grid-cols-2 bg-white/5 rounded-xl h-11 p-1">
                  <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-bold">Entrar</TabsTrigger>
                  <TabsTrigger value="register" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-bold">Unirse</TabsTrigger>
                </TabsList>
              </Tabs>

              <form className="space-y-6 animate-zoom-in" onSubmit={view === 'login' ? handleLogin : handleRegister}>
                {view === 'register' && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nombre de Usuario</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input placeholder="identidad_nexo" className="flex h-12 w-full pl-10 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-white text-sm" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Correo Electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="email" placeholder="nodo@pixelsphere.io" className="flex h-12 w-full pl-10 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-white text-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Clave SHA-512</Label>
                    {view === 'login' && <button type="button" className="text-[10px] text-primary hover:text-accent uppercase font-bold tracking-tighter transition-colors">¿Recuperar?</button>}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="password" placeholder="••••••••" className="flex h-12 w-full pl-10 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-white text-sm" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl text-lg font-bold transition-all shadow-lg shadow-primary/20">
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{view === 'login' ? 'Entrar al Nexo' : 'Inicializar Nodo'} <ArrowRight className="ml-2 h-5 w-5" /></>}
                </Button>

                {view === 'login' && (
                  <div className="pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleBiometricLogin} 
                      disabled={isLoading || !canUseBiometrics}
                      className="w-full h-14 rounded-2xl border-white/10 bg-white/5 text-white font-bold group disabled:opacity-30"
                    >
                      <Fingerprint className="mr-3 h-6 w-6 text-accent group-hover:scale-110 transition-transform" /> Acceso Biométrico
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-3 p-4 rounded-2xl bg-accent/5 border border-accent/10">
                  <ShieldCheck className="h-5 w-5 text-accent shrink-0" />
                  <p className="text-[10px] text-accent/80 font-medium leading-tight uppercase tracking-wider">Protocolo de seguridad activo: Cifrado en reposo y persistencia física local.</p>
                </div>
              </form>
            </>
          ) : (
            <form className="space-y-8 animate-slide-up" onSubmit={handleVerify2FA}>
              <div className="flex justify-center"><div className="p-5 rounded-3xl bg-primary/10 border border-primary/20 text-primary shadow-inner"><Zap className="h-10 w-10 fill-primary/20" /></div></div>
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] block text-center">Código del Autenticador</Label>
                <input 
                  placeholder="000000" 
                  className="flex h-20 w-full text-center text-4xl font-black tracking-[0.5em] bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary text-white" 
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={isLoading || otpCode.length < 6} className="w-full h-14 bg-primary text-white rounded-2xl font-bold text-lg shadow-xl shadow-primary/20">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Validar Nodo"}
              </Button>
              <button type="button" onClick={() => setStep('credentials')} className="w-full text-[10px] uppercase font-black text-muted-foreground hover:text-white transition-colors">Volver a Credenciales</button>
            </form>
          )}
        </div>
      </div>

      <Dialog open={isScanning} onOpenChange={setIsScanning}>
        <DialogContent className="max-w-md bg-black/95 border-primary/30 rounded-[2.5rem] p-10 shadow-[0_0_50px_rgba(115,115,240,0.3)] backdrop-blur-2xl">
          <div className="flex flex-col items-center text-center space-y-8 relative">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center relative overflow-hidden">
                <Fingerprint className="h-16 w-16 text-primary" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/40 to-transparent h-1 w-full animate-scan-line shadow-[0_0_15px_#7373F0]" />
              </div>
              <div className="absolute -inset-4 border border-primary/10 rounded-full animate-pulse" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-bold text-white font-headline">Escaneo de Red</DialogTitle>
              <DialogDescription className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em]">Validando integridad biométrica...</DialogDescription>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map(i => <div key={i} className="w-8 h-1 rounded-full bg-primary/20 overflow-hidden"><div className="h-full bg-primary animate-pulse" style={{ animationDelay: `${i*200}ms` }} /></div>)}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <AuthContent />
    </Suspense>
  );
}
