"use client";

import { useState, useEffect } from 'react';
import { Monitor, X, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      window.dispatchEvent(new CustomEvent('ps-pwa-installable', { detail: true }));
      
      const isDismissed = sessionStorage.getItem('ps_pwa_dismissed');
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      if (!isDismissed && !isStandalone) {
        setTimeout(() => setShowBanner(true), 5000);
      }
    };

    const handleInstallAction = async () => {
      if (!deferredPrompt) return;
      setIsInstalling(true);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowBanner(false);
        window.dispatchEvent(new CustomEvent('ps-pwa-installable', { detail: false }));
      }
      setIsInstalling(false);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('ps-trigger-pwa-install', handleInstallAction);

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setShowBanner(false);
      window.dispatchEvent(new CustomEvent('ps-pwa-installable', { detail: false }));
      toast({ 
        title: "Nodo Sincronizado", 
        description: "PixelSphere se ha instalado correctamente en tu sistema." 
      });
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('ps-trigger-pwa-install', handleInstallAction);
    };
  }, [toast, deferredPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowBanner(false);
    }
    setIsInstalling(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('ps_pwa_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-3rem)] max-w-md animate-slide-up">
      <div className="bg-card/90 backdrop-blur-3xl border border-primary/30 rounded-[2.5rem] p-5 shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex items-center gap-5 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 opacity-50 pointer-events-none" />
        
        <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20 relative">
          <Monitor className="h-7 w-7 text-white" />
          <div className="absolute -top-1 -right-1">
            <Sparkles className="h-4 w-4 text-accent animate-pulse" />
          </div>
        </div>
        
        <div className="flex-1 min-0">
          <p className="text-sm font-black text-white tracking-tight uppercase">Versión de Escritorio</p>
          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.2em] leading-none mt-1">Instalar Nodo Standalone</p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <Button 
            onClick={handleInstall} 
            disabled={isInstalling}
            className="h-10 px-6 bg-white text-black hover:bg-white/90 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95"
          >
            {isInstalling ? <Loader2 className="h-3 w-3 animate-spin" /> : "Instalar"}
          </Button>
          <button 
            onClick={handleDismiss} 
            className="p-2 text-muted-foreground hover:text-white transition-colors rounded-full hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
