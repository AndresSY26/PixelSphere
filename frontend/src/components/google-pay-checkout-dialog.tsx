import React, { useState, useEffect, useRef } from 'react';
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
import { api } from '@/api/client';
import { User } from '@/lib/types';
import { 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  CreditCard,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  loadGooglePayScript, 
  renderGooglePayButton,
  getGooglePaymentDataRequest,
  getPaymentsClient,
  GooglePayConfig 
} from '@/lib/google-pay';

interface GooglePayCheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  tier: {
    id: string;
    name: string;
    storageDisplay: string;
    storageBytes: number;
    priceMonthly: string;
    priceYearly: string;
  };
  billingCycle: 'monthly' | 'yearly';
  onPaymentSuccess?: (updatedUser: User, receipt: any) => void;
}

export function GooglePayCheckoutDialog({
  isOpen,
  onClose,
  user,
  tier,
  billingCycle,
  onPaymentSuccess
}: GooglePayCheckoutDialogProps) {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [config, setConfig] = useState<GooglePayConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any>(null);
  const [isGooglePaySdkReady, setIsGooglePaySdkReady] = useState(false);
  const [buttonRendered, setButtonRendered] = useState(false);
  const googlePayButtonRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const isYearly = billingCycle === 'yearly';
  const priceAmount = tier.id === 'ultra' ? (isYearly ? 49.99 : 4.99) : (isYearly ? 24.99 : 2.49);
  const formattedPrice = `$${priceAmount.toFixed(2)} USD`;

  // Cargar configuración de Google Pay desde el backend
  useEffect(() => {
    let isMounted = true;
    if (!isOpen) {
      setPaymentSuccessData(null);
      setButtonRendered(false);
      return;
    }

    setLoadingConfig(true);
    api.payments.getGooglePayConfig()
      .then((cfg: GooglePayConfig) => {
        if (!isMounted) return;
        setConfig(cfg);
        setLoadingConfig(false);
      })
      .catch((err: any) => {
        console.warn('[GooglePay] Error cargando config, usando valores por defecto:', err);
        if (!isMounted) return;
        setConfig({
          environment: 'TEST',
          merchantInfo: {
            merchantId: '12345678901234567890',
            merchantName: 'PixelSphere Cloud Storage'
          },
          allowedCardAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
          allowedCardNetworks: ['AMEX', 'DISCOVER', 'INTERAC', 'JCB', 'MASTERCARD', 'VISA'],
          gateway: 'example',
          gatewayMerchantId: 'exampleGatewayMerchantId'
        });
        setLoadingConfig(false);
      });

    loadGooglePayScript()
      .then(() => {
        if (isMounted) setIsGooglePaySdkReady(true);
      })
      .catch((err) => {
        console.error('[GooglePay] Error cargando script de Google Pay:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Ejecución centralizada de confirmación de pago y actualización en backend
  const executePaymentWithPayload = async (paymentData: any) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const response = await api.payments.processGooglePay({
        userId: user.id,
        plan: tier.id,
        billingCycle,
        amount: priceAmount,
        currency: 'USD',
        paymentData
      });

      if (response?.success && response.receipt) {
        setPaymentSuccessData(response.receipt);
        
        // Actualizar sesión local del usuario
        if (response.user) {
          const session = localStorage.getItem('ps_active_session');
          if (session) {
            try {
              const u = JSON.parse(session);
              const merged = { ...u, ...response.user };
              localStorage.setItem('ps_active_session', JSON.stringify(merged));
              localStorage.setItem('pixelsphere_session_user', JSON.stringify(merged));
            } catch (e) {}
          }
        }

        toast({
          title: "¡Pago Aprobado con Google Pay!",
          description: `Tu cuenta ha sido mejorada al plan ${tier.name} (${tier.storageDisplay}).`
        });

        if (onPaymentSuccess && response.user) {
          onPaymentSuccess(response.user, response.receipt);
        }
      } else {
        throw new Error(response?.error || 'No se pudo completar el pago en el servidor.');
      }
    } catch (err: any) {
      console.error('[GooglePay] Error durante el pago:', err);
      toast({
        title: "Error en el pago",
        description: err.message || 'La transacción no pudo ser completada.',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Manejador síncrono del clic de Google Pay para preservar el User Gesture token del navegador
  const triggerGooglePay = () => {
    if (!config || !user) return;
    try {
      const paymentsClient = getPaymentsClient(config);
      if (!paymentsClient) {
        toast({
          title: "Google Pay",
          description: "Google Pay aún se está inicializando. Por favor intenta de nuevo.",
          variant: "destructive"
        });
        return;
      }

      const paymentDataRequest = getGooglePaymentDataRequest(config, priceAmount, 'USD');

      // Invocación síncrona inmediata en el evento de clic
      paymentsClient.loadPaymentData(paymentDataRequest)
        .then(async (paymentData: any) => {
          await executePaymentWithPayload(paymentData);
        })
        .catch((err: any) => {
          if (err.statusCode === 'CANCELED') {
            console.log('[GooglePay] El usuario canceló la ventana de Google Pay');
            return;
          }
          console.error('[GooglePay] Error en loadPaymentData:', err);
          const msg = err.statusMessage || err.message || 'Error al conectar con Google Pay.';
          toast({
            title: "Google Pay",
            description: msg,
            variant: "destructive"
          });
        });
    } catch (err: any) {
      console.error('[GooglePay] Error al abrir Google Pay:', err);
    }
  };

  // Renderizar el botón oficial de Google Pay cuando el SDK y el DOM estén listos
  useEffect(() => {
    if (!isOpen || !config || !isGooglePaySdkReady || !googlePayButtonRef.current) return;

    const rendered = renderGooglePayButton(
      googlePayButtonRef.current,
      config,
      triggerGooglePay
    );

    if (rendered) {
      setButtonRendered(true);
    }
  }, [isOpen, config, isGooglePaySdkReady, priceAmount]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg bg-[#0d0e12] border border-white/10 rounded-[2.5rem] p-6 sm:p-8 text-white shadow-2xl overflow-hidden">
        {paymentSuccessData ? (
          // ==================== PANTALLA DE RECIBO DE PAGO EXITOSO ====================
          <div className="flex flex-col items-center text-center py-4 space-y-6 animate-scale-in">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
            </div>

            <div className="space-y-1">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-3 py-1 font-bold">
                Pago Procesado con Google Pay
              </Badge>
              <h3 className="text-2xl font-extrabold text-white pt-2">¡Suscripción Activada!</h3>
              <p className="text-sm text-muted-foreground">
                Tu nuevo almacenamiento de <span className="text-white font-bold">{tier.storageDisplay}</span> ya está disponible y sincronizado.
              </p>
            </div>

            {/* Tarjeta de Recibo */}
            <div className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-5 text-left space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-muted-foreground">ID de Transacción</span>
                <span className="font-mono font-bold text-white">{paymentSuccessData.transactionReference}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Plan Adquirido</span>
                <span className="font-bold text-primary">{tier.name} ({tier.storageDisplay})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Ciclo de Facturación</span>
                <span className="text-white font-medium capitalize">{billingCycle === 'yearly' ? 'Anual' : 'Mensual'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Monto Pagado</span>
                <span className="font-bold text-emerald-400 text-sm">{formattedPrice}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Método de Pago</span>
                <span className="flex items-center gap-1.5 font-medium text-white">
                  <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                  Google Pay ({paymentSuccessData.cardLast4 || '•••• 4242'})
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-muted-foreground">Fecha y Hora</span>
                <span className="text-white/80">{new Date(paymentSuccessData.createdAt).toLocaleDateString()} {new Date(paymentSuccessData.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>

            <Button
              onClick={onClose}
              className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-xl shadow-primary/20"
            >
              Comenzar a Usar {tier.storageDisplay}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          // ==================== PASARELA DE CHECKOUT GOOGLE PAY ====================
          <div className="space-y-6">
            <DialogHeader className="text-left space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-sm tracking-tighter">
                    <span className="text-blue-400">G</span>
                    <span className="text-white ml-0.5">Pay</span>
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">Pasarela Google Pay</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Transacción oficial protegida con cifrado bancario
                    </DialogDescription>
                  </div>
                </div>

                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px] font-bold">
                  Modo Seguro SSL
                </Badge>
              </div>
            </DialogHeader>

            {/* Resumen del Pedido */}
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    Plan PixelSphere {tier.name}
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                      {tier.storageDisplay}
                    </Badge>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Facturación {isYearly ? 'anual (2 meses gratis)' : 'mensual recurrente'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-white">{formattedPrice}</span>
                  <span className="text-[10px] text-muted-foreground block">
                    /{isYearly ? 'año' : 'mes'}
                  </span>
                </div>
              </div>

              <div className="h-px bg-white/5 w-full" />

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Almacenamiento Zero-Knowledge</span>
                  <span className="text-white font-medium">{tier.storageDisplay}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Impuestos y Comisiones</span>
                  <span className="text-emerald-400 font-medium">$0.00 USD (Incluido)</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-white/5">
                  <span className="text-white">Total a Pagar Hoy</span>
                  <span className="text-primary text-base font-extrabold">{formattedPrice}</span>
                </div>
              </div>
            </div>

            {/* Garantías de Seguridad de Google Pay */}
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-tight text-white/80">
                  <strong className="block text-white mb-0.5">Sin compartir tarjeta</strong>
                  Google protege tu número real con un token virtual cifrado.
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-tight text-white/80">
                  <strong className="block text-white mb-0.5">Cifrado de Extremo a Extremo</strong>
                  Autenticación biométrica con tu cuenta oficial de Google.
                </div>
              </div>
            </div>

            {/* CONTENEDOR DEL BOTÓN OFICIAL DE GOOGLE PAY */}
            <div className="space-y-3 pt-2">
              {/* Botón oficial inyectado por Google Pay SDK */}
              <div 
                ref={googlePayButtonRef} 
                className={cn(
                  "w-full min-h-[48px] flex justify-center items-center rounded-2xl overflow-hidden transition-all",
                  "[&>button]:!w-full [&>button]:!h-12 [&>button]:!rounded-2xl [&>button]:!cursor-pointer",
                  !buttonRendered && "hidden",
                  (isProcessing || loadingConfig) && "opacity-75 pointer-events-none"
                )}
              />

              {/* Botón de respaldo directo si el contenedor tarda en inyectarse */}
              {!buttonRendered && (
                <button
                  type="button"
                  onClick={triggerGooglePay}
                  disabled={isProcessing || loadingConfig}
                  className={cn(
                    "relative w-full h-12 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all duration-300 shadow-xl overflow-hidden",
                    "bg-black hover:bg-neutral-900 border border-white/20 text-white hover:border-white/40 active:scale-[0.99]",
                    (isProcessing || loadingConfig) && "opacity-80 cursor-wait"
                  )}
                >
                  {isProcessing || loadingConfig ? (
                    <div className="flex items-center gap-2.5">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span className="text-xs font-semibold tracking-wide">
                        {loadingConfig ? 'Cargando Google Pay...' : 'Procesando pago...'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2.5 w-full">
                      <span className="text-sm font-medium tracking-wide">Pagar con</span>
                      <div className="flex items-center font-black tracking-tight text-base">
                        <span className="text-white">G</span>
                        <span className="text-white ml-0.5">Pay</span>
                      </div>
                    </div>
                  )}
                </button>
              )}

              {/* Estado de carga */}
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Procesando pago y activando plan en el servidor...</span>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Pasarela de Pago Google Pay Verificada • Facturación Segura</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
