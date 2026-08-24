
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { saveMediaMetadata } from '@/lib/storage-core';
import { UPLOADS_DIR } from '@/lib/storage-constants';
import { Media } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * MOTOR DE IMPORTACIÓN CLOUD v1.0
 * Descarga archivos reales desde URLs externas a la infraestructura física local.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, externalUrl, filename, provider, mimeType } = await req.json();

    if (!userId || !externalUrl) {
      return NextResponse.json({ error: 'Faltan datos de importación.' }, { status: 400 });
    }

    // 1. Descargar el archivo binario
    const response = await fetch(externalUrl);
    if (!response.ok) throw new Error("Falla al descargar desde la nube pública.");
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const fileId = Math.random().toString(36).substring(2, 11);
    const type = mimeType?.startsWith('video/') ? 'video' : 'image';
    
    // 2. Crear directorios físicos
    const userPath = path.join(UPLOADS_DIR, userId, type);
    await fs.mkdir(userPath, { recursive: true });

    const cleanName = `${fileId}_cloud_${filename.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`;
    const filePath = path.join(userPath, cleanName);
    const publicPath = `/uploads/${userId}/${type}/${cleanName}`;

    // 3. Escribir a disco (Persistencia Física)
    await fs.writeFile(filePath, buffer);

    // 4. Registrar en el Nexo
    const newMedia: Media = {
      id: fileId,
      userId,
      type: type as 'image' | 'video',
      url: publicPath,
      path: publicPath,
      thumbnailUrl: publicPath, // Usamos la misma para fotos cloud por ahora
      filename: `Cloud_${filename}`,
      size: buffer.length,
      width: 1920,
      height: 1080,
      mimeType: mimeType || 'image/jpeg',
      tags: ['cloud-import', provider],
      isPrivate: false,
      createdAt: new Date().toISOString(),
      metadata: {
        cameraSource: provider as any,
        cloudId: `ext_${fileId}`
      }
    };

    await saveMediaMetadata(newMedia);

    return NextResponse.json({ success: true, item: newMedia });
  } catch (error: any) {
    console.error("Error en motor de importación:", error);
    return NextResponse.json({ error: 'Falla en la orquestación física.', details: error.message }, { status: 500 });
  }
}
