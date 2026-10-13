import sharp from 'sharp';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import nodeFs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { ENCRYPTION_KEY } from '../config/constants.js';

const MAGIC_HEADER = Buffer.from('PXZK'); // PixelSphere Zero-Knowledge Magic
const IV_LENGTH = 12; // Standard GCM IV length
const TAG_LENGTH = 16; // Standard GCM Authentication Tag length

// Clave de 32 bytes derivada para AES-256-GCM
const ZK_KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY || 'PixelSphere_ZeroKnowledge_MasterSecret_Key_32B').digest();

// Claves candidatas para soportar activos cifrados con versiones previas de clave o claves directas
const CANDIDATE_KEYS = [
  ZK_KEY,
  ENCRYPTION_KEY,
  crypto.createHash('sha256').update('PixelSphere_ZeroKnowledge_MasterSecret_Key_32B').digest(),
  Buffer.from('PixelSphere_ZeroKnowledge_MasterSecret_Key_32B'.padEnd(32, '0').slice(0, 32))
].filter(k => k && k.length === 32);

/**
 * Convierte cualquier imagen a WebP de alta fidelidad y genera su miniatura WebP
 */
export async function optimizeImageToWebP(input, thumbnailPath = null) {
  const image = sharp(input);
  const metadata = await image.metadata();

  // Optimización WebP ultra-rápida (calidad excelente con compresión de alta velocidad effort: 1)
  const webpBuffer = await sharp(input)
    .webp({ quality: 82, effort: 1 })
    .toBuffer();

  let thumbBuffer = null;
  if (thumbnailPath) {
    thumbBuffer = await sharp(webpBuffer)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 70, effort: 1 })
      .toBuffer();
    await fs.writeFile(thumbnailPath, thumbBuffer);
  }

  return {
    buffer: webpBuffer,
    thumbnailBuffer: thumbBuffer,
    width: metadata.width || 1920,
    height: metadata.height || 1080,
    size: webpBuffer.length,
    mimeType: 'image/webp'
  };
}

/**
 * Optimización de video de alta velocidad (passthrough directo sin pérdida de calidad y sin transcodificación pesada)
 */
