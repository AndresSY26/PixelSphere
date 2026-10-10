import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { updateUserPlan } from '@/lib/storage';
import { User } from '@/lib/types';
import { GooglePayCheckoutDialog } from './google-pay-checkout-dialog';
import { 
  Check, 
  Zap, 
  Crown, 
  Sparkles, 
  ShieldCheck, 
  HardDrive, 
  Loader2,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpgradePlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onPlanUpdated?: (updatedUser: User) => void;
}

export const STORAGE_TIERS = [
  {
    id: 'free',
    name: 'Gratuito',
    tagline: 'Ideal para iniciar con optimización WebP/WebM',
    storageDisplay: '3 GB',
    storageBytes: 3 * 1024 * 1024 * 1024,
    priceMonthly: '$0',
    priceYearly: '$0',
    badge: 'Básico',
    badgeVariant: 'outline' as const,
    popular: false,
    features: [
      '3 GB de almacenamiento Zero-Knowledge',
      'Optimización inteligente a WebP y WebM',
      'Cifrado local y en Firebase Storage AES-256',
      'Papelera con purga física automática a los 30 días',
      'Deduplicación SHA-256 para evitar duplicados'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para fotógrafos, diseñadores y colecciones activas',
    storageDisplay: '50 GB',
    storageBytes: 50 * 1024 * 1024 * 1024,
    priceMonthly: '$2.49 / mes',
    priceYearly: '$24.99 / año',
    badge: 'Más Rentable',
    badgeVariant: 'default' as const,
    popular: true,
    features: [
      '50 GB de almacenamiento Zero-Knowledge',
      'Almacena más de 65,000 imágenes WebP optimizadas',
      'Cola de transcodificación FFmpeg de alta prioridad',
      'Bóveda secreta privada con PIN y biometría ilimitada',
      'Deduplicación SHA-256 instantánea sin consumo extra',
      'Respaldo persistente en Firebase Storage'
    ]
  },
  {
    id: 'ultra',
    name: 'Ultra',
    tagline: 'Máxima capacidad para videos 4K y archivos pesados',
    storageDisplay: '200 GB',
    storageBytes: 200 * 1024 * 1024 * 1024,
    priceMonthly: '$4.99 / mes',
    priceYearly: '$49.99 / año',
    badge: 'Máximo Poder',
    badgeVariant: 'secondary' as const,
    popular: false,
    features: [
      '200 GB de almacenamiento Zero-Knowledge',
      'Almacena más de 250,000 fotos o cientos de horas de video',
      'Streaming fluido de video por fragmentos (Byte-Range)',
      'Máximo ancho de banda de descarga e ingesta',
      'Soporte prioritario y todas las funciones Pro incluidas'
    ]
  }
];

export function UpgradePlanDialog({ isOpen, onClose, user, onPlanUpdated }: UpgradePlanDialogProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [updatingTier, setUpdatingTier] = useState<string | null>(null);
  const [checkoutTier, setCheckoutTier] = useState<any | null>(null);
  const { toast } = useToast();

  const currentPlan = (user?.plan || 'free').toLowerCase();

  const handleSelectPlan = async (tierId: string) => {
    if (!user) return;
    if (tierId === currentPlan) {
      toast({
        title: "Plan Actual",
        description: `Ya te encuentras activo en el plan ${tierId.toUpperCase()}.`
      });
      return;
    }

    // Para planes de pago (Pro o Ultra), abrir la pasarela de Google Pay
    if (tierId === 'pro' || tierId === 'ultra') {
      const selectedObj = STORAGE_TIERS.find(t => t.id === tierId);
      if (selectedObj) {
        setCheckoutTier(selectedObj);
        return;
      }
    }

    try {
      setUpdatingTier(tierId);
      const res = await updateUserPlan(user.id, tierId as 'free' | 'pro' | 'ultra');
      if (res?.success && res.user) {
        toast({
          title: "¡Plan Actualizado con Éxito!",
          description: `Tu cuenta ha sido actualizada al plan ${STORAGE_TIERS.find(t => t.id === tierId)?.name} (${STORAGE_TIERS.find(t => t.id === tierId)?.storageDisplay}).`
        });
        if (onPlanUpdated) {
          onPlanUpdated(res.user);
        }
        onClose();
      } else {
        throw new Error(res?.error || 'No se pudo actualizar el plan.');
      }
    } catch (err: any) {
      toast({
        title: "Error al actualizar plan",
        description: err.message || 'Ocurrió un error en la solicitud.',
        variant: "destructive"
      });
    } finally {
      setUpdatingTier(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-[#0a0a0c] border border-white/10 rounded-[2.5rem] p-6 sm:p-8 text-white shadow-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
            <Crown className="w-7 h-7" />
          </div>
          <DialogTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Escala tu Almacenamiento Zero-Knowledge
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm max-w-lg mx-auto">
            Todos los planes incluyen cifrado AES-256-GCM de grado militar, compresión WebP/WebM de última generación y respaldo persistente.
          </DialogDescription>

          {/* Toggle de facturación */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="bg-white/5 border border-white/10 p-1 rounded-full flex items-center text-xs">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  "px-4 py-1.5 rounded-full font-bold transition-all",
                  billingCycle === 'monthly' ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-white"
                )}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={cn(
                  "px-4 py-1.5 rounded-full font-bold transition-all flex items-center gap-1.5",
                  billingCycle === 'yearly' ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-white"
                )}
              >
                Anual
                <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-extrabold">Ahorra 2 meses</span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Tarjetas de Planes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-6">
          {STORAGE_TIERS.map((tier) => {
            const isCurrent = currentPlan === tier.id;
            const isUpdating = updatingTier === tier.id;

            return (
              <div
                key={tier.id}
                className={cn(
                  "relative rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 border bg-white/[0.02]",
                  tier.popular 
                    ? "border-primary/50 shadow-xl shadow-primary/10 ring-1 ring-primary/40 bg-gradient-to-b from-primary/10 via-transparent to-transparent" 
                    : "border-white/10 hover:border-white/20",
                  isCurrent && "border-accent/50 bg-accent/[0.03]"
                )}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary hover:bg-primary text-white px-3 py-1 font-bold text-[10px] tracking-wider uppercase shadow-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Opción Recomendada
                    </Badge>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold">{tier.name}</h3>
                    {isCurrent ? (
                      <Badge variant="outline" className="border-accent text-accent font-bold text-[10px]">
                        Plan Activo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-white/10 text-muted-foreground text-[10px]">
                        {tier.badge}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground min-h-[32px]">{tier.tagline}</p>

                  <div className="my-5 p-4 rounded-2xl bg-white/5 border border-white/5 flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-extrabold text-white">{tier.storageDisplay}</span>
                      <span className="text-xs text-muted-foreground block mt-0.5 font-medium">Capacidad</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-primary">
                        {billingCycle === 'monthly' ? tier.priceMonthly : tier.priceYearly}
                      </span>
                      {tier.priceMonthly !== '$0' && (
                        <span className="text-[10px] text-muted-foreground block">
                          {billingCycle === 'yearly' ? 'Facturado anual' : 'Facturado mensual'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5 my-4">
                    {tier.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span className="leading-snug text-white/80">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-white/5">
                  <Button
                    onClick={() => handleSelectPlan(tier.id)}
                    disabled={isCurrent || !!updatingTier}
                    className={cn(
                      "w-full rounded-2xl h-11 font-bold text-xs tracking-wide transition-all",
                      isCurrent 
                        ? "bg-white/10 text-muted-foreground cursor-not-allowed border border-white/5" 
                        : tier.popular
                          ? "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                          : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                    )}
                  >
                    {isUpdating ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Actualizando...
                      </span>
                    ) : isCurrent ? (
                      "Tu Plan Actual"
                    ) : tier.id === 'free' ? (
                      "Cambiar a Gratuito"
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        Pagar con Google Pay
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-white/5 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Almacenamiento Zero-Knowledge: ni el servidor ni terceros pueden leer tus archivos sin tu clave.</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center font-bold text-white text-[11px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
              <span className="text-blue-400">G</span>
              <span className="text-white ml-0.5">Pay</span>
              <span className="text-muted-foreground ml-1 font-normal">• Pasarela Protegida</span>
            </div>
          </div>
        </div>

        {/* Modal Checkout de Google Pay */}
        {checkoutTier && (
          <GooglePayCheckoutDialog
            isOpen={!!checkoutTier}
            onClose={() => setCheckoutTier(null)}
            user={user}
            tier={checkoutTier}
            billingCycle={billingCycle}
            onPaymentSuccess={(updatedUser, receipt) => {
              if (onPlanUpdated) {
                onPlanUpdated(updatedUser);
              }
              onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
