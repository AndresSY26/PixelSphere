import fs from 'node:fs/promises';
import path from 'node:path';
import { saveMediaMetadata } from '../services/storageService.js';
import { UPLOADS_DIR } from '../config/constants.js';

export async function importFromCloud(req, res) {
  try {
    const { userId, externalUrl, filename, provider, mimeType } = req.body;

    if (!userId || !externalUrl) {
      return res.status(400).json({ error: 'Faltan datos de importación (userId o externalUrl).' });
    }

    const response = await fetch(externalUrl);
    if (!response.ok) {
      throw new Error(`Falla al descargar desde la nube (${response.statusText}).`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const fileId = Math.random().toString(36).substring(2, 11);
    const type = mimeType && mimeType.startsWith('video/') ? 'video' : 'image';

    const userPath = path.join(UPLOADS_DIR, userId, type);
    await fs.mkdir(userPath, { recursive: true });

    const cleanFilename = (filename || 'imported_file').replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    const diskName = `${fileId}_cloud_${cleanFilename}`;
    const filePath = path.join(userPath, diskName);
    const publicPath = `/uploads/${userId}/${type}/${diskName}`;

    await fs.writeFile(filePath, buffer);

    const newMedia = {
      id: fileId,
      userId,
      type,
      url: publicPath,
      path: publicPath,
      thumbnailUrl: publicPath,
      filename: `Cloud_${filename || 'file'}`,
      size: buffer.length,
      mimeType: mimeType || 'image/jpeg',
      tags: ['cloud-import', provider || 'external'],
      isPrivate: false,
      createdAt: new Date().toISOString(),
      metadata: {
        cameraSource: provider || 'cloud',
        cloudId: `ext_${fileId}`
      }
    };

    await saveMediaMetadata(newMedia);
    return res.status(201).json({ success: true, item: newMedia });
  } catch (error) {
    console.error('[CloudController] Error en importación:', error);
    return res.status(500).json({ error: 'Falla en la importación de medios.', details: error.message });
  }
}