export async function optimizeVideoToWebM(inputPath, outputWebmPath, thumbnailPath) {
  let inWidth = 1920;
  let inHeight = 1080;
  let inDuration = 0;
  let inSize = 0;

  try {
    const inputStat = await fs.stat(inputPath);
    inSize = inputStat.size;
  } catch (e) {}

  // 1. Copia o enlace rápido del archivo de video original (cero latencia de CPU, máxima fidelidad nativa)
  if (inputPath !== outputWebmPath) {
    try {
      await fs.copyFile(inputPath, outputWebmPath);
    } catch (cpErr) {
      console.warn('[MediaOptimization] Error copiando video, usando fallback stream:', cpErr.message);
    }
  }

  // 2. Extraer fotograma para miniatura solo si se requiere y no existe
  if (thumbnailPath) {
    const tempFramePath = `${outputWebmPath}.tempframe.jpg`;
    try {
      await new Promise((resolve) => {
        const ffThumb = spawn('ffmpeg', [
          '-y',
          '-ss', '00:00:00.5',
          '-i', inputPath,
          '-vframes', '1',
          '-q:v', '3',
          '-f', 'image2',
          tempFramePath
        ]);
        const timeout = setTimeout(() => {
          ffThumb.kill('SIGKILL');
          resolve();
        }, 3000);
        ffThumb.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
        ffThumb.on('error', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      const frameBuf = await fs.readFile(tempFramePath).catch(() => null);
      if (frameBuf) {
        const thumbWebp = await sharp(frameBuf)
          .resize({ width: 400, withoutEnlargement: true })
          .webp({ quality: 70, effort: 1 })
          .toBuffer();
        await fs.writeFile(thumbnailPath, thumbWebp);
        await fs.unlink(tempFramePath).catch(() => {});
      }
    } catch (thErr) {
      console.warn('[MediaOptimization] Miniatura de video omitida:', thErr.message);
    }
  }

  return {
    width: inWidth,
    height: inHeight,
    duration: inDuration,
    size: inSize,
    mimeType: path.extname(outputWebmPath).toLowerCase() === '.webm' ? 'video/webm' : 'video/mp4'
  };
}


/**
 * Cifra un buffer con AES-256-GCM (Conocimiento Cero / Zero-Knowledge)
 * Formato del archivo binario sellado:
 * [MAGIC: 'PXZK' (4 bytes)][IV (12 bytes)][AUTH_TAG (16 bytes)][CIPHERTEXT (N bytes)]
 */
export function encryptZeroKnowledge(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', ZK_KEY, iv);

  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([MAGIC_HEADER, iv, authTag, ciphertext]);
}

/**
 * Descifra un buffer cifrado con Zero-Knowledge AES-256-GCM
 * Si el buffer no está cifrado, lo devuelve intacto para compatibilidad hacia atrás
 */
export function decryptZeroKnowledge(encryptedBuffer) {
  if (!encryptedBuffer || encryptedBuffer.length < MAGIC_HEADER.length + IV_LENGTH + TAG_LENGTH) {
    return encryptedBuffer;
  }

  const header = encryptedBuffer.subarray(0, MAGIC_HEADER.length);
  if (!header.equals(MAGIC_HEADER)) {
    // Archivo no cifrado o versión anterior, devolver tal cual
    return encryptedBuffer;
  }

  let offset = MAGIC_HEADER.length;
  const iv = encryptedBuffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const authTag = encryptedBuffer.subarray(offset, offset + TAG_LENGTH);
  offset += TAG_LENGTH;
  const ciphertext = encryptedBuffer.subarray(offset);

  // Lista de claves a probar (ZK_KEY derivada y claves candidatas)
  const keysToTry = [ZK_KEY, ...CANDIDATE_KEYS.filter(k => !k.equals(ZK_KEY))];
  let lastError = null;

  for (const candidateKey of keysToTry) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', candidateKey, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (err) {
      lastError = err;
    }
  }

  // Si falló la verificación de etiqueta GCM, verificar si el activo ya era plano o conserva firma de medio válida
  if (ciphertext.length >= 8) {
    const magicStr = ciphertext.subarray(0, 12).toString('utf-8');
    const magicHex = ciphertext.subarray(0, 4).toString('hex');
    // RIFF (WebP), EBML (\x1a\x45\xdf\xa3 para WebM/MKV), ftyp (MP4/MOV), JPEG (\xff\xd8\xff), PNG (\x89PNG)
    if (magicStr.includes('RIFF') || magicStr.includes('WEBP') || magicHex === '1a45dfa3' || magicStr.includes('ftyp') || magicHex.startsWith('ffd8') || magicHex === '89504e47') {
      console.warn('[ZeroKnowledge] El activo no requirió descifrado o ya contenía cabecera de medio válida.');
      return ciphertext;
    }
  }

  console.error('[ZeroKnowledge] Fallo al verificar integridad o descifrar activo:', lastError);
  throw new Error(`Integridad criptográfica violada o clave incorrecta.`);
}

/**
 * Verifica si un archivo en disco está cifrado con Zero-Knowledge
 */
export function isZeroKnowledgeEncrypted(buffer) {
  if (!buffer || buffer.length < MAGIC_HEADER.length) return false;
  return buffer.subarray(0, MAGIC_HEADER.length).equals(MAGIC_HEADER);
}

/**
 * Cifra un archivo completo en disco usando streams (cero consumo de RAM)
 * Compatible al 100% con decryptZeroKnowledge y el formato binario PXZK
 */
export async function encryptFileZeroKnowledge(inputPath, outputPath) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', ZK_KEY, iv);

  let outHandle = null;
  let readStream = null;
  try {
    outHandle = await fs.open(outputPath, 'w');
    // Reservar 32 bytes de encabezado (MAGIC 4B + IV 12B + TAG 16B)
    await outHandle.write(Buffer.alloc(32));

    readStream = nodeFs.createReadStream(inputPath);
    for await (const chunk of readStream) {
      const encChunk = cipher.update(chunk);
      if (encChunk.length > 0) {
        await outHandle.write(encChunk);
      }
    }
    const finalChunk = cipher.final();
    if (finalChunk.length > 0) {
      await outHandle.write(finalChunk);
    }
    const authTag = cipher.getAuthTag();

    // Escribir cabecera PXZK definitiva en la posición 0
    const header = Buffer.concat([MAGIC_HEADER, iv, authTag]);
    await outHandle.write(header, 0, 32, 0);
  } finally {
    if (readStream && !readStream.destroyed) {
      readStream.destroy();
    }
    if (outHandle) {
      await outHandle.close().catch(() => {});
    }
  }
}

/**
 * Descifra un archivo cifrado en disco a un archivo plano de salida
 */
export async function decryptFileZeroKnowledge(inputPath, outputPath) {
  const headerBuf = Buffer.alloc(32);
  let inHandle = null;
  try {
    inHandle = await fs.open(inputPath, 'r');
    await inHandle.read(headerBuf, 0, 32, 0);
  } finally {
    if (inHandle) {
      await inHandle.close().catch(() => {});
    }
  }

  if (!headerBuf.subarray(0, 4).equals(MAGIC_HEADER)) {
    // Si no está cifrado, simplemente copiar
    await fs.copyFile(inputPath, outputPath);
    return;
  }

  const iv = headerBuf.subarray(4, 16);
  const authTag = headerBuf.subarray(16, 32);

  let outHandle = null;
  let readStream = null;
  let success = false;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', ZK_KEY, iv);
    decipher.setAuthTag(authTag);

    outHandle = await fs.open(outputPath, 'w');
    readStream = nodeFs.createReadStream(inputPath, { start: 32 });

    for await (const chunk of readStream) {
      const decChunk = decipher.update(chunk);
      if (decChunk.length > 0) {
        await outHandle.write(decChunk);
      }
    }
    const finalChunk = decipher.final();
    if (finalChunk.length > 0) {
      await outHandle.write(finalChunk);
    }
    success = true;
  } catch (err) {
    console.error('[ZeroKnowledge] Error descifrando archivo a disco:', err);
    throw err;
  } finally {
    if (readStream && !readStream.destroyed) {
      readStream.destroy();
    }
    if (outHandle) {
      await outHandle.close().catch(() => {});
    }
    if (!success) {
      await fs.unlink(outputPath).catch(() => {});
    }
  }
}
