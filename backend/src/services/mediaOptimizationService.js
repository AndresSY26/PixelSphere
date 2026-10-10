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

/**
 * Convierte cualquier imagen a WebP de alta fidelidad y genera su miniatura WebP
 */
export async function optimizeImageToWebP(input, thumbnailPath = null) {
  const image = sharp(input);
  const metadata = await image.metadata();

  // Optimización WebP (calidad visual excelente con 70%-90% reducción de peso)
  const webpBuffer = await sharp(input)
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  let thumbBuffer = null;
  if (thumbnailPath) {
    thumbBuffer = await sharp(webpBuffer)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 70 })
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
 * Transcodifica cualquier video (MP4, MOV, MKV, AVI) a WebM ultraligero con deducción sustancial de peso (40%-65%) y extrae miniatura WebP
 */
export async function optimizeVideoToWebM(inputPath, outputWebmPath, thumbnailPath) {
  let inWidth = 1280;
  let inHeight = 720;
  let inDuration = 0;
  let inBitrate = 900000;
  let inSize = 0;

  try {
    const inputStat = await fs.stat(inputPath);
    inSize = inputStat.size;
  } catch (e) {}

  // 1. Sondear metadatos del video original (resolución, duración, bitrate)
  try {
    const probeProc = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,bit_rate:format=duration,size,bit_rate',
      '-of', 'json',
      inputPath
    ]);
    let stdout = '';
    probeProc.stdout.on('data', d => { stdout += d.toString(); });
    await new Promise(r => probeProc.on('close', () => r()));
    const meta = JSON.parse(stdout);
    if (meta?.streams?.[0]) {
      inWidth = parseInt(meta.streams[0].width, 10) || inWidth;
      inHeight = parseInt(meta.streams[0].height, 10) || inHeight;
    }
    inDuration = parseFloat(meta?.format?.duration) || 0;
    const probedBitrate = parseInt(meta?.format?.bit_rate, 10) || parseInt(meta?.streams?.[0]?.bit_rate, 10);
    if (probedBitrate && probedBitrate > 100000) {
      inBitrate = probedBitrate;
    } else if (inDuration > 0 && inSize > 0) {
      inBitrate = Math.round((inSize * 8) / inDuration);
    }
  } catch (probeErr) {
    console.warn('[MediaOptimization] Sonda ffprobe falló, usando valores por defecto:', probeErr.message);
  }

  // 2. Calcular tasa de bits óptima para garantizar reducción sustancial de peso respecto al MP4 (40%-65%)
  // Tomamos el 55% del bitrate original, con topes inteligentes según la resolución para mantener nitidez
  let maxBitrateCap = 950000;
  if (inHeight <= 480) maxBitrateCap = 380000;
  else if (inHeight <= 720) maxBitrateCap = 650000;
  else maxBitrateCap = 950000;

  let targetVideoBitrate = Math.round(inBitrate * 0.55);
  targetVideoBitrate = Math.min(targetVideoBitrate, maxBitrateCap);
  targetVideoBitrate = Math.max(targetVideoBitrate, 260000); // Mínimo 260k para preservar legibilidad visual
  const maxrate = Math.round(targetVideoBitrate * 1.25);
  const bufsize = Math.round(targetVideoBitrate * 2);

  console.log(`[MediaOptimization] Transcodificando a WebM: ${inWidth}x${inHeight}, duración: ${inDuration.toFixed(1)}s, bitrate original: ${Math.round(inBitrate/1000)}k -> objetivo WebM: ${Math.round(targetVideoBitrate/1000)}k`);

  // 3. Ejecutar transcodificación a WebM (VP8/Opus) ultra-rápida y ligera
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-c:v', 'libvpx',
      '-crf', '34',
      '-b:v', `${targetVideoBitrate}`,
      '-maxrate', `${maxrate}`,
      '-bufsize', `${bufsize}`,
      '-quality', 'realtime',
      '-speed', '8',
      '-threads', '2',
      '-vf', "scale='min(1280,iw)':-2",
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-ac', '2',
      outputWebmPath
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', d => { stderr += d.toString(); });
    ffmpeg.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-300)}`));
    });
  });

  // 4. Extraer fotograma para la miniatura WebP (en el segundo 2 o 1)
  const seekSec = inDuration > 5 ? '00:00:02' : '00:00:00.5';
  const tempFramePath = `${outputWebmPath}.tempframe.jpg`;
  try {
    await new Promise((resolve) => {
      const ffThumb = spawn('ffmpeg', [
        '-y',
        '-ss', seekSec,
        '-i', outputWebmPath,
        '-vframes', '1',
        '-f', 'image2',
        tempFramePath
      ]);
      ffThumb.on('close', () => resolve());
    });

    if (thumbnailPath) {
      const frameBuf = await fs.readFile(tempFramePath).catch(() => null);
      if (frameBuf) {
        const thumbBuf = await sharp(frameBuf)
          .resize({ width: 400, withoutEnlargement: true })
          .webp({ quality: 70 })
          .toBuffer();
        await fs.writeFile(thumbnailPath, thumbBuf);
      }
      await fs.unlink(tempFramePath).catch(() => {});
    }
  } catch (err) {
    console.warn('[MediaOptimization] Error extrayendo frame del video:', err.message);
  }

  const stat = await fs.stat(outputWebmPath);
  console.log(`[MediaOptimization] Transcodificación completada: original ${inSize} bytes -> WebM ${stat.size} bytes (${((1 - (stat.size / (inSize || stat.size))) * 100).toFixed(1)}% deducción)`);

  return {
    size: stat.size,
    width: inWidth > 1280 ? 1280 : inWidth,
    height: inWidth > 1280 ? Math.round(inHeight * (1280 / inWidth)) : inHeight,
    duration: inDuration,
    mimeType: 'video/webm'
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

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', ZK_KEY, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (error) {
    console.error('[ZeroKnowledge] Fallo al verificar integridad o descifrar activo:', error);
    throw new Error('Integridad criptográfica violada o clave incorrecta.');
  }
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

  const outHandle = await fs.open(outputPath, 'w');
  // Reservar 32 bytes de encabezado (MAGIC 4B + IV 12B + TAG 16B)
  await outHandle.write(Buffer.alloc(32));

  const readStream = nodeFs.createReadStream(inputPath);
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
  await outHandle.close();
}

/**
 * Descifra un archivo cifrado en disco a un archivo plano de salida
 */
export async function decryptFileZeroKnowledge(inputPath, outputPath) {
  const inHandle = await fs.open(inputPath, 'r');
  const headerBuf = Buffer.alloc(32);
  await inHandle.read(headerBuf, 0, 32, 0);
  await inHandle.close();

  if (!headerBuf.subarray(0, 4).equals(MAGIC_HEADER)) {
    // Si no está cifrado, simplemente copiar
    await fs.copyFile(inputPath, outputPath);
    return;
  }

  const iv = headerBuf.subarray(4, 16);
  const authTag = headerBuf.subarray(16, 32);

  const decipher = crypto.createDecipheriv('aes-256-gcm', ZK_KEY, iv);
  decipher.setAuthTag(authTag);

  const outHandle = await fs.open(outputPath, 'w');
  const readStream = nodeFs.createReadStream(inputPath, { start: 32 });

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
  await outHandle.close();
}
