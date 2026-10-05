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
  folderId?: string | null; // ID de carpeta o 'root' o 'shared-with-me'
  sharedWithMe?: boolean;
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
  const { folderId, sharedWithMe, query, filterType = 'all', pageToken, pageSize = 100 } = params;

  const conditions: string[] = ['trashed = false'];

  const isSharedRoot = sharedWithMe || folderId === 'shared-with-me';

  // Si se solicita la raíz de compartidos conmigo
  if (isSharedRoot) {
    conditions.push('sharedWithMe = true');
  } else if (folderId) {
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
  const isGoogleDoc = (
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'application/vnd.google-apps.spreadsheet' ||
    mimeType === 'application/vnd.google-apps.presentation'
  );

  // Descarga limpia a través del proxy del backend (resuelve de raíz bloqueos de CORS y redirects 302 de Google Drive)
  const proxyUrl = `/api/cloud/drive-file?fileId=${encodeURIComponent(fileId)}&mimeType=${encodeURIComponent(mimeType || '')}${isGoogleDoc ? '&export=true' : ''}`;
  
  let proxyRes: Response;
  try {
    proxyRes = await fetch(proxyUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (netErr: any) {
    throw new Error(`No se pudo conectar con el servicio local de descarga: ${netErr.message}`);
  }

  if (!proxyRes.ok) {
    let errorMsg = `Error descargando ${fileName} (${proxyRes.status})`;
    try {
      const errJson = await proxyRes.json();
      if (errJson?.error) {
        errorMsg = errJson.error;
      }
    } catch (e) {}
    throw new Error(errorMsg);
  }

  const blob = await proxyRes.blob();

  // Determinar mimeType limpio
  let cleanMime = isGoogleDoc ? 'application/pdf' : mimeType;
  if (!cleanMime || cleanMime === 'application/octet-stream') {
    if (/\.mp4$/i.test(fileName)) cleanMime = 'video/mp4';
    else if (/\.webm$/i.test(fileName)) cleanMime = 'video/webm';
    else if (/\.mov$/i.test(fileName)) cleanMime = 'video/quicktime';
    else if (/\.mkv$/i.test(fileName)) cleanMime = 'video/x-matroska';
    else if (/\.avi$/i.test(fileName)) cleanMime = 'video/x-msvideo';
    else if (/\.jpg|\.jpeg$/i.test(fileName)) cleanMime = 'image/jpeg';
    else if (/\.png$/i.test(fileName)) cleanMime = 'image/png';
    else if (/\.webp$/i.test(fileName)) cleanMime = 'image/webp';
    else cleanMime = blob.type || 'application/octet-stream';
  }

  const outName = isGoogleDoc && !fileName.endsWith('.pdf') ? `${fileName.replace(/\.[^.]+$/, '')}.pdf` : fileName;
  const file = new File([blob], outName, { type: cleanMime });

  // Asociar thumbnail si existe
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
