"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Loader2, 
  Check, 
  FileVideo, 
  FileImage, 
  FileText,
  FileArchive,
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Download,
  AlertCircle,
  RefreshCw,
  FolderTree,
  CheckSquare,
  Square,
  Home,
  Users,
  LayoutGrid,
  List,
  X,
  Sparkles
} from 'lucide-react';
import { 
  GoogleDriveFile, 
  listDriveFiles, 
  downloadDriveFile 
} from '@/lib/google-drive';
import { getAccessToken, googleSignIn } from '@/lib/google-auth';
import { useToast } from '@/hooks/use-toast';
import { cn, formatBytes } from '@/lib/utils';

interface GoogleDrivePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelected?: (files: File[]) => void;
  onDriveFilesSelected?: (files: GoogleDriveFile[]) => void;
  userId?: string;
  targetAlbumId?: string;
  onImportSuccess?: () => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function GoogleDrivePicker({ 
  isOpen, 
  onClose, 
  onFilesSelected,
  onDriveFilesSelected,
  userId,
  targetAlbumId,
  onImportSuccess
}: GoogleDrivePickerProps) {
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  // Mapa de elementos seleccionados persistente entre navegación de diferentes carpetas
  const [selectedItemsMap, setSelectedItemsMap] = useState<Map<string, GoogleDriveFile>>(new Map());
  const selectedIds = new Set(selectedItemsMap.keys());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  
  // Por defecto: Navegación jerárquica de carpetas (Drive estructurado)
  const [driveSection, setDriveSection] = useState<'my-drive' | 'shared-with-me'>('my-drive');
  const [viewMode, setViewMode] = useState<'folders' | 'flat'>('folders');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 'root', name: 'Mi Unidad' }]);
  const [filterType, setFilterType] = useState<'all' | 'media' | 'images' | 'videos' | 'docs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const { toast } = useToast();

  const currentFolder = breadcrumbs[breadcrumbs.length - 1] || { id: 'root', name: 'Mi Unidad' };
  const currentFolderId = viewMode === 'folders' ? currentFolder.id : null;

  const handleSwitchSection = (section: 'my-drive' | 'shared-with-me') => {
    setDriveSection(section);
    setSearchQuery('');
    if (section === 'my-drive') {
      const rootCrumb = [{ id: 'root', name: 'Mi Unidad' }];
      setBreadcrumbs(rootCrumb);
      fetchFiles(undefined, false, '', 'root', filterType);
    } else {
      const sharedCrumb = [{ id: 'shared-with-me', name: 'Compartido conmigo' }];
      setBreadcrumbs(sharedCrumb);
      fetchFiles(undefined, false, '', 'shared-with-me', filterType);
    }
  };

  const fetchFiles = async (
    token?: string, 
    isLoadMore = false, 
    customQuery?: string,
    customFolderId?: string | null,
    customFilter?: 'all' | 'media' | 'images' | 'videos' | 'docs'
  ) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setAuthError(null);

    try {
      let currentToken = token || (await getAccessToken());
      if (!currentToken) {
        setAuthError('REQUIRES_AUTH');
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      const activeFolder = customFolderId !== undefined ? customFolderId : currentFolderId;
      const activeFilter = customFilter || filterType;
      const activeQuery = customQuery !== undefined ? customQuery : searchQuery;
      const isSharedSection = activeFolder === 'shared-with-me';

      const result = await listDriveFiles(currentToken, {
        folderId: activeFolder,
        sharedWithMe: isSharedSection,
        query: activeQuery,
        filterType: activeFilter,
        pageToken: isLoadMore ? nextPageToken : null,
        pageSize: 100
      });

      if (isLoadMore) {
        setFiles(prev => [...prev, ...result.files]);
      } else {
        setFiles(result.files);
      }
      setNextPageToken(result.nextPageToken || null);
    } catch (err: any) {
      console.error('Error cargando Google Drive:', err);
      setAuthError(err.message || 'Error al conectar con Google Drive');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Carga inicial y cambios de carpeta
  useEffect(() => {
    if (isOpen) {
      fetchFiles(undefined, false, searchQuery, currentFolderId, filterType);
    }
  }, [isOpen, viewMode, breadcrumbs.length, filterType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFiles(undefined, false, searchQuery, searchQuery.trim() ? null : currentFolderId, filterType);
  };

  const handleFilterChange = (type: 'all' | 'media' | 'images' | 'videos' | 'docs') => {
    setFilterType(type);
  };

  // Entrar a una carpeta
  const handleOpenFolder = (folder: GoogleDriveFile) => {
    if (folder.mimeType === 'application/vnd.google-apps.folder') {
      setViewMode('folders');
      setSearchQuery('');
      setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
      fetchFiles(undefined, false, '', folder.id, filterType);
    }
  };

  // Navegar a una posición en el rastro de migas (Breadcrumbs)
  const handleNavigateBreadcrumb = (index: number) => {
    setSearchQuery('');
    const targetCrumbs = breadcrumbs.slice(0, index + 1);
    const targetCrumb = targetCrumbs[targetCrumbs.length - 1];
    setBreadcrumbs(targetCrumbs);
    fetchFiles(undefined, false, '', targetCrumb.id, filterType);
  };

  // Subir un nivel
  const handleGoUpOneLevel = () => {
    if (breadcrumbs.length > 1) {
      setSearchQuery('');
      const targetCrumbs = breadcrumbs.slice(0, breadcrumbs.length - 1);
      const targetCrumb = targetCrumbs[targetCrumbs.length - 1];
      setBreadcrumbs(targetCrumbs);
      fetchFiles(undefined, false, '', targetCrumb.id, filterType);
    }
  };

  // Selección de archivos con persistencia entre múltiples carpetas
  const toggleSelectFile = (file: GoogleDriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      handleOpenFolder(file);
      return;
    }

    setSelectedItemsMap(prev => {
      const next = new Map(prev);
      if (next.has(file.id)) {
        next.delete(file.id);
      } else {
        next.set(file.id, file);
      }
      return next;
    });
  };

  // Separar carpetas y archivos para mostrar en orden estructurado
  const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  const regularFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

  const toggleSelectAllInFolder = () => {
    const allSelectedInView = regularFiles.length > 0 && regularFiles.every(f => selectedItemsMap.has(f.id));

    setSelectedItemsMap(prev => {
      const next = new Map(prev);
      if (allSelectedInView) {
        regularFiles.forEach(f => next.delete(f.id));
      } else {
        regularFiles.forEach(f => next.set(f.id, f));
      }
      return next;
    });
  };

  const handleConnectGoogle = async () => {
    try {
      setIsLoading(true);
      const res = await googleSignIn();
      if (res?.accessToken) {
        localStorage.setItem('ps_google_linked', 'true');
        setAuthError(null);
        await fetchFiles(res.accessToken, false, searchQuery, currentFolderId, filterType);
        toast({ title: 'Google Conectado', description: 'Acceso a Google Drive verificado con éxito.' });
      }
    } catch (e: any) {
      if (
        e?.code !== 'auth/popup-closed-by-user' && 
        e?.code !== 'auth/cancelled-popup-request' &&
        !e?.message?.includes('cancelled-popup-request') &&
        !e?.message?.includes('popup-closed-by-user')
      ) {
        toast({ variant: 'destructive', title: 'Error Google', description: e.message || 'No se pudo conectar con Google' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Confirmar selección para enviarla al Laboratorio de Ingesta o procesar importación directa
  const handleConfirmSelection = async () => {
    const allSelected = Array.from(selectedItemsMap.values());
    if (allSelected.length === 0) return;

    if (onDriveFilesSelected) {
      onDriveFilesSelected(allSelected);
      onClose();
      return;
    }

    await handleImportSelected();
  };

  const handleImportSelected = async () => {
    let token = await getAccessToken();
    if (!token) {
      const gRes = await googleSignIn();
      token = gRes?.accessToken || null;
    }
    if (!token) {
      toast({ variant: 'destructive', title: 'Sesión Expirada', description: 'Por favor reconecta con Google.' });
      return;
    }

    const itemsToProcess = Array.from(selectedItemsMap.values());
    if (itemsToProcess.length === 0) return;

    setIsImporting(true);

    // Obtener ID de usuario activo
    let activeUserId = userId;
    if (!activeUserId && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ps_active_session');
        if (stored) {
          activeUserId = JSON.parse(stored).id;
        }
      } catch (e) {}
    }

    // 1. INGESTA DIRECTA SERVIDOR-A-SERVIDOR (Máxima velocidad, streaming a disco, sin límite de peso o cantidad)
    if (activeUserId) {
      try {
        setImportProgress({
          current: 1,
          total: itemsToProcess.length,
          name: `Iniciando transferencia masiva (${itemsToProcess.length} activos)...`
        });

        const res = await fetch('/api/cloud/import-drive-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: activeUserId,
            token: token,
            albumId: targetAlbumId || undefined,
            items: itemsToProcess.map(it => ({
              id: it.id,
              name: it.name,
              mimeType: it.mimeType,
              size: it.size
            }))
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error del servidor (${res.status})`);
        }

        const data = await res.json();

        if (data.importedCount > 0) {
          toast({
            title: '¡Importación Completada!',
            description: `Se importaron ${data.importedCount} de ${itemsToProcess.length} multimedia exitosamente en PixelSphere.`
          });

          // Disparar evento de sincronización para que la galería se actualice al instante
          window.dispatchEvent(new CustomEvent('neural-update', { 
            detail: { channel: 'MEDIA', data: { userId: activeUserId } } 
          }));

          if (onImportSuccess) {
            onImportSuccess();
          } else {
            onClose();
          }
          return;
        } else if (data.errors && data.errors.length > 0) {
          throw new Error(data.errors[0].error || 'No se pudo procesar ningún archivo.');
        }
      } catch (batchErr: any) {
        console.error('[DrivePicker] Error en ingesta batch del servidor:', batchErr);
        toast({
          variant: 'destructive',
          title: 'Error de Importación',
          description: batchErr.message || 'Error procesando lote de Google Drive'
        });
        if (batchErr.message?.includes('Token') || batchErr.message?.includes('expirado') || batchErr.message?.includes('401')) {
          setAuthError('REQUIRES_AUTH');
        }
      } finally {
        setIsImporting(false);
        setImportProgress(null);
      }
      return;
    }

    // 2. Fallback de descarga local si no hay sesión activa identificada
    const downloadedFiles: File[] = [];
    try {
      for (let i = 0; i < itemsToProcess.length; i++) {
        const item = itemsToProcess[i];
        setImportProgress({
          current: i + 1,
          total: itemsToProcess.length,
          name: item.name
        });

        const file = await downloadDriveFile(token, item.id, item.name, item.mimeType, item.thumbnailLink);
        downloadedFiles.push(file);
      }

      toast({
        title: 'Archivos Obtenidos',
        description: `Se descargaron ${downloadedFiles.length} archivos desde Google Drive.`
      });
      if (onFilesSelected) onFilesSelected(downloadedFiles);
      onClose();
    } catch (err: any) {
      console.error('Error importando desde Drive:', err);
      toast({
        variant: 'destructive',
        title: 'Error de Importación',
        description: err.message || 'Error al descargar archivo desde Google Drive'
      });
      if (err.message?.includes('Token') || err.message?.includes('expirado') || err.message?.includes('401')) {
        setAuthError('REQUIRES_AUTH');
      }
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const getFileIcon = (mimeType: string, className = "h-6 w-6") => {
    if (mimeType.startsWith('image/')) {
      return <FileImage className={cn(className, "text-primary")} />;
    }
    if (mimeType.startsWith('video/')) {
      return <FileVideo className={cn(className, "text-accent")} />;
    }
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('sheet') || mimeType.includes('presentation') || mimeType.includes('text')) {
      return <FileText className={cn(className, "text-emerald-400")} />;
    }
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('compressed')) {
      return <FileArchive className={cn(className, "text-orange-400")} />;
    }
    return <File className={cn(className, "text-white/60")} />;
  };

  const isAllSelectedInView = regularFiles.length > 0 && regularFiles.every(f => selectedIds.has(f.id));
  const totalSelectedBytes = Array.from(selectedItemsMap.values()).reduce((sum, item) => {
    return sum + (item.size ? parseInt(item.size, 10) : 0);
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isImporting && onClose()}>
      {/* 
        Responsive Dialog Container:
        - Mobile: Fullscreen native app view (h-[100dvh], fixed inset-0, zero border, rounded-none)
        - Tablet/Desktop: Refined modal (sm:w-[94vw] sm:max-w-[920px] sm:h-[88vh] sm:max-h-[840px] sm:rounded-3xl)
      */}
      <DialogContent className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 translate-x-0 translate-y-0 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full h-[100dvh] sm:h-[88vh] sm:max-h-[840px] sm:w-[94vw] sm:max-w-[920px] bg-[#090a0f] border-0 sm:border sm:border-white/10 p-0 overflow-hidden shadow-2xl z-[120] rounded-none sm:rounded-3xl flex flex-col focus:outline-none [&>button.absolute]:hidden">
        
        {/* HEADER PRINCIPAL */}
        <div className="shrink-0 p-3.5 sm:p-5 border-b border-white/10 bg-[#0a0a0c]/95 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            
            {/* Logo y Título */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-xl font-bold text-white flex items-center gap-2 truncate">
                  Google Drive
                  <span className="hidden sm:inline-block text-[11px] font-medium text-white/40 border border-white/10 rounded-full px-2 py-0.5">
                    Cloud Ingestion
                  </span>
                </DialogTitle>
                <DialogDescription className="text-white/50 text-[11px] sm:text-xs truncate">
                  {viewMode === 'folders' ? currentFolder.name : 'Todos los archivos'}
                </DialogDescription>
              </div>
            </div>

            {/* Acciones de Cabecera: Toggle de Vista (Grid/List), Refrescar, Cerrar */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Selector de Cuadrícula / Lista */}
              <div className="flex bg-white/5 border border-white/10 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setLayoutMode('grid')}
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                    layoutMode === 'grid' ? "bg-primary text-white shadow-sm" : "text-white/50 hover:text-white"
                  )}
                  title="Vista en cuadrícula"
                  aria-label="Vista en cuadrícula"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('list')}
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                    layoutMode === 'list' ? "bg-primary text-white shadow-sm" : "text-white/50 hover:text-white"
                  )}
                  title="Vista en lista"
                  aria-label="Vista en lista"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {!authError && (
                <button 
                  type="button"
                  onClick={() => fetchFiles(undefined, false, searchQuery, currentFolderId, filterType)} 
                  disabled={isLoading}
                  className="h-8 w-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                  title="Actualizar carpeta"
                  aria-label="Actualizar"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin text-primary")} />
                </button>
              )}

              {/* Botón Cerrar Ergonómico para móviles */}
              <button
                type="button"
                onClick={onClose}
                disabled={isImporting}
                className="h-8 w-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Cerrar"
                aria-label="Cerrar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Subcabecera: Secciones Principales & Modos */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/5">
            {/* Segmented Control: Mi Unidad vs Compartido */}
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => handleSwitchSection('my-drive')}
                className={cn(
                  "px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                  driveSection === 'my-drive' 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : "text-white/60 hover:text-white"
                )}
              >
                <Home className="h-3.5 w-3.5" />
                <span>Mi Unidad</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchSection('shared-with-me')}
                className={cn(
                  "px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                  driveSection === 'shared-with-me' 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : "text-white/60 hover:text-white"
                )}
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Compartido</span>
                <span className="xs:hidden">Compart.</span>
              </button>
            </div>

            {/* Toggle Estructura / Plano */}
            <button
              type="button"
              onClick={() => {
                const nextMode = viewMode === 'folders' ? 'flat' : 'folders';
                setViewMode(nextMode);
              }}
              className={cn(
                "px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-1.5 shrink-0",
                viewMode === 'folders'
                  ? "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                  : "bg-primary/20 border-primary/40 text-primary"
              )}
              title="Cambiar entre vista estructurada con carpetas y lista sin carpetas"
            >
              <FolderTree className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{viewMode === 'folders' ? 'Carpetas activas' : 'Vista Plana'}</span>
              <span className="sm:hidden">{viewMode === 'folders' ? 'Carpetas' : 'Plano'}</span>
            </button>
          </div>

          {/* Barra de Migas de Pan (Breadcrumbs) Horizontal Adaptable */}
          {viewMode === 'folders' && (
            <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-white/5 text-xs overflow-hidden">
              {breadcrumbs.length > 1 && (
                <button
                  type="button"
                  onClick={handleGoUpOneLevel}
                  className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center gap-1 shrink-0 font-medium text-[11px]"
                  title="Subir al nivel superior"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Atrás</span>
                </button>
              )}

              {/* Rastro desplazable horizontalmente */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-0.5 flex-1 min-w-0">
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-white/30" />}
                      <button
                        type="button"
                        onClick={() => handleNavigateBreadcrumb(idx)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs whitespace-nowrap transition-colors shrink-0",
                          isLast 
                            ? "bg-primary/15 text-primary font-bold border border-primary/20" 
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        )}
                      >
                        {crumb.id === 'shared-with-me' ? (
                          <Users className="h-3 w-3 text-sky-400" />
                        ) : crumb.id === 'root' ? (
                          <Home className="h-3 w-3" />
                        ) : (
                          <Folder className="h-3 w-3 text-amber-400" />
                        )}
                        <span className="truncate max-w-[120px] sm:max-w-[180px]">{crumb.name}</span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* TOOLBAR: BÚSQUEDA Y FILTROS */}
        {!authError && (
          <div className="shrink-0 px-3.5 sm:px-6 py-2.5 border-b border-white/5 bg-[#0e0f14]/60 space-y-2">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              {/* Input de Búsqueda */}
              <form onSubmit={handleSearch} className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                <Input
                  placeholder={`Buscar en ${viewMode === 'folders' ? currentFolder.name : 'todo Drive'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-16 bg-white/5 border-white/10 rounded-xl h-8 sm:h-9 text-xs text-white placeholder:text-white/30"
                />
                {searchQuery && (
                  <button 
                    type="button" 
                    onClick={() => { setSearchQuery(''); fetchFiles(undefined, false, '', currentFolderId, filterType); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/10"
                  >
                    Borrar
                  </button>
                )}
              </form>

              {/* Chips de Filtro Horizontalmente Desplazables */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-0.5">
                {(['all', 'media', 'images', 'videos', 'docs'] as const).map((type) => {
                  const labelMap = {
                    all: 'Todo',
                    media: 'Fotos & Videos',
                    images: 'Fotos',
                    videos: 'Videos',
                    docs: 'Docs'
                  };
                  const isActive = filterType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleFilterChange(type)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all shrink-0",
                        isActive
                          ? "bg-primary text-white shadow-sm"
                          : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                      )}
                    >
                      {labelMap[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fila de Estadísticas y Selector Masivo */}
            <div className="flex items-center justify-between text-[11px] text-white/50 px-0.5">
              <span className="truncate">
                {folders.length} {folders.length === 1 ? 'carpeta' : 'carpetas'} · {regularFiles.length} {regularFiles.length === 1 ? 'archivo' : 'archivos'}
              </span>

              {regularFiles.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllInFolder}
                  className="flex items-center gap-1.5 text-primary hover:text-accent font-semibold transition-colors shrink-0 ml-2"
                >
                  {isAllSelectedInView ? (
                    <>
                      <CheckSquare className="h-3.5 w-3.5" />
                      <span>Deseleccionar ({regularFiles.length})</span>
                    </>
                  ) : (
                    <>
                      <Square className="h-3.5 w-3.5" />
                      <span>Seleccionar ({regularFiles.length})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* CUERPO DEL EXPLORADOR */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6">
          {authError ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
                <AlertCircle className="h-7 w-7" />
              </div>
              <div className="space-y-1 max-w-sm">
                <p className="text-white font-bold text-base">Vinculación de Google Requerida</p>
                <p className="text-white/50 text-xs">
                  Para explorar tus fotos, videos y documentos de Google Drive, autoriza el acceso a tu cuenta.
                </p>
              </div>
              <Button 
                onClick={handleConnectGoogle} 
                disabled={isLoading}
                className="bg-primary text-white rounded-2xl font-bold px-6 h-11 shadow-lg shadow-primary/25"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Conectar con Google Drive
              </Button>
            </div>
          ) : isLoading ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-xs text-white/50 font-mono">
                Cargando contenido de {currentFolder.name}...
              </p>
            </div>
          ) : files.length === 0 ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-white/5 rounded-2xl gap-3">
              <FolderOpen className="h-10 w-10 text-white/20" />
              <div className="space-y-1 max-w-xs">
                <p className="text-white font-semibold text-sm">
                  {driveSection === 'shared-with-me' && breadcrumbs.length === 1
                    ? 'No hay archivos compartidos contigo'
                    : 'Carpeta sin elementos'}
                </p>
                <p className="text-white/40 text-xs">
                  {breadcrumbs.length > 1 
                    ? 'Puedes regresar al nivel superior para explorar más carpetas.' 
                    : 'Los elementos almacenados en tu Google Drive aparecerán aquí.'}
                </p>
              </div>
              {breadcrumbs.length > 1 && (
                <Button variant="outline" size="sm" onClick={handleGoUpOneLevel} className="rounded-xl border-white/10 bg-white/5 text-white h-8 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Volver arriba
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              
              {/* SECCIÓN 1: CARPETAS */}
              {folders.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white/60 uppercase tracking-wider">
                    <Folder className="h-3.5 w-3.5 text-amber-400" />
                    <span>Carpetas ({folders.length})</span>
                  </div>

                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        onClick={() => handleOpenFolder(folder)}
                        className="group flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-amber-400/40 hover:bg-amber-400/[0.05] transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Folder className="h-4 w-4 text-amber-400 fill-amber-400/20" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors" title={folder.name}>
                              {folder.name}
                            </p>
                            <p className="text-[10px] text-white/40 font-mono">
                              {folder.modifiedTime ? new Date(folder.modifiedTime).toLocaleDateString() : 'Carpeta'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-white/30 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1.5" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECCIÓN 2: ARCHIVOS (GRID O LISTA) */}
              {regularFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white/60 uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span>Archivos ({regularFiles.length})</span>
                    </div>
                    <span className="text-[10px] text-white/40 font-normal lowercase">
                      {layoutMode === 'grid' ? 'vista cuadrícula' : 'vista lista'}
                    </span>
                  </div>

                  {layoutMode === 'grid' ? (
                    /* VISTA EN CUADRÍCULA */
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                      {regularFiles.map((file) => {
                        const isSelected = selectedIds.has(file.id);
                        const isVideo = file.mimeType.startsWith('video/');
                        const isImage = file.mimeType.startsWith('image/');

                        return (
                          <div
                            key={file.id}
                            onClick={() => toggleSelectFile(file)}
                            className={cn(
                              "group relative rounded-xl sm:rounded-2xl p-2 transition-all cursor-pointer border flex flex-col justify-between overflow-hidden active:scale-[0.98]",
                              isSelected 
                                ? "bg-primary/20 border-primary shadow-lg shadow-primary/20" 
                                : "bg-white/[0.03] border-white/5 hover:border-white/20 hover:bg-white/[0.05]"
                            )}
                          >
                            <div className="relative aspect-[4/3] w-full rounded-lg sm:rounded-xl overflow-hidden bg-black/50 mb-2 flex items-center justify-center">
                              {file.thumbnailLink ? (
                                <img
                                  src={file.thumbnailLink.replace(/=s\d+/, '=s400')}
                                  alt={file.name}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center p-2">
                                  {getFileIcon(file.mimeType, "h-7 w-7")}
                                </div>
                              )}

                              {/* Badge tipo */}
                              <span className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-md text-[8px] font-mono px-1.5 py-0.5 rounded text-white/90">
                                {isVideo ? 'VIDEO' : isImage ? 'FOTO' : 'DOC'}
                              </span>

                              {/* Indicador de Selección */}
                              <div className={cn(
                                "absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all",
                                isSelected 
                                  ? "bg-primary text-white shadow-md scale-100" 
                                  : "bg-black/40 border border-white/30 text-transparent opacity-60 group-hover:opacity-100"
                              )}>
                                <Check className="h-3 w-3 stroke-[3]" />
                              </div>
                            </div>

                            <div className="px-0.5">
                              <p className="text-xs font-bold text-white truncate" title={file.name}>
                                {file.name}
                              </p>
                              <div className="flex items-center justify-between text-[10px] text-white/50 font-mono mt-0.5">
                                <span>{file.size ? formatBytes(parseInt(file.size, 10)) : 'Drive'}</span>
                                <span className="hidden xs:inline">{file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* VISTA EN LISTA (Óptima para móviles y títulos largos) */
                    <div className="space-y-1.5">
                      {regularFiles.map((file) => {
                        const isSelected = selectedIds.has(file.id);
                        const isVideo = file.mimeType.startsWith('video/');
                        const isImage = file.mimeType.startsWith('image/');

                        return (
                          <div
                            key={file.id}
                            onClick={() => toggleSelectFile(file)}
                            className={cn(
                              "group flex items-center justify-between p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer border active:scale-[0.99]",
                              isSelected 
                                ? "bg-primary/20 border-primary shadow-sm" 
                                : "bg-white/[0.03] border-white/5 hover:border-white/20 hover:bg-white/[0.05]"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Miniatura */}
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/50 shrink-0 flex items-center justify-center border border-white/5">
                                {file.thumbnailLink ? (
                                  <img
                                    src={file.thumbnailLink.replace(/=s\d+/, '=s120')}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  getFileIcon(file.mimeType, "h-5 w-5")
                                )}
                              </div>

                              {/* Datos del archivo */}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate" title={file.name}>
                                  {file.name}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-white/50 font-mono mt-0.5">
                                  <span className="text-primary/90 font-semibold">
                                    {isVideo ? 'VIDEO' : isImage ? 'IMAGEN' : 'DOC'}
                                  </span>
                                  <span>·</span>
                                  <span>{file.size ? formatBytes(parseInt(file.size, 10)) : 'Drive'}</span>
                                  {file.modifiedTime && (
                                    <>
                                      <span className="hidden sm:inline">·</span>
                                      <span className="hidden sm:inline">{new Date(file.modifiedTime).toLocaleDateString()}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Checkbox de Selección Táctil Ergonómico */}
                            <div className="ml-2 shrink-0">
                              <div className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center transition-all border",
                                isSelected 
                                  ? "bg-primary border-primary text-white shadow-md shadow-primary/25" 
                                  : "border-white/20 bg-white/5 text-transparent group-hover:border-white/40"
                              )}>
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Botón Cargar Más */}
              {nextPageToken && (
                <div className="pt-2 pb-3 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchFiles(undefined, true, searchQuery, currentFolderId, filterType)}
                    disabled={isLoadingMore}
                    className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 text-xs h-9 px-4"
                  >
                    {isLoadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                    Cargar más archivos de Google Drive...
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Banner de progreso de importación */}
          {isImporting && importProgress && (
            <div className="mt-4 p-3.5 bg-primary/10 border border-primary/20 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs text-white">
                <span className="font-bold flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Descargando e importando ({importProgress.current} de {importProgress.total})
                </span>
                <span className="font-mono text-white/50 truncate max-w-[150px] sm:max-w-[200px]">
                  {importProgress.name}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACCIONES: STICKY INFERIOR CON SOPORTE MÓVIL Y SAFE-AREA */}
        <div className="shrink-0 p-3.5 sm:p-5 border-t border-white/10 bg-[#0a0a0c]/95 backdrop-blur-xl flex flex-col xs:flex-row items-stretch xs:items-center justify-between gap-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          
          <div className="flex items-center justify-between xs:justify-start gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose} 
              disabled={isImporting} 
              className="rounded-xl text-white/70 hover:text-white text-xs h-9 px-3"
            >
              Cancelar
            </Button>

            {selectedItemsMap.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedItemsMap(new Map())}
                className="text-[11px] text-white/50 hover:text-red-400 underline font-medium transition-colors"
              >
                Limpiar selección
              </button>
            )}
          </div>

          {!authError && (
            <div className="flex items-center gap-2">
              {/* Contador Resumen */}
              {selectedItemsMap.size > 0 && (
                <div className="hidden sm:flex flex-col items-end text-right mr-1">
                  <span className="text-xs font-bold text-white">
                    {selectedItemsMap.size} {selectedItemsMap.size === 1 ? 'seleccionado' : 'seleccionados'}
                  </span>
                  {totalSelectedBytes > 0 && (
                    <span className="text-[10px] text-white/40 font-mono">
                      {formatBytes(totalSelectedBytes)}
                    </span>
                  )}
                </div>
              )}

              {/* Botón Principal de Acción */}
              <Button
                onClick={handleConfirmSelection}
                disabled={selectedItemsMap.size === 0 || isImporting}
                className="w-full xs:w-auto bg-primary hover:bg-primary/90 text-white rounded-xl sm:rounded-2xl font-bold px-5 sm:px-6 h-11 sm:h-11 shadow-lg shadow-primary/20 text-xs sm:text-sm"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transfiriendo...
                  </>
                ) : onDriveFilesSelected ? (
                  <>
                    <Check className="mr-1.5 h-4 w-4 stroke-[3]" />
                    Añadir al Laboratorio ({selectedItemsMap.size})
                  </>
                ) : (
                  <>
                    <Download className="mr-1.5 h-4 w-4" />
                    Importar a PixelSphere ({selectedItemsMap.size})
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
