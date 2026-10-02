import crypto from 'node:crypto';
import { authenticator } from 'otplib';
import { ENCRYPTION_KEY, IV_LENGTH } from '../config/constants.js';

/**
 * Cifrado simétrico AES-256-CBC para la bóveda
 */
export function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Descifrado simétrico AES-256-CBC
 */
export function decrypt(text) {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('[CryptoService] Error al desencriptar texto:', error);
    return '';
  }
}

/**
 * Hash seguro SHA-512 para contraseñas
 */
export function hashPassword(password) {
  if (!password) return '';
  return crypto.createHash('sha512').update(password.trim()).digest('hex');
}

/**
 * Generador de secretos TOTP para 2FA
 */
export function generateTwoFactorSecret() {
  return authenticator.generateSecret();
}

/**
 * Validador de tokens TOTP
 */
export function verifyTwoFactorToken(token, secret) {
  try {
    return authenticator.verify({ token, secret });
  } catch (error) {
    console.error('[CryptoService] Error verificando token 2FA:', error);
    return false;
  }
}
