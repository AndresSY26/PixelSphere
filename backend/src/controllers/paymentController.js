import crypto from 'node:crypto';
import { query } from '../db/index.js';
import { broadcastNeuralEvent } from '../services/eventService.js';
import { unlockAchievement } from '../services/storageService.js';

const TIER_QUOTAS = {
  free: 3 * 1024 * 1024 * 1024,
  pro: 50 * 1024 * 1024 * 1024,
  ultra: 200 * 1024 * 1024 * 1024
};

const PLAN_PRICING = {
  pro: {
    monthly: 2.49,
    yearly: 24.99,
    storageDisplay: '50 GB'
  },
  ultra: {
    monthly: 4.99,
    yearly: 49.99,
    storageDisplay: '200 GB'
  }
};

/**
 * Obtiene la configuración pública para el cliente web de Google Pay
 */
export async function getGooglePayConfig(req, res) {
  try {
    return res.json({
      environment: process.env.GOOGLE_PAY_ENV || 'TEST',
      merchantInfo: {
        merchantId: process.env.GOOGLE_PAY_MERCHANT_ID || '12345678901234567890',
        merchantName: 'PixelSphere Cloud Storage'
      },
      allowedCardAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
      allowedCardNetworks: ['AMEX', 'DISCOVER', 'INTERAC', 'JCB', 'MASTERCARD', 'VISA'],
      gateway: 'example',
      gatewayMerchantId: 'exampleGatewayMerchantId',
      plans: PLAN_PRICING
    });
  } catch (error) {
    console.error('[PaymentController] Error al obtener config de Google Pay:', error);
    return res.status(500).json({ error: 'Error al obtener configuración de pago.' });
  }
}

/**
 * Procesa la autorización de pago emitida por Google Pay y actualiza la cuenta en PostgreSQL
 */
export async function processGooglePayPayment(req, res) {
  try {
    const { userId, plan, billingCycle = 'monthly', paymentData } = req.body;

    if (!userId || !plan) {
      return res.status(400).json({ error: 'userId y plan son obligatorios.' });
    }

    const cleanPlan = plan.toLowerCase();
    if (!['pro', 'ultra'].includes(cleanPlan)) {
      return res.status(400).json({ error: 'Plan inválido para pago. Debe ser pro o ultra.' });
    }

    // Verificar existencia del usuario
    const userRes = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!userRes.rows || userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado en la base de datos.' });
    }
    const user = userRes.rows[0];

    const planConfig = PLAN_PRICING[cleanPlan];
    const amount = billingCycle === 'yearly' ? planConfig.yearly : planConfig.monthly;
    const quotaBytes = TIER_QUOTAS[cleanPlan];

    // Generar identificador de transacción único
    const paymentId = 'pay_' + crypto.randomBytes(12).toString('hex');
    const transactionReference = `GP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Extraer detalles de la tarjeta o token de Google Pay
    const cardInfo = paymentData?.paymentMethodData?.info || {};
    const cardDescription = paymentData?.paymentMethodData?.description || 'Tarjeta vinculada a Google Pay';
    const cardNetwork = cardInfo?.cardNetwork || 'VISA';
    const cardDetails = cardInfo?.cardDetails || '•••• 4242';

    const tokenDetails = {
      cardNetwork,
      cardDetails,
      cardDescription,
      paymentMethodType: paymentData?.paymentMethodData?.type || 'CARD',
      googleTransactionId: paymentData?.googleTransactionId || transactionReference,
      billingCycle,
      processedAt: new Date().toISOString()
    };

    // 1. Registrar el pago en la tabla `payments` en PostgreSQL
    await query(
      `INSERT INTO payments (
        id, user_id, plan, billing_cycle, amount_usd, currency, payment_method, 
        google_transaction_id, token_details, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        paymentId,
        userId,
        cleanPlan,
        billingCycle,
        amount,
        'USD',
        'google_pay',
        transactionReference,
        JSON.stringify(tokenDetails),
        'completed'
      ]
    );

    // 2. Actualizar plan y cuota de almacenamiento del usuario en PostgreSQL
    const updatedUserRes = await query(
      `UPDATE users 
       SET plan = $1, storage_quota = $2, updated_at = NOW() 
       WHERE id = $3 
       RETURNING id, username, email, role, plan, storage_quota, storage_used`,
      [cleanPlan, quotaBytes, userId]
    );

    const updatedUser = updatedUserRes.rows[0];

    // 3. Desbloquear logro por apoyar el proyecto / upgrade
    await unlockAchievement(userId, 'supporter').catch(() => {});
    await unlockAchievement(userId, 'storage_pioneer').catch(() => {});

    // 4. Emitir eventos en tiempo real
    broadcastNeuralEvent('USER_PLAN', {
      userId,
      plan: cleanPlan,
      storageQuota: quotaBytes,
      transactionId: transactionReference
    });

    const receipt = {
      id: paymentId,
      transactionReference,
      plan: cleanPlan,
      planName: cleanPlan.toUpperCase(),
      billingCycle,
      amountUsd: amount,
      currency: 'USD',
      paymentMethod: 'Google Pay',
      cardNetwork,
      cardLast4: cardDetails,
      storageDisplay: planConfig.storageDisplay,
      storageBytes: quotaBytes,
      createdAt: new Date().toISOString(),
      status: 'Aprobado y Activo'
    };

    console.log(`[GooglePay] Pago exitoso procesado para usuario ${userId}: ${transactionReference} (${cleanPlan.toUpperCase()} $${amount} USD)`);

    return res.status(200).json({
      success: true,
      message: `¡Pago exitoso con Google Pay! Has mejorado a ${cleanPlan.toUpperCase()}.`,
      transactionId: transactionReference,
      receipt,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        plan: updatedUser.plan,
        storageQuota: parseInt(updatedUser.storage_quota, 10),
        storageUsed: parseInt(updatedUser.storage_used, 10)
      }
    });
  } catch (error) {
    console.error('[PaymentController] Error al procesar pago de Google Pay:', error);
    return res.status(500).json({
      error: 'Error al procesar la transacción de Google Pay.',
      details: error.message
    });
  }
}

/**
 * Obtiene el historial de facturas y pagos realizados por un usuario
 */
export async function getPaymentHistory(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'userId es obligatorio.' });
    }

    const paymentsRes = await query(
      `SELECT id, plan, billing_cycle, amount_usd, currency, payment_method, 
              google_transaction_id, token_details, status, created_at
       FROM payments 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    const payments = paymentsRes.rows.map(row => ({
      id: row.id,
      plan: row.plan,
      billingCycle: row.billing_cycle,
      amount: parseFloat(row.amount_usd),
      currency: row.currency,
      paymentMethod: row.payment_method,
      transactionId: row.google_transaction_id,
      tokenDetails: row.token_details,
      status: row.status,
      createdAt: row.created_at
    }));

    return res.json({ success: true, payments });
  } catch (error) {
    console.error('[PaymentController] Error al obtener historial de pagos:', error);
    return res.status(500).json({ error: 'Error al obtener historial de pagos.' });
  }
}
