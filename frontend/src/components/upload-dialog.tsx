"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  CheckCircle2, 
  Loader2,
  ImageIcon,
  Zap,
  Camera,
  SwitchCamera,
  ShieldAlert,
  Plus,
  Navigation,
  FileText
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { unlockAchievement } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import GoogleDrivePicker from '@/components/google-drive-picker';

interface UploadFile {
  id: string;
  file: File;
  preview: string;
  thumbnailB64?: string;
  isPrivate: boolean;
  isAdultContent: boolean;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  cameraSource?: 'front' | 'back';
}

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUploadSuccess?: () => void;
}

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadDialog({ isOpen, onClose, user, onUploadSuccess }: UploadDialogProps) {
  const [uploadQueue, setUploadQueue] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [globalAdult, setGlobalAdult] = useState(false);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  
  // Estados Geoespaciales
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [activeTab, setActiveMode] = useState<'PHOTO' | 'VIDEO'>('PHOTO');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  // PROTOCOLO DE LOCALIZACIÓN FÍSICA
  useEffect(() => {
    if (isOpen && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          console.log("Coordenadas de nexo sincronizadas.");
        },
        (error) => {
          console.warn("Falla en sincronización geoespacial:", error);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [isOpen]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecordingSeconds(0);
    setIsRecording(false);
  }, []);

  const startCamera = useCallback(async (mode: 'user' | 'environment' = facingMode) => {
    try {
      stopCamera();
      const constraints = { 
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } }, 
        audio: true 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setHasCameraPermission(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (error) {
      console.error("Error al iniciar cámara:", error);
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: 'Acceso Denegado', description: 'Habilita la cámara.' });
    }
  }, [facingMode, stopCamera, toast]);

  useEffect(() => {
    if (isCameraMode && isOpen) startCamera();
    else stopCamera();
  }, [isCameraMode, isOpen, startCamera, stopCamera]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `captura_${Date.now()}.jpg`, { type: 'image/jpeg' });
            processCapturedFile(file);
            setIsCameraMode(false);
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const startRecording = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      try {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const file = new File([blob], `grabacion_${Date.now()}.webm`, { type: 'video/webm' });
          processCapturedFile(file);
        };
        mediaRecorder.start(1000);
        setIsRecording(true);
        timerRef.current = setInterval(() => setRecordingSeconds(prev => prev + 1), 1000);
      } catch (e) {
        console.error("Error al iniciar grabación de medios:", e);
        toast({ variant: "destructive", title: "Error de video" });
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setRecordingSeconds(0);
      setIsCameraMode(false);
    }
  };

  const processCapturedFile = async (file: File) => {
    const thumb = file.type.startsWith('video/') ? await captureVideoFrame(file) : undefined;
    const newEntry: UploadFile = {
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      thumbnailB64: thumb,
      isPrivate: false,
      isAdultContent: globalAdult,
      status: 'pending',
      progress: 0,
      cameraSource: facingMode === 'user' ? 'front' : 'back'
    };
    setUploadQueue(prev => [...prev, newEntry]);
  };

  const processFiles = async (files: File[]) => {
    const newEntries: UploadFile[] = [];
    for (const file of files) {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v|3gp)$/i.test(file.name);
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|svg|avif)$/i.test(file.name);
      
      let thumb = (file as any).thumbnailB64;
      if (!thumb && isVideo) {
        thumb = await captureVideoFrame(file);
      }
      
      const previewUrl = thumb || ((isImage || isVideo) ? URL.createObjectURL(file) : '');
      newEntries.push({
        id: Math.random().toString(36).substring(7),
        file,
        preview: previewUrl,
        thumbnailB64: thumb,
        isPrivate: false,
        isAdultContent: globalAdult,
        status: 'pending',
        progress: 0
      });
    }
    setUploadQueue(prev => [...prev, ...newEntries]);
  };

  const captureVideoFrame = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v|3gp)$/i.test(file.name);
      if (!isVideo) return resolve(undefined);

      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const url = URL.createObjectURL(file);
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      let resolved = false;
      const done = (result?: string) => {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(url);
          resolve(result);
        }
      };

      const timer = setTimeout(() => done(undefined), 6000);

      video.onloadedmetadata = () => {
        try {
          video.currentTime = Math.min(0.5, video.duration > 0 ? video.duration / 3 : 0.1);
        } catch (e) {
          done(undefined);
        }
      };

      video.onseeked = () => {
        try {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUri = canvas.toDataURL('image/jpeg', 0.85);
              clearTimeout(timer);
              done(dataUri);
              return;
            }
          }
          done(undefined);
        } catch (e) {
          done(undefined);
        }
      };

      video.onerror = () => {
        clearTimeout(timer);
        done(undefined);
      };
    });
  };

  const handleBatchUpload = async () => {
    if (uploadQueue.length === 0) return;
    setIsUploading(true);
    let completedCount = 0;
    const itemsToUpload = uploadQueue.filter(item => item.status !== 'completed');

    for (let i = 0; i < itemsToUpload.length; i++) {
      const item = itemsToUpload[i];
      const file = item.file;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const fileId = Math.random().toString(36).substring(2, 11);

      setUploadQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));

      try {
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          const formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('userId', user.id);
          formData.append('filename', file.name);
          formData.append('fileId', fileId);
          formData.append('chunkIndex', chunkIndex.toString());
          formData.append('totalChunks', totalChunks.toString());
          formData.append('isAdult', item.isAdultContent.toString());
          formData.append('filesize', file.size.toString());
          const isVideoFile = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v|3gp)$/i.test(file.name);
          const detectedContentType = isVideoFile 
            ? (file.type && file.type.startsWith('video/') ? file.type : 'video/mp4') 
            : (file.type || 'application/octet-stream');
          formData.append('contentType', detectedContentType);
          
          // Inyectar coordenadas GPS si están disponibles
          if (currentCoords) {
            formData.append('lat', currentCoords.lat.toString());
            formData.append('lng', currentCoords.lng.toString());
          }
          
          if (item.cameraSource) formData.append('cameraSource', item.cameraSource);
          if (chunkIndex === totalChunks - 1 && item.thumbnailB64) {
            formData.append('thumbnailB64', item.thumbnailB64);
          }

          const response = await fetch('/api/upload', { method: 'POST', body: formData });
          if (!response.ok) throw new Error("Falla en fragmento.");

          const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
          setUploadQueue(prev => prev.map(f => f.id === item.id ? { ...f, progress } : f));
          
          const currentTotalProcessed = itemsToUpload.reduce((acc, curr, idx) => {
            if (idx < i) return acc + 100;
            if (idx === i) return acc + progress;
            return acc;
          }, 0);
          setOverallProgress(Math.round(currentTotalProcessed / itemsToUpload.length));
        }
        completedCount++;
        setUploadQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'completed', progress: 100 } : f));
      } catch (error: any) {
        console.error("Error al procesar subida de archivo multimedia:", error);
        setUploadQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f));
        toast({ variant: 'destructive', title: 'Error de Ingesta', description: error.message });
      }
    }

    if (completedCount > 0) {
      await unlockAchievement(user.id, 'first_upload');
      toast({ title: "Ingesta Completa", description: `${completedCount} archivos geolocalizados.` });
      window.dispatchEvent(new CustomEvent('neural-update', { 
        detail: { channel: 'MEDIA', data: { userId: user.id } } 
      }));
    }
    setIsUploading(false);
    if (completedCount === itemsToUpload.length) {
      setTimeout(() => { 
        onUploadSuccess?.(); 
        window.dispatchEvent(new CustomEvent('neural-update', { 
          detail: { channel: 'MEDIA', data: { userId: user.id } } 
        }));
        handleClose(); 
      }, 800);
    }
  };

  const handleClose = () => {
    stopCamera();
    uploadQueue.forEach(f => URL.revokeObjectURL(f.preview));
    setUploadQueue([]);
    setOverallProgress(0);
    setIsUploading(false);
    setIsCameraMode(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isUploading && handleClose()}>
      <DialogContent className="w-full max-w-full sm:max-w-[600px] h-full sm:h-auto bg-[#0a0a0c] border-white/10 p-0 overflow-hidden shadow-2xl z-[100] sm:rounded-3xl">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Zap className="h-6 w-6 text-primary fill-primary/20" /> Laboratorio de Ingesta
              </DialogTitle>
              <div className="flex items-center gap-2">
                <DialogDescription className="text-muted-foreground text-xs sm:text-sm">Orquestando activos...</DialogDescription>
                {currentCoords && (
                  <Badge className="bg-accent/10 text-accent border-accent/20 h-5 px-2 flex items-center gap-1">
                    <Navigation className="h-2.5 w-2.5" /> <span className="text-[8px] font-black uppercase">GPS OK</span>
                  </Badge>
                )}
              </div>
            </div>
            {uploadQueue.length > 0 && !isUploading && !isCameraMode && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => setIsDrivePickerOpen(true)}>
                  <svg className="h-3.5 w-3.5 mr-1.5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  <span className="hidden sm:inline">Drive</span>
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl border-white/10 bg-white/5 text-white" onClick={() => fileInputRef.current?.click()}>
                  <Plus className="h-4 w-4 mr-2 text-primary" /> <span className="hidden sm:inline">Añadir más</span>
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto max-h-[calc(100vh-200px)] sm:max-h-none">
          {isCameraMode ? (
            <div className="space-y-6">
              <div className="relative aspect-[3/4] sm:aspect-video bg-black rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl group">
                <video ref={videoRef} autoPlay muted playsInline className={cn("w-full h-full object-cover", facingMode === 'user' && "scale-x-[-1]")} />
                <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                  <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 w-fit flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", isRecording ? "bg-red-500 animate-pulse" : "bg-green-500")} />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{isRecording ? (Math.floor(recordingSeconds/60) + ':' + (recordingSeconds%60).toString().padStart(2, '0')) : 'STANDBY'}</span>
                  </div>
                </div>
                <div className="absolute bottom-8 left-0 right-0 px-8 flex items-center justify-between pointer-events-auto">
                  <button onClick={toggleCamera} className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center hover:bg-white/10"><SwitchCamera className="h-6 w-6" /></button>
                  <button onClick={activeTab === 'PHOTO' ? capturePhoto : (isRecording ? stopRecording : startRecording)} className="h-20 w-20 rounded-full border-[6px] border-white/20 p-1 transition-transform active:scale-90 group/shutter">
                    <div className={cn("w-full h-full transition-all duration-300 shadow-lg", activeTab === 'PHOTO' ? "bg-white rounded-full" : (isRecording ? "bg-red-500 rounded-lg scale-50" : "bg-red-500 rounded-full"))} />
                  </button>
                  <button onClick={() => setIsCameraMode(false)} className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center hover:bg-white/10"><X className="h-6 w-6" /></button>
                </div>
              </div>
              <div className="flex justify-center gap-8 px-4 py-2 bg-white/5 rounded-2xl mx-auto w-fit">
                {['PHOTO', 'VIDEO'].map((mode) => (
                  <button key={mode} onClick={() => setActiveMode(mode as any)} className={cn("text-[11px] font-black tracking-[0.2em] transition-all relative py-1", activeTab === mode ? "text-primary" : "text-muted-foreground/40")}>{mode}{activeTab === mode && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />}</button>
                ))}
              </div>
            </div>
          ) : uploadQueue.length === 0 ? (
            <div className="space-y-4">
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-white/5 rounded-[2.5rem] p-10 sm:p-16 flex flex-col items-center justify-center gap-5 transition-all hover:bg-white/[0.02] hover:border-primary/30 group cursor-pointer">
                <div className="w-16 h-16 rounded-[1.8rem] bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <ImageIcon className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">Ingesta de Archivos Locales</p>
                  <p className="text-muted-foreground text-xs mt-1">Selecciona o arrastra imágenes y videos desde tu dispositivo.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDrivePickerOpen(true)} 
                  className="h-16 rounded-3xl border-white/10 bg-white/5 hover:bg-primary/10 hover:border-primary/30 text-white font-bold flex items-center justify-center gap-3 transition-all"
                >
                  <svg className="h-6 w-6 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  <div className="text-left leading-tight">
                    <p className="text-sm font-bold text-white">Google Drive</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Importar fotos y videos</p>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  onClick={() => setIsCameraMode(true)} 
                  className="h-16 rounded-3xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center gap-3 transition-all"
                >
                  <Camera className="h-6 w-6 text-primary shrink-0" />
                  <div className="text-left leading-tight">
                    <p className="text-sm font-bold text-white">Cámara Neural</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Capturar foto o video</p>
                  </div>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-3xl border border-white/5">
                <div className="flex items-center gap-4"><div className="p-3 rounded-2xl bg-accent/10 text-accent"><ShieldAlert className="h-5 w-5" /></div><div><Label className="text-sm font-bold text-white">Contenido Adulto</Label></div></div>
                <Switch checked={globalAdult} onCheckedChange={(c) => { setGlobalAdult(c); setUploadQueue(prev => prev.map(f => ({ ...f, isAdultContent: c }))); }} />
              </div>

              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {uploadQueue.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl overflow-hidden relative bg-black flex items-center justify-center">
                          {item.file.type.startsWith('video/') ? (
                            <img src={item.thumbnailB64 || item.preview} className="w-full h-full object-cover" />
                          ) : item.preview ? (
                            <Image src={item.preview} alt="" fill className="object-cover" />
                          ) : (
                            <FileText className="h-6 w-6 text-primary" />
                          )}
                          {item.status === 'uploading' && <div className="absolute inset-0 bg-black/60 flex items-center justify-center flex-col"><Loader2 className="h-4 w-4 text-primary animate-spin" /><span className="text-[8px] font-bold text-white mt-1">{item.progress}%</span></div>}
                          {item.status === 'completed' && <div className="absolute inset-0 bg-green-500/80 flex items-center justify-center"><CheckCircle2 className="h-6 w-6 text-white" /></div>}
                        </div>
                        <div className="max-w-[120px] sm:max-w-[180px]"><p className="text-xs font-bold text-white truncate">{item.file.name}</p></div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setUploadQueue(prev => prev.filter(f => f.id !== item.id))} disabled={isUploading} className="text-muted-foreground hover:text-red-400"><X className="h-5 w-5" /></Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {isUploading && (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"><span>Sincronizando...</span><span>{overallProgress}%</span></div>
              <Progress value={overallProgress} className="h-1.5 bg-white/5" />
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-white/[0.02] border-t border-white/5 flex-row gap-3">
          <Button variant="ghost" onClick={handleClose} disabled={isUploading} className="flex-1 rounded-2xl text-white">Cerrar</Button>
          {!isCameraMode && uploadQueue.length > 0 && <Button onClick={handleBatchUpload} disabled={isUploading} className="flex-[2] bg-primary text-white rounded-2xl font-bold shadow-xl">{isUploading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Zap className="mr-2 h-5 w-5" />} Completar Ingesta</Button>}
        </DialogFooter>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" multiple onChange={(e) => { if(e.target.files) { processFiles(Array.from(e.target.files)); e.target.value = ''; } }} />
      </DialogContent>

      <GoogleDrivePicker
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onFilesSelected={(driveFiles) => {
          processFiles(driveFiles);
        }}
      />
    </Dialog>
  );
}
