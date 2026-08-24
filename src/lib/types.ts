export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  vaultPasswordHash?: string;
  role: 'user' | 'admin';
  avatarUrl?: string;
  avatarSettings?: {
    zoom: number;
    rotation: number;
    posX: number;
    posY: number;
  };
  is2FAEnabled: boolean;
  twoFASecret?: string;
  biometricEnabled?: boolean;
  biometricCredentialId?: string;
  createdAt: string;
  recentRecipients?: string[];
  sessions?: Session[];
  filterPreferences?: {
    gallery?: GalleryFilters;
    albums?: AlbumFilters;
    search?: SearchFilters;
  };
  settings: UserSettings;
}

export interface GalleryFilters {
  viewMode?: 'grid' | 'list';
  filterType?: 'all' | 'image' | 'video';
  adultFilter?: 'all' | 'safe' | 'adult';
  sourceFilter?: 'all' | 'front' | 'back' | 'imported';
  sizeFilter?: 'all' | 'small' | 'large';
  sortBy?: 'date-desc' | 'date-asc' | 'name';
}

export interface AlbumFilters {
  sortBy?: 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';
}

export interface SearchFilters {
  filterType?: 'all' | 'image' | 'video';
  adultFilter?: 'all' | 'safe' | 'adult';
  sortBy?: 'date-desc' | 'date-asc' | 'name';
}

export interface UserSettings {
  accentColor: string;
  isDarkMode: boolean;
  interfaceDensity: 'default' | 'compact';
  glassIntensity: number;
  backgroundTheme: 'classic' | 'obsidian' | 'midnight';
  borderRadius: number;
  reducedMotion: boolean;
  videoAutoplay: boolean;
  lowResPreviews: boolean;
  gpuAcceleration: boolean;
  aiBackgroundAnalysis: boolean;
  vaultAutoLockEnabled?: boolean;
  vaultAutoLockTime?: number;
}

