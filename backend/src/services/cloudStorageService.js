import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  uploadBytesResumable,
  getDownloadURL, 
  deleteObject, 
  getBytes 
} from 'firebase/storage';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar configuración de Firebase Applet
let firebaseConfig = null;
const possiblePaths = [
  path.resolve(__dirname, '../../../firebase-applet-config.json'),
  path.resolve(__dirname, '../../frontend/src/firebase-applet-config.json'),
  path.resolve(__dirname, '../config/firebase-applet-config.json')
];

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    try {
      firebaseConfig = JSON.parse(fs.readFileSync(p, 'utf-8'));
      break;
    } catch (e) {}
  }
}

if (!firebaseConfig) {
  firebaseConfig = {
    projectId: "gen-lang-client-0029347446",
    storageBucket: "gen-lang-client-0029347446.firebasestorage.app"
  };
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const cloudStorage = getStorage(app);

console.log('[CloudStorage] Firebase Storage inicializado con bucket:', cloudStorage.app.options.storageBucket);

/**
 * Sube un buffer o archivo cifrado con Zero-Knowledge al bucket de Firebase Storage
 * @param {string} destinationPath - Ruta relativa dentro del bucket (ej: media/user123/image/file1.webp.enc)
 * @param {Buffer|Uint8Array|string} dataOrPath - Contenido binario o ruta del archivo en disco
 * @param {string} contentType - Tipo MIME de almacenamiento (application/octet-stream para máxima privacidad)
 * @returns {Promise<{ storagePath: string, downloadUrl: string }>}
 */
export async function uploadToCloudStorage(destinationPath, dataOrPath, contentType = 'application/octet-stream') {
  try {
    const fileRef = ref(cloudStorage, destinationPath);
    let payload = dataOrPath;

    if (typeof dataOrPath === 'string') {
      // Es una ruta de archivo en disco: abrir como Blob para streaming directo sin cargar a RAM
      if (typeof fs.openAsBlob === 'function') {
        payload = await fs.openAsBlob(dataOrPath);
      } else {
        payload = await fs.promises.readFile(dataOrPath);
      }
    }

    const metadata = {
      contentType,
      customMetadata: {
        encrypted: 'AES-256-GCM',
        zeroKnowledge: 'true',
        uploadedAt: new Date().toISOString()
      }
    };

    const size = payload.size || payload.length || 0;

    // Si el archivo supera 10MB o es un Blob de disco, usar subida reanudable por fragmentos
    if (size > 10 * 1024 * 1024 || typeof dataOrPath === 'string') {
      const task = uploadBytesResumable(fileRef, payload, metadata);
      await new Promise((resolve, reject) => {
        task.on(
          'state_changed',
          null,
          (err) => {
            console.error(`[CloudStorage] Error en subida reanudable de ${destinationPath}:`, err.message);
            reject(err);
          },
          () => resolve()
        );
      });
    } else {
      await uploadBytes(fileRef, payload, metadata);
    }

    const downloadUrl = await getDownloadURL(fileRef);
    console.log(`[CloudStorage] Archivo cifrado subido con éxito a Firebase: ${destinationPath}`);
    return { storagePath: destinationPath, downloadUrl };
  } catch (error) {
    console.error(`[CloudStorage] Error al subir ${destinationPath} a Firebase Storage:`, error.message);
    throw error;
  }
}

/**
 * Descarga el contenido binario (cifrado) desde Firebase Storage
 * @param {string} storagePath - Ruta del archivo en el bucket
 * @returns {Promise<Buffer>}
 */
export async function downloadFromCloudStorage(storagePath) {
  try {
    const fileRef = ref(cloudStorage, storagePath);
    // Para archivos pequeños usamos getBytes con límite aumentado a 500MB
    const arrayBuf = await getBytes(fileRef, 500 * 1024 * 1024);
    return Buffer.from(arrayBuf);
  } catch (error) {
    // Si falla getBytes por límite de memoria o cuota, intentar vía fetch directo con getDownloadURL
    try {
      const fileRef = ref(cloudStorage, storagePath);
      const url = await getDownloadURL(fileRef);
      const res = await fetch(url);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      }
    } catch (e2) {}

    if (error?.code === 'storage/object-not-found' || error?.message?.includes('object-not-found')) {
      return null;
    }
    console.warn(`[CloudStorage] Error descargando ${storagePath} de Firebase:`, error.message);
    return null;
  }
}

/**
 * Descarga un archivo de Firebase Storage directamente a una ruta de disco sin saturar memoria RAM
 * @param {string} storagePath - Ruta del archivo en el bucket
 * @param {string} targetDiskPath - Ruta de destino en disco local
 * @returns {Promise<boolean>}
 */
export async function downloadFromCloudStorageToFile(storagePath, targetDiskPath) {
  try {
    const fileRef = ref(cloudStorage, storagePath);
    const downloadUrl = await getDownloadURL(fileRef);
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    await fs.promises.mkdir(path.dirname(targetDiskPath), { recursive: true });
    const fileStream = fs.createWriteStream(targetDiskPath);
    const { pipeline } = await import('node:stream/promises');
    const { Readable } = await import('node:stream');
    await pipeline(Readable.fromWeb(res.body), fileStream);
    console.log(`[CloudStorage] Archivo descargado exitosamente de Firebase a disco: ${targetDiskPath}`);
    return true;
  } catch (error) {
    if (error?.code === 'storage/object-not-found' || error?.message?.includes('object-not-found')) {
      return false;
    }
    console.warn(`[CloudStorage] Error descargando ${storagePath} a disco:`, error.message);
    return false;
  }
}

/**
 * Elimina un archivo de Firebase Storage
 * @param {string} storagePath - Ruta del archivo a eliminar
 */
export async function deleteFromCloudStorage(storagePath) {
  try {
    const fileRef = ref(cloudStorage, storagePath);
    await deleteObject(fileRef);
    console.log(`[CloudStorage] Archivo eliminado de Firebase Storage: ${storagePath}`);
    return true;
  } catch (error) {
    console.warn(`[CloudStorage] No se pudo eliminar ${storagePath} de Firebase:`, error.message);
    return false;
  }
}
