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
  Navigation
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
      } catch (e) { toast({ variant: "destructive", title: "Error de video" }); }
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
    const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const newEntries: UploadFile[] = [];
    for (const file of validFiles) {
      const thumb = file.type.startsWith('video/') ? await captureVideoFrame(file) : undefined;
      newEntries.push({
        id: Math.random().toString(36).substring(7),
        file,
        preview: URL.createObjectURL(file),
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
      if (!file.type.startsWith('video/')) return resolve(undefined);
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const url = URL.createObjectURL(file);
      video.src = url; video.muted = true; video.currentTime = 0.5;
      video.onloadeddata = () => {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUri = canvas.toDataURL('image/jpeg', 0.8);
          URL.revokeObjectURL(url); resolve(dataUri);
        } else { URL.revokeObjectURL(url); resolve(undefined); }
      };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(undefined); };
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
          formData.append('contentType', file.type);
          
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
        setUploadQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f));
        toast({ variant: 'destructive', title: 'Error de Ingesta', description: error.message });
      }
    }

    if (completedCount > 0) {
      await unlockAchievement(user.id, 'first_upload');
      toast({ title: "Ingesta Completa", description: `${completedCount} archivos geolocalizados.` });
    }
    setIsUploading(false);
    if (completedCount === itemsToUpload.length) {
      setTimeout(() => { onUploadSuccess?.(); handleClose(); }, 1500);
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
              <Button variant="outline" size="sm" className="rounded-xl border-white/10 bg-white/5 text-white" onClick={() => fileInputRef.current?.click()}>
                <Plus className="h-4 w-4 mr-2 text-primary" /> <span className="hidden sm:inline">Añadir más</span>
              </Button>
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
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-white/5 rounded-[2.5rem] p-12 sm:p-20 flex flex-col items-center justify-center gap-6 transition-all hover:bg-white/[0.02] hover:border-primary/30 group cursor-pointer">
                <div className="w-20 h-20 rounded-[2rem] bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500"><ImageIcon className="h-10 w-10 text-primary" /></div>
                <div className="text-center"><p className="text-white font-bold text-xl">Ingesta de Archivos</p><p className="text-muted-foreground text-sm mt-2">Selecciona archivos para la red.</p></div>
              </div>
              <Button variant="outline" onClick={() => setIsCameraMode(true)} className="w-full h-16 rounded-3xl border-white/10 bg-white/5 text-white font-bold"><Camera className="mr-3 h-6 w-6 text-primary" /> Iniciar Cámara Neural</Button>
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
                        <div className="w-14 h-14 rounded-xl overflow-hidden relative bg-black">
                          {item.file.type.startsWith('video/') ? <img src={item.thumbnailB64 || item.preview} className="w-full h-full object-cover" /> : <Image src={item.preview} alt="" fill className="object-cover" />}
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
    </Dialog>
  );
}
