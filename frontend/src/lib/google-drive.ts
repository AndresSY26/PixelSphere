/**
 * Google Drive API Client for PixelSphere
 * Permite listar y descargar cualquier archivo o carpeta desde Google Drive con el token OAuth del usuario.
 */

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  iconLink?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  hasThumbnail?: boolean;
  parents?: string[];
  webViewLink?: string;
}

export interface ListDriveFilesParams {
  folderId?: string | null; // ID de carpeta o 'root' o null para ver todo plano
  query?: string;
  filterType?: 'all' | 'media' | 'images' | 'videos' | 'docs';
  pageToken?: string | null;
  pageSize?: number;
}

export interface ListDriveResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

export async function listDriveFiles(
  accessToken: string,
  params: ListDriveFilesParams = {}
): Promise<ListDriveResponse> {
  const { folderId, query, filterType = 'all', pageToken, pageSize = 100 } = params;

  const conditions: string[] = ['trashed = false'];

  // Si se especifica una carpeta concreta, filtrar por esa carpeta
  if (folderId) {
    const safeFolder = folderId.replace(/'/g, "\\'");
    conditions.push(`'${safeFolder}' in parents`);
  }

  // Filtro por tipo de contenido (siempre permitiendo carpetas para no romper la navegación)
  if (filterType === 'media') {
    conditions.push("(mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'image/' or mimeType contains 'video/')");
  } else if (filterType === 'images') {
    conditions.push("(mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'image/')");
  } else if (filterType === 'videos') {
    conditions.push("(mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'video/')");
  } else if (filterType === 'docs') {
    conditions.push("(mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'application/' or mimeType contains 'text/')");
  }

  // Búsqueda por texto en nombre
  if (query && query.trim()) {
    const escaped = query.replace(/'/g, "\\'");
    conditions.push(`name contains '${escaped}'`);
  }

  const q = conditions.join(' and ');

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('pageSize', pageSize.toString());
  url.searchParams.set(
    'fields',
    'nextPageToken, files(id, name, mimeType, thumbnailLink, iconLink, size, createdTime, modifiedTime, hasThumbnail, parents, webViewLink)'
  );
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set('orderBy', 'folder,modifiedTime desc,name');

  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error al obtener archivos de Google Drive (${response.statusText})`);
  }

  const data = await response.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

// Compatibilidad con llamadas anteriores
export async function listDriveMediaFiles(accessToken: string, query?: string): Promise<GoogleDriveFile[]> {
  const res = await listDriveFiles(accessToken, { query, filterType: 'all', pageSize: 100 });
  return res.files;
}

/**
 * Descarga el archivo de Google Drive resolviendo advertencias de virus y conservando headers binarios intactos.
 */
export async function downloadDriveFile(
  accessToken: string,
  fileId: string,
  fileName: string,
  mimeType: string,
  thumbnailLink?: string
): Promise<File> {
  // Manejo de exportación de Google Docs / Sheets / Slides nativos
  if (mimeType === 'application/vnd.google-apps.document') {
    const expUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
    const res = await fetch(expUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Error exportando documento ${fileName}`);
    const blob = await res.blob();
    return new File([blob], `${fileName.replace(/\.pdf$/i, '')}.pdf`, { type: 'application/pdf' });
  }

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const expUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
    const res = await fetch(expUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Error exportando hoja de cálculo ${fileName}`);
    const blob = await res.blob();
    return new File([blob], `${fileName.replace(/\.pdf$/i, '')}.pdf`, { type: 'application/pdf' });
  }

  if (mimeType === 'application/vnd.google-apps.presentation') {
    const expUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
    const res = await fetch(expUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Error exportando presentación ${fileName}`);
    const blob = await res.blob();
    return new File([blob], `${fileName.replace(/\.pdf$/i, '')}.pdf`, { type: 'application/pdf' });
  }

  // Descarga de archivo binario (videos, imágenes, audios, zips)
  // IMPORTANTE: acknowledgeAbuse=true evita que Google Drive responda con página HTML de advertencia de virus en videos grandes
  // access_token en query string previene la pérdida de headers de autenticación en redirecciones entre dominios de Google
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  url.searchParams.set('alt', 'media');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('acknowledgeAbuse', 'true');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Error descargando archivo ${fileName} desde Google Drive (${response.statusText})`);
  }

  let blob = await response.blob();

  // Detección y recuperación en caso de que Google retorne HTML de aviso de virus
  if (blob.type.includes('text/html') || (blob.size < 50000 && !fileName.endsWith('.html'))) {
    try {
      const textSample = await blob.slice(0, 1500).text();
      if (textSample.includes('<!DOCTYPE html>') || textSample.includes('<html') || textSample.includes('Virus scan warning') || textSample.includes('download_warning')) {
        console.warn(`[GoogleDrive] Archivo ${fileName} retornó pantalla intermedia de Google. Intentando confirmar descarga...`);
        const confirmMatch = textSample.match(/confirm=([a-zA-Z0-9_-]+)/) || textSample.match(/name="confirm" value="([a-zA-Z0-9_-]+)"/);
        const confirmToken = confirmMatch ? confirmMatch[1] : 't';
        const retryUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}&access_token=${encodeURIComponent(accessToken)}`;
        const retryRes = await fetch(retryUrl);
        if (retryRes.ok) {
          const retryBlob = await retryRes.blob();
          if (!retryBlob.type.includes('text/html')) {
            blob = retryBlob;
          }
        }
      }
    } catch (parseErr) {
      console.warn('[GoogleDrive] No se pudo verificar la cabecera del blob:', parseErr);
    }
  }

  // Normalizar mimeType de videos o imágenes según extensión para garantizar compatibilidad
  let cleanMime = mimeType;
  if (!cleanMime || cleanMime === 'application/octet-stream') {
    if (/\.mp4$/i.test(fileName)) cleanMime = 'video/mp4';
    else if (/\.webm$/i.test(fileName)) cleanMime = 'video/webm';
    else if (/\.mov$/i.test(fileName)) cleanMime = 'video/quicktime';
    else if (/\.mkv$/i.test(fileName)) cleanMime = 'video/x-matroska';
    else if (/\.avi$/i.test(fileName)) cleanMime = 'video/x-msvideo';
    else if (/\.jpg|\.jpeg$/i.test(fileName)) cleanMime = 'image/jpeg';
    else if (/\.png$/i.test(fileName)) cleanMime = 'image/png';
    else cleanMime = blob.type || 'application/octet-stream';
  }

  const file = new File([blob], fileName, { type: cleanMime });

  // Si Google Drive ya nos proporcionó thumbnailLink, intentar obtenerlo como base64 para asociarlo
  if (thumbnailLink) {
    try {
      const highResThumb = thumbnailLink.replace(/=s\d+/, '=s600');
      const thumbRes = await fetch(highResThumb, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (thumbRes.ok) {
        const thumbBlob = await thumbRes.blob();
        const base64: string = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(thumbBlob);
        });
        if (base64) {
          (file as any).thumbnailB64 = base64;
        }
      }
    } catch (thumbErr) {
      console.warn('[GoogleDrive] No se pudo precargar thumbnail de Drive:', thumbErr);
    }
  }

  return file;
}
