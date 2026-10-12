/**
 * GOOGLE PAY INTEGRATION SERVICE
 * Maneja la inicialización del SDK oficial de Google Pay para Web y el flujo de autorización.
 */

declare global {
  interface Window {
    google?: any;
  }
}

export interface GooglePayConfig {
  environment: 'TEST' | 'PRODUCTION';
  merchantInfo: {
    merchantId: string;
    merchantName: string;
  };
  allowedCardAuthMethods: string[];
  allowedCardNetworks: string[];
  gateway: string;
  gatewayMerchantId: string;
}

let googlePayScriptLoadingPromise: Promise<void> | null = null;

export function loadGooglePayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  if (window.google?.payments?.api) {
    return Promise.resolve();
  }

  if (googlePayScriptLoadingPromise) {
    return googlePayScriptLoadingPromise;
  }

  googlePayScriptLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://pay.google.com/gp/p/js/pay.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Error al cargar Google Pay')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://pay.google.com/gp/p/js/pay.js';
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('No se pudo cargar el script de Google Pay'));
    };
    document.body.appendChild(script);
  });

  return googlePayScriptLoadingPromise;
}

export function getBaseCardPaymentMethod(config: GooglePayConfig) {
  return {
    type: 'CARD',
    parameters: {
      allowedAuthMethods: config.allowedCardAuthMethods || ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
      allowedCardNetworks: config.allowedCardNetworks || ['AMEX', 'DISCOVER', 'INTERAC', 'JCB', 'MASTERCARD', 'VISA']
    }
  };
}

export function getCardPaymentMethodWithTokenization(config: GooglePayConfig) {
  return {
    type: 'CARD',
    parameters: {
      allowedAuthMethods: config.allowedCardAuthMethods || ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
      allowedCardNetworks: config.allowedCardNetworks || ['AMEX', 'DISCOVER', 'INTERAC', 'JCB', 'MASTERCARD', 'VISA']
    },
    tokenizationSpecification: {
      type: 'PAYMENT_GATEWAY',
      parameters: {
        gateway: config.gateway || 'example',
        gatewayMerchantId: config.gatewayMerchantId || 'exampleGatewayMerchantId'
      }
    }
  };
}

export async function isGooglePayReady(config: GooglePayConfig): Promise<boolean> {
  try {
    await loadGooglePayScript();
    if (!window.google?.payments?.api) return false;

    const paymentsClient = new window.google.payments.api.PaymentsClient({
      environment: config.environment || 'TEST'
    });

    const isReadyToPayRequest = {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [getBaseCardPaymentMethod(config)]
    };

    const response = await paymentsClient.isReadyToPay(isReadyToPayRequest);
    return !!response.result;
  } catch (err) {
    console.warn('[GooglePay] isReadyToPay aviso:', err);
    // En sandbox / preview permitimos mostrar el botón con simulación si falla
    return true;
  }
}

export function getGooglePaymentDataRequest(
  config: GooglePayConfig,
  amount: number,
  currency: string = 'USD'
) {
  const merchantInfo: Record<string, string> = {
    merchantName: config.merchantInfo?.merchantName || 'PixelSphere Cloud Storage'
  };

  // Solo incluir merchantId numérico si estamos en PRODUCCIÓN
  if (config.environment === 'PRODUCTION' && config.merchantInfo?.merchantId) {
    merchantInfo.merchantId = config.merchantInfo.merchantId;
  }

  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [getCardPaymentMethodWithTokenization(config)],
    transactionInfo: {
      totalPriceStatus: 'FINAL',
      totalPrice: amount.toFixed(2),
      currencyCode: currency,
      countryCode: 'US'
    },
    merchantInfo
  };
}

export function getPaymentsClient(config: GooglePayConfig) {
  if (typeof window === 'undefined' || !window.google?.payments?.api) {
    return null;
  }
  return new window.google.payments.api.PaymentsClient({
    environment: config.environment || 'TEST'
  });
}

export function renderGooglePayButton(
  container: HTMLElement,
  config: GooglePayConfig,
  onClick: (event: any) => void
): boolean {
  if (typeof window === 'undefined' || !window.google?.payments?.api) return false;
  try {
    const paymentsClient = getPaymentsClient(config);
    if (!paymentsClient) return false;

    container.innerHTML = '';
    const button = paymentsClient.createButton({
      buttonColor: 'default',
      buttonType: 'pay',
      buttonSizeMode: 'fill',
      onClick
    });
    container.appendChild(button);
    return true;
  } catch (err) {
    console.warn('[GooglePay] Error al renderizar botón oficial de Google Pay:', err);
    return false;
  }
}

export async function requestGooglePayPayment(
  config: GooglePayConfig,
  amount: number,
  currency: string = 'USD'
): Promise<any> {
  await loadGooglePayScript();

  if (!window.google?.payments?.api) {
    throw new Error('Google Pay SDK no disponible en este navegador');
  }

  const paymentsClient = getPaymentsClient(config);
  if (!paymentsClient) {
    throw new Error('No se pudo inicializar PaymentsClient de Google Pay');
  }

  const paymentDataRequest = getGooglePaymentDataRequest(config, amount, currency);

  try {
    const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);
    return paymentData;
  } catch (err: any) {
    if (err.statusCode === 'CANCELED') {
      throw new Error('Pago cancelado por el usuario');
    }
    const msg = String(err.message || err.statusMessage || err);
    if (msg.includes('OR_BIBED') || msg.includes('popup') || msg.includes('window')) {
      const enhancedErr: any = new Error('Google Pay no pudo cargar la ventana de pago [OR_BIBED_15].');
      enhancedErr.code = 'OR_BIBED_15';
      throw enhancedErr;
    }
    throw err;
  }
}
