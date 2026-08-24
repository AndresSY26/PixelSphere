
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureDirectories, saveMediaMetadata } from '@/lib/storage-core';
import { UPLOADS_DIR } from '@/lib/storage-constants';
import { Media } from '@/lib/types';

export const maxDuration = 3600; 
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await ensureDirectories();

  try {
    const formData = await req.formData();
    const userId = formData.get('userId') as string;
    const filename = formData.get('filename') as string;
    const fileId = formData.get('fileId') as string || Math.random().toString(36).substring(2, 11);
    const chunkIndex = parseInt(formData.get('chunkIndex') as string || '0');
    const totalChunks = parseInt(formData.get('totalChunks') as string || '1');
    const isAdultContent = formData.get('isAdult') === 'true';
    const totalSize = parseInt(formData.get('filesize') as string || '0');
    const contentType = formData.get('contentType') as string || 'application/octet-stream';
    const chunkFile = formData.get('chunk') as File;
    const thumbnailB64 = formData.get('thumbnailB64') as string | null;

    if (!userId || !filename || !chunkFile) {
      return NextResponse.json({ error: 'Faltan metadatos o fragmento.' }, { status: 400 });
    }

    const type = contentType.startsWith('video/') ? 'video' : 'image';
    const userUploadPath = path.join(UPLOADS_DIR, userId, type);
    await fs.mkdir(userUploadPath, { recursive: true });
    
    const cleanFilename = `${fileId}_${filename.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`;
    const filePath = path.join(userUploadPath, cleanFilename);
    const publicPath = `/uploads/${userId}/${type}/${cleanFilename}`;

    const chunkBuffer = await chunkFile.arrayBuffer();
    if (chunkIndex === 0) await fs.writeFile(filePath, Buffer.from(chunkBuffer));
    else await appendFile(filePath, Buffer.from(chunkBuffer));

    if (chunkIndex === totalChunks - 1) {
      let finalThumbnailUrl = type === 'video' ? `${publicPath}#t=0.5` : publicPath;
      if (thumbnailB64 && type === 'video') {
        const thumbDir = path.join(UPLOADS_DIR, userId, 'thumbnails');
        await fs.mkdir(thumbDir, { recursive: true });
        const thumbName = `thumb_${fileId}.jpg`;
        await fs.writeFile(path.join(thumbDir, thumbName), Buffer.from(thumbnailB64.split(',')[1], 'base64'));
        finalThumbnailUrl = `/uploads/${userId}/thumbnails/${thumbName}`;
      }

      const newEntry: Media = {
        id: fileId, userId, type: type as 'image' | 'video',
        url: publicPath, path: publicPath, thumbnailUrl: finalThumbnailUrl,
        filename, size: totalSize, width: 1920, height: 1080, mimeType: contentType,
        tags: [], isPrivate: false, isAdultContent, createdAt: new Date().toISOString()
      };

      await saveMediaMetadata(newEntry);
      return NextResponse.json(newEntry);
    }
    
    return NextResponse.json({ status: 'chunk_received', index: chunkIndex });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error en ingesta.', details: error.message }, { status: 500 });
  }
}