export interface Session {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface MediaPermissions {
  canDownload: boolean;
  canEditTags: boolean;
  expiresAt?: string;
  maxDownloads?: number;
  downloadCount?: number;
}

export interface Media {
  id: string;
  userId: string;
  type: 'image' | 'video';
  url: string;
  path: string;
  thumbnailUrl: string;
  filename: string;
  size: number;
  width: number;
  height: number;
  mimeType: string;
  tags: string[];
  description?: string;
  metadata?: {
    exif?: Record<string, any>;
    gps?: { lat: number; lng: number };
    device?: string;
    cameraSource?: 'front' | 'back' | 'imported';
    cloudId?: string;
    videoSettings?: {
      startTime?: number;
      endTime?: number;
      aspectRatio?: '16:9' | '9:16' | '4:5' | '1:1';
    };
  };
  isPrivate: boolean;
  isAdultContent?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  sharedWith?: string[];
  sharedPermissions?: Record<string, MediaPermissions>; // userId -> permissions
  createdAt: string;
  timestamp?: string;
}

export interface Album {
  id: string;
  userId: string;
  parentId?: string;
  title: string;
  description?: string;
  coverId?: string;
  mediaIds: string[];
  isPublic: boolean;
  sharedWith?: string[];
  sharedPermissions?: Record<string, MediaPermissions>;
  theme: 'compact' | 'masonry' | 'minimalist';
  createdAt: string;
}

export interface Achievement {
  id: string;
  userId: string;
  badgeId: string;
  unlockedAt: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const BADGES: Badge[] = [
  { id: 'first_upload', title: 'Pionero', description: 'Sube tu primera foto o video a tu galería.', icon: 'Upload' },
  { id: 'ten_uploads', title: 'Coleccionista', description: 'Sube un total de 10 archivos a tu cuenta.', icon: 'Library' },
  { id: 'fifty_uploads', title: 'Acumulador', description: 'Llega a los 50 archivos subidos en total.', icon: 'Library' },
  { id: 'hundred_uploads', title: 'Archivero', description: 'Sube un total de 100 fotos o videos a tu galería.', icon: 'HardDrive' },
  { id: 'five_hundred_uploads', title: 'Curador Maestro', description: 'Alcanza los 500 archivos subidos en tu cuenta.', icon: 'Layers' },
  { id: 'thousand_uploads', title: 'Deidad del Almacenamiento', description: 'Sube 1000 archivos a PixelSphere.', icon: 'Zap' },
  { id: 'first_video', title: 'Cineasta Iniciado', description: 'Sube tu primer video a la plataforma.', icon: 'Film' },
  { id: 'ten_videos', title: 'Productor', description: 'Sube un total de 10 videos a tu galería.', icon: 'Film' },
  { id: 'fifty_videos', title: 'Director de Cine', description: 'Sube un total de 50 videos a tu cuenta.', icon: 'Film' },
  { id: 'first_photo', title: 'Fotógrafo', description: 'Sube o captura tu primera foto.', icon: 'ImageIcon' },
  { id: 'ten_photos', title: 'Retratista', description: 'Sube un total de 10 fotos a tu galería.', icon: 'ImageIcon' },
  { id: 'fifty_photos', title: 'Artista Visual', description: 'Sube un total de 50 fotos a tu cuenta.', icon: 'ImageIcon' },
  { id: 'album_creator', title: 'Organizador', description: 'Crea tu primer álbum para organizar tus archivos.', icon: 'FolderPlus' },
  { id: 'five_albums', title: 'Estructurador', description: 'Crea un total de 5 álbumes diferentes.', icon: 'FolderPlus' },
  { id: 'ten_albums', title: 'Bibliotecario', description: 'Crea un total de 10 álbumes para tus fotos y videos.', icon: 'Library' },
  { id: 'nested_master', title: 'Inception', description: 'Crea un álbum dentro de otro álbum.', icon: 'Layers' },
  { id: 'collection_master', title: 'Maestro de Colecciones', description: 'Crea un total de 25 álbumes en tu cuenta.', icon: 'Layers' },
  { id: 'vault_setup', title: 'Criptógrafo', description: 'Crea una contraseña para proteger tu Carpeta Privada.', icon: 'Lock' },
  { id: 'vault_secure', title: 'El Centinela', description: 'Mueve tu primera foto o video a la Carpeta Privada.', icon: 'ShieldCheck' },
  { id: 'vault_expert', title: 'Búnker Personal', description: 'Guarda un total de 10 archivos en tu Carpeta Privada.', icon: 'ShieldCheck' },
  { id: 'ai_editor', title: 'Artista Neuronal', description: 'Usa la IA para editar una foto con una instrucción de texto.', icon: 'Sparkles' },
  { id: 'ai_pro', title: 'Visionario', description: 'Usa la IA para realizar 5 ediciones de fotos.', icon: 'Sparkles' },
  { id: 'ai_god', title: 'Inteligencia Superior', description: 'Usa la IA para editar un total de 25 fotos.', icon: 'Zap' },
  { id: 'manual_tweak', title: 'Retocador', description: 'Usa los controles manuales para editar una foto por primera vez.', icon: 'Wand2' },
  { id: 'manual_pro', title: 'Perfeccionista', description: 'Edita 10 fotos usando los controles manuales del editor.', icon: 'Wand2' },
  { id: 'storage_1gb', title: 'Primer Giga', description: 'Usa más de 1GB de espacio total en tu cuenta.', icon: 'Database' },
  { id: 'storage_10gb', title: 'Peso Pesado', description: 'Usa más de 10GB de espacio total en tu cuenta.', icon: 'Database' },
  { id: 'storage_full', title: 'Capacidad Crítica', description: 'Has usado casi todo tu espacio (más de 25GB).', icon: 'ShieldAlert' },
  { id: 'first_capture', title: 'Captura Real', description: 'Toma una foto o video usando la cámara de la aplicación.', icon: 'Camera' },
  { id: 'selfie_king', title: 'Narcisista', description: 'Toma 5 fotos usando la cámara frontal.', icon: 'Smartphone' },
  { id: 'back_cam_pro', title: 'Documentalista', description: 'Toma 5 fotos usando la cámara trasera.', icon: 'Camera' },
  { id: 'tagger_pro', title: 'Clasificador', description: 'Ponle etiquetas a más de 50 de tus fotos o videos.', icon: 'Tag' },
  { id: 'cleanup_done', title: 'Minimalista', description: 'Borra 10 archivos para liberar espacio.', icon: 'Trash2' },
  { id: 'portfolio_star', title: 'Figura Pública', description: 'Haz que uno de tus álbumes sea público.', icon: 'Globe' },
  { id: 'long_timer', title: 'Veterano', description: 'Usa PixelSphere durante más de 30 días.', icon: 'Timer' },
  { id: 'centurion', title: 'Centurión', description: 'Usa PixelSphere durante 100 días seguidos.', icon: 'Trophy' },
  { id: 'shared_first', title: 'Generoso', description: 'Comparte tu primer archivo o álbum con otro usuario.', icon: 'Share2' },
  { id: 'shared_five', title: 'Distribuidor', description: 'Comparte contenido con 5 personas diferentes.', icon: 'Users' },
  { id: 'shared_ten', title: 'Nodo Central', description: 'Comparte contenido con 10 personas de la red.', icon: 'Globe' },
  { id: 'received_first', title: 'Invitado', description: 'Recibe acceso a tu primer archivo compartido por otro usuario.', icon: 'Inbox' },
  { id: 'received_five', title: 'Conectado', description: 'Acumula acceso a 5 archivos compartidos por otros.', icon: 'Layers' },
  { id: 'public_link', title: 'Influencer', description: 'Genera un enlace de red público para una de tus colecciones.', icon: 'Link' },
  { id: 'avatar_master', title: 'Identidad Real', description: 'Personaliza tu perfil con una foto propia.', icon: 'User' },
  { id: 'style_expert', title: 'Diseñador', description: 'Cambia el color de acento de la plataforma.', icon: 'Palette' },
  { id: 'obsidian_night', title: 'Hijo del Vacío', description: 'Activa el tema Obsidian en tu configuración.', icon: 'Moon' },
  { id: 'midnight_voyager', title: 'Navegante Nocturno', description: 'Usa el tema Midnight en tu configuración.', icon: 'Target' },
  { id: 'glass_pro', title: 'Transparencia', description: 'Ajusta el nivel de desenfoque del efecto Glass.', icon: 'Box' },
  { id: 'session_guard', title: 'Guardián', description: 'Cierra una sesión activa de un dispositivo remoto.', icon: 'ShieldCheck' },
  { id: 'vault_timer', title: 'Reloj de Arena', description: 'Configura el tiempo de auto-bloqueo de tu bóveda.', icon: 'Timer' },
  { id: 'search_pro', title: 'Rastreador', description: 'Usa el buscador global para localizar un archivo.', icon: 'Search' },
  { id: 'tag_cloud_user', title: 'Navegante Semántico', description: 'Filtra tu galería usando la nube de etiquetas.', icon: 'Tag' },
  { id: 'bulk_zip', title: 'Empaquetador', description: 'Exporta una selección masiva de archivos en un ZIP.', icon: 'Download' },
  { id: 'vault_recovery', title: 'Liberador', description: 'Devuelve un archivo de la bóveda a la galería común.', icon: 'Unlock' },
  { id: 'cleaning_service', title: 'Eco-Friendly', description: 'Borra un total de 25 archivos de tu cuenta.', icon: 'Trash2' },
  { id: 'heavy_media', title: 'Peso Pesado', description: 'Sube un archivo que pese más de 100MB.', icon: 'Zap' },
  { id: 'giant_file', title: 'Coloso', description: 'Sube un archivo masivo de más de 500MB.', icon: 'Zap' },
  { id: 'data_beast', title: 'Bestia de Datos', description: 'Sube un activo superior a 1GB.', icon: 'Zap' },
  { id: 'horizontal_eye', title: 'Cinematográfico', description: 'Sube 20 fotos en formato horizontal.', icon: 'ImageIcon' },
  { id: 'vertical_view', title: 'Verticalista', description: 'Sube 20 fotos en formato vertical.', icon: 'Smartphone' },
  { id: 'camera_fan', title: 'Papazzo', description: 'Realiza 10 capturas usando la cámara del nexo.', icon: 'Camera' },
  { id: 'selfie_pro', title: 'Rey de las Selfies', description: 'Toma 10 fotos usando la cámara frontal.', icon: 'Smartphone' },
  { id: 'back_cam_expert', title: 'Fotoperiodista', description: 'Toma 10 fotos usando la cámara trasera.', icon: 'Camera' },
  { id: 'deep_folders', title: 'Arquitecto', description: 'Crea un álbum dentro de otro álbum (3 niveles).', icon: 'FolderPlus' },
  { id: 'mega_album', title: 'Enciclopedia', description: 'Ten un álbum con más de 50 archivos.', icon: 'Library' },
  { id: 'detail_oriented', title: 'Escriba', description: 'Añade descripciones a 10 de tus archivos.', icon: 'Info' },
  { id: 'tag_expert', title: 'Indexador', description: 'Ponle 5 o más etiquetas a una sola foto.', icon: 'Tag' },
  { id: 'full_shield', title: 'Blindaje Total', description: 'Ten activados el 2FA y la Biometría a la vez.', icon: 'ShieldCheck' },
  { id: 'multi_node', title: 'Omnipresente', description: 'Mantén sesiones abiertas en 3 dispositivos a la vez.', icon: 'Globe' },
  { id: 'world_traveler', title: 'Explorador Global', description: 'Registra fotos en 5 coordenadas GPS distintas.', icon: 'Navigation' },
  { id: 'night_owl', title: 'Búho Nocturno', description: 'Gestiona tu nexo después de la medianoche.', icon: 'Moon' },
  { id: 'early_bird', title: 'Madrugador', description: 'Sincroniza activos antes de las 7:00 AM.', icon: 'Sun' },
  { id: 'speed_ingestion', title: 'Velocidad Absoluta', description: 'Sube 5 archivos en menos de 30 segundos.', icon: 'Gauge' },
  { id: 'metadata_guru', title: 'Guru de Datos', description: 'Visualiza los metadatos técnicos de 20 archivos.', icon: 'Info' },
  { id: 'zoom_master', title: 'Zoom Infinito', description: 'Ajusta tu avatar usando el escalado máximo.', icon: 'Maximize2' },
  { id: 'session_cleaner', title: 'Limpieza de Nodos', description: 'Cierra todas las sesiones remotas activas.', icon: 'ShieldX' },
  { id: 'trash_restorer', title: 'Fénix', description: 'Restaura un activo que estaba destinado a la purga.', icon: 'RefreshCcw' },
  { id: 'renaming_wizard', title: 'Bautizador', description: 'Cambia el título de un álbum más de 3 veces.', icon: 'Type' },
  { id: 'filter_expert', title: 'Filtro Crítico', description: 'Usa el modo comparación en el editor 10 veces.', icon: 'Eye' },
  { id: 'pwa_fan', title: 'Nativo', description: 'Instala PixelSphere como aplicación de escritorio.', icon: 'Monitor' },
  { id: 'share_link_pro', title: 'Distribuidor Viral', description: 'Genera 5 enlaces de red en un solo día.', icon: 'Copy' },
  { id: 'color_collector', title: 'Caleidoscopio', description: 'Cambia el color de acento del sistema 5 veces.', icon: 'Paintbrush' },
  { id: 'density_ninja', title: 'Arquitecto de Espacio', description: 'Alterna entre interfaz compacta y normal.', icon: 'Layout' },
  { id: 'glass_enthusiast', title: 'Transparencia Total', description: 'Configura el efecto Glass al nivel máximo.', icon: 'Layers' },
  { id: 'private_archiver', title: 'Búnker al 50%', description: 'Mueve la mitad de tu galería a la Carpeta Privada.', icon: 'ShieldAlert' },
  { id: 'history_spectator', title: 'Auditor', description: 'Revisa tu historial de nexos 10 veces.', icon: 'History' },
  { id: 'notification_cleaner', title: 'Buzón Vacío', description: 'Limpia todas tus notificaciones de una vez.', icon: 'BellOff' },
  { id: 'long_video_lord', title: 'Cinematográfico', description: 'Sube un video de más de 5 minutos de duración.', icon: 'Video' },
  { id: 'tag_master', title: 'Indexador Supremo', description: 'Añade más de 10 etiquetas a un solo activo.', icon: 'Hash' },
  { id: 'search_ninja', title: 'Rastreador Veloz', description: 'Encuentra un archivo usando una etiqueta específica.', icon: 'Search' },
  { id: 'album_themer', title: 'Estilista de Carpetas', description: 'Cambia el tema visual de 3 álbumes.', icon: 'Palette' },
  { id: 'mass_deletion', title: 'Purga Masiva', description: 'Elimina 50 archivos de golpe de la papelera.', icon: 'Trash' },
  { id: 'backup_hero', title: 'Seguridad de Datos', description: 'Descarga una colección completa en formato ZIP.', icon: 'Download' },
  { id: 'multi_device_sync', title: 'Sincronización Total', description: 'Accede a tu nexo desde 3 dispositivos diferentes.', icon: 'Laptop' },
  { id: 'anniversary', title: 'Aniversario', description: 'Mantén tu nodo activo durante un año completo.', icon: 'Calendar' },
  { id: 'beta_tester', title: 'Pionero del Nexo', description: 'Usa todas las funciones del laboratorio de ingesta.', icon: 'FlaskConical' },
  { id: 'omega_orchestrator', title: 'Orquestador Omega', description: 'El hito final. Consigue el resto de medallas.', icon: 'Trophy' },
];
