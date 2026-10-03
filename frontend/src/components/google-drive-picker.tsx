"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Loader2, 
  Check, 
  HardDrive, 
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
  ListFilter,
  CheckSquare,
  Square,
  Home,
  CornerDownRight,
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
  onFilesSelected: (files: File[]) => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function GoogleDrivePicker({ isOpen, onClose, onFilesSelected }: GoogleDrivePickerProps) {
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  
  // Por defecto: Navegación jerárquica de carpetas (Drive estructurado)
  const [viewMode, setViewMode] = useState<'folders' | 'flat'>('folders');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 'root', name: 'Mi Unidad' }]);
  const [filterType, setFilterType] = useState<'all' | 'media' | 'images' | 'videos' | 'docs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const { toast } = useToast();

  const currentFolder = breadcrumbs[breadcrumbs.length - 1] || { id: 'root', name: 'Mi Unidad' };
  const currentFolderId = viewMode === 'folders' ? currentFolder.id : null;

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

      const result = await listDriveFiles(currentToken, {
        folderId: activeFolder,
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
    }
  };

  // Navegar a una posición en el rastro de migas (Breadcrumbs)
  const handleNavigateBreadcrumb = (index: number) => {
    setSearchQuery('');
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  // Subir un nivel
  const handleGoUpOneLevel = () => {
    if (breadcrumbs.length > 1) {
      setSearchQuery('');
      setBreadcrumbs(prev => prev.slice(0, prev.length - 1));
    }
  };

  // Selección de archivos
  const toggleSelectFile = (file: GoogleDriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      handleOpenFolder(file);
      return;
    }

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(file.id)) {
        next.delete(file.id);
      } else {
        next.add(file.id);
      }
      return next;
    });
  };

  // Separar carpetas y archivos para mostrar en orden estructurado
  const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  const regularFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

  const toggleSelectAllInFolder = () => {
    const fileIdsInView = regularFiles.map(f => f.id);
    const allSelected = fileIdsInView.every(id => selectedIds.has(id));

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        fileIdsInView.forEach(id => next.delete(id));
      } else {
        fileIdsInView.forEach(id => next.add(id));
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

  const handleImportSelected = async () => {
    const token = await getAccessToken();
    if (!token) {
      toast({ variant: 'destructive', title: 'Sesión Expirada', description: 'Por favor reconecta con Google.' });
      return;
    }

    // Buscar los archivos seleccionados de la lista actual o previa
    const itemsToDownload = files.filter(f => selectedIds.has(f.id));
    if (itemsToDownload.length === 0) return;

    setIsImporting(true);
    const downloadedFiles: File[] = [];

    try {
      for (let i = 0; i < itemsToDownload.length; i++) {
        const item = itemsToDownload[i];
        setImportProgress({
          current: i + 1,
          total: itemsToDownload.length,
          name: item.name
        });

        const file = await downloadDriveFile(token, item.id, item.name, item.mimeType, item.thumbnailLink);
        downloadedFiles.push(file);
      }

      toast({
        title: 'Archivos Obtenidos',
        description: `Se descargaron ${downloadedFiles.length} archivos desde Google Drive.`
      });
      onFilesSelected(downloadedFiles);
      onClose();
    } catch (err: any) {
      console.error('Error importando desde Drive:', err);
      toast({
        variant: 'destructive',
        title: 'Error de Importación',
        description: err.message
      });
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <FileImage className="h-7 w-7 text-primary" />;
    }
    if (mimeType.startsWith('video/')) {
      return <FileVideo className="h-7 w-7 text-accent" />;
    }
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('sheet') || mimeType.includes('presentation') || mimeType.includes('text')) {
      return <FileText className="h-7 w-7 text-emerald-400" />;
    }
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('compressed')) {
      return <FileArchive className="h-7 w-7 text-orange-400" />;
    }
    return <File className="h-7 w-7 text-white/50" />;
  };

  const isAllSelectedInView = regularFiles.length > 0 && regularFiles.every(f => selectedIds.has(f.id));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isImporting && onClose()}>
      <DialogContent className="w-full max-w-full sm:max-w-[880px] bg-[#0a0a0c] border-white/10 p-0 overflow-hidden shadow-2xl z-[120] sm:rounded-3xl">
        <DialogHeader className="p-6 pb-4 border-b border-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
                <svg className="h-6 w-6 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
                Explorador de Google Drive
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs sm:text-sm">
                Navega ordenadamente por tus carpetas y selecciona archivos para incorporar a tu bóveda.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              {/* Selector de Modo: Por Carpetas (Estructurado) vs Vista Plana */}
              <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('folders');
                  }}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5",
                    viewMode === 'folders' ? "bg-primary text-white shadow-md shadow-primary/30" : "text-white/60 hover:text-white"
                  )}
                  title="Navega como en Google Drive: Inicio, carpetas y subcarpetas"
                >
                  <FolderTree className="h-3.5 w-3.5" />
                  Estructura Drive
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('flat');
                  }}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[11px] font-bold transition-all",
                    viewMode === 'flat' ? "bg-primary text-white shadow-md shadow-primary/30" : "text-white/60 hover:text-white"
                  )}
                  title="Muestra todos los archivos sin separar por carpetas"
                >
                  Vista Plana
                </button>
              </div>

              {!authError && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => fetchFiles(undefined, false, searchQuery, currentFolderId, filterType)} 
                  disabled={isLoading}
                  className="text-muted-foreground hover:text-white rounded-xl"
                  title="Actualizar contenido"
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
              )}
            </div>
          </div>

          {/* Barra de Migas de Pan (Breadcrumbs) tipo Google Drive */}
          {viewMode === 'folders' && (
            <div className="flex items-center gap-2 pt-4 text-xs overflow-x-auto scrollbar-hide">
              {breadcrumbs.length > 1 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGoUpOneLevel}
                  className="h-8 px-2.5 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 gap-1.5 shrink-0"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-bold">Subir</span>
                </Button>
              )}

              <div className="flex items-center gap-1 bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-xl shrink-0">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-white/30" />}
                    <button
                      type="button"
                      onClick={() => handleNavigateBreadcrumb(idx)}
                      className={cn(
                        "flex items-center gap-1.5 transition-colors font-medium rounded-md px-1.5 py-0.5",
                        idx === breadcrumbs.length - 1 
                          ? "text-primary font-bold bg-primary/10" 
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {idx === 0 ? <Home className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5 text-amber-400" />}
                      <span className="truncate max-w-[140px]">{crumb.name}</span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </DialogHeader>

        {authError ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Conexión con Google requerida</p>
              <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
                Para navegar por tus carpetas y archivos de Google Drive, vincula tu cuenta de Google.
              </p>
            </div>
            <Button 
              onClick={handleConnectGoogle} 
              disabled={isLoading}
              className="bg-primary text-white rounded-2xl font-bold px-8 h-12 shadow-xl shadow-primary/20"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Conectar con Google Drive
            </Button>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-4">
            {/* Barra de Búsqueda y Filtros Rápidos */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <form onSubmit={handleSearch} className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Buscar en ${viewMode === 'folders' ? currentFolder.name : 'todo Google Drive'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-20 bg-white/5 border-white/10 rounded-2xl h-10 text-sm text-white"
                />
                {searchQuery && (
                  <button 
                    type="button" 
                    onClick={() => { setSearchQuery(''); fetchFiles(undefined, false, '', currentFolderId, filterType); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-white"
                  >
                    Limpiar
                  </button>
                )}
              </form>

              {/* Filtros rápidos de tipo */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {(['all', 'media', 'images', 'videos', 'docs'] as const).map((type) => {
                  const labelMap = {
                    all: 'Todo',
                    media: 'Fotos y Videos',
                    images: 'Fotos',
                    videos: 'Videos',
                    docs: 'Documentos'
                  };
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleFilterChange(type)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all",
                        filterType === type 
                          ? "bg-white/15 text-white border border-white/20" 
                          : "text-muted-foreground hover:text-white bg-white/5"
                      )}
                    >
                      {labelMap[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Barra de Resumen y Selección */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white/80">{currentFolder.name}:</span>
                <span>{folders.length} {folders.length === 1 ? 'carpeta' : 'carpetas'}, {regularFiles.length} {regularFiles.length === 1 ? 'archivo' : 'archivos'}</span>
              </div>

              {regularFiles.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllInFolder}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-accent font-bold transition-colors"
                >
                  {isAllSelectedInView ? (
                    <>
                      <CheckSquare className="h-3.5 w-3.5" /> Deseleccionar archivos ({regularFiles.length})
                    </>
                  ) : (
                    <>
                      <Square className="h-3.5 w-3.5" /> Seleccionar todos ({regularFiles.length})
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Contenedor Principal de Navegación */}
            {isLoading ? (
              <div className="h-80 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                  Accediendo a {currentFolder.name}...
                </p>
              </div>
            ) : files.length === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center gap-3 text-center p-6 border-2 border-dashed border-white/5 rounded-3xl">
                <FolderOpen className="h-12 w-12 text-muted-foreground/30" />
                <div>
                  <p className="text-white font-bold text-sm">Esta carpeta no contiene archivos ni subcarpetas</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {breadcrumbs.length > 1 ? 'Puedes subir de nivel con la barra de navegación superior.' : 'Sube archivos a tu Google Drive para verlos aquí.'}
                  </p>
                </div>
                {breadcrumbs.length > 1 && (
                  <Button variant="outline" size="sm" onClick={handleGoUpOneLevel} className="rounded-xl border-white/10 bg-white/5 text-white">
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Volver al nivel anterior
                  </Button>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[380px] pr-3">
                <div className="space-y-6">
                  {/* SECCIÓN 1: CARPETAS (Inicio y subcarpetas) */}
                  {folders.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 px-1">
                        <Folder className="h-4 w-4 text-amber-400" />
                        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                          Carpetas ({folders.length})
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {folders.map((folder) => (
                          <div
                            key={folder.id}
                            onClick={() => handleOpenFolder(folder)}
                            className="group flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-amber-400/40 hover:bg-amber-400/[0.05] transition-all cursor-pointer shadow-sm"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <Folder className="h-5 w-5 text-amber-400 fill-amber-400/20" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors" title={folder.name}>
                                  {folder.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  {folder.modifiedTime ? new Date(folder.modifiedTime).toLocaleDateString() : 'Carpeta'}
                                </p>
                              </div>
                            </div>
                            
                            <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECCIÓN 2: ARCHIVOS */}
                  {regularFiles.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 px-1">
                        <FileText className="h-4 w-4 text-primary" />
                        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                          Archivos en esta ubicación ({regularFiles.length})
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {regularFiles.map((file) => {
                          const isSelected = selectedIds.has(file.id);
                          const isVideo = file.mimeType.startsWith('video/');
                          const isImage = file.mimeType.startsWith('image/');

                          return (
                            <div
                              key={file.id}
                              onClick={() => toggleSelectFile(file)}
                              className={cn(
                                "group relative rounded-2xl p-2.5 transition-all cursor-pointer border flex flex-col justify-between overflow-hidden",
                                isSelected 
                                  ? "bg-primary/20 border-primary shadow-lg shadow-primary/20" 
                                  : "bg-white/[0.03] border-white/5 hover:border-white/20 hover:bg-white/[0.05]"
                              )}
                            >
                              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black/40 mb-2 flex items-center justify-center">
                                {file.thumbnailLink ? (
                                  <img
                                    src={file.thumbnailLink.replace(/=s\d+/, '=s400')}
                                    alt={file.name}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center">
                                    {getFileIcon(file.mimeType)}
                                  </div>
                                )}

                                <Badge className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-[8px] font-mono border-none text-white/80">
                                  {isVideo ? 'VIDEO' : isImage ? 'FOTO' : 'DOC'}
                                </Badge>

                                {isSelected && (
                                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
                                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                                  </div>
                                )}
                              </div>

                              <div>
                                <p className="text-xs font-bold text-white truncate" title={file.name}>
                                  {file.name}
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono mt-1">
                                  <span>{file.size ? formatBytes(parseInt(file.size, 10)) : 'Drive'}</span>
                                  <span>{file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Botón Cargar Más si hay nextPageToken */}
                  {nextPageToken && (
                    <div className="pt-2 pb-2 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchFiles(undefined, true, searchQuery, currentFolderId, filterType)}
                        disabled={isLoadingMore}
                        className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                      >
                        {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Cargar más elementos de esta carpeta...
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Progreso de descarga */}
            {isImporting && importProgress && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs text-white">
                  <span className="font-bold flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Descargando e importando {importProgress.current} de {importProgress.total}
                  </span>
                  <span className="font-mono text-muted-foreground truncate max-w-[200px]">{importProgress.name}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="p-4 sm:p-6 bg-white/[0.02] border-t border-white/5 flex-row items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isImporting} className="rounded-2xl text-white">
            Cerrar
          </Button>

          {!authError && (
            <Button
              onClick={handleImportSelected}
              disabled={selectedIds.size === 0 || isImporting}
              className="bg-primary text-white rounded-2xl font-bold px-6 h-11 shadow-xl shadow-primary/20"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando a PixelSphere...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Importar ({selectedIds.size}) a PixelSphere
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
