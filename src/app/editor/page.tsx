"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Sparkles, 
  RotateCcw, 
  FlipHorizontal, 
  Wand2,
  Download,
  Save,
  ImageIcon,
  ArrowRight,
  Maximize2,
  Library,
  X,
  Search,
  CheckCircle2,
  Loader2,
  Layers,
  Palette,
  Eye,
  RefreshCw,
  Sun,
  Contrast,
  Droplets,
  Wind,
  Ghost,
  Box,
  Image as ImageIconAlt,
  Copy,
  FileEdit
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { aiGenerativeImageEditor } from '@/ai/flows/ai-generative-image-editor';
import { getMediaByUser, saveMediaMetadata, updateMedia, unlockAchievement } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { User, Media } from '@/lib/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  
  const [user, setUser] = useState<User | null>(null);
  const [userMedia, setUserMedia] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Estados de edición
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedImageUri, setEditedImageUri] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  
  // Filtros manuales - Color
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [exposure, setExposure] = useState(100);
  
  // Filtros manuales - Avanzados
  const [sepia, setSepia] = useState(0);
  const [grayscale, setGrayscale] = useState(0);
  const [hueRotate, setHueRotate] = useState(0);
  const [blur, setBlur] = useState(0);
  const [invert, setInvert] = useState(0);

  // Transformaciones geométricas
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(1); // 1 o -1

  const { toast } = useToast();

  useEffect(() => {
    async function loadInitialData() {
      const sessionData = localStorage.getItem('ps_active_session');
      if (sessionData) {
        const currentUser = JSON.parse(sessionData);
        setUser(currentUser);
        const media = await getMediaByUser(currentUser.id);
        const images = media.filter(m => m.type === 'image' && !m.isDeleted);
        setUserMedia(images);

        // PROTOCOLO DE AUTO-SELECCIÓN POR ID
        if (editId) {
          const target = images.find(m => m.id === editId);
          if (target) {
            setSelectedMedia(target);
            resetFilters();
          }
        }
      }
      setLoading(false);
    }
    loadInitialData();
  }, [editId]);

  const handleSelectFromGallery = (item: Media) => {
    setSelectedMedia(item);
    setEditedImageUri(null);
    setIsGalleryOpen(false);
    resetFilters();
    toast({ title: "Activo Cargado", description: `Listo para editar: ${item.filename}` });
  };

  const resetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setSaturate(100);
    setExposure(100);
    setSepia(0);
    setGrayscale(0);
    setHueRotate(0);
    setBlur(0);
    setInvert(0);
    setRotation(0);
    setFlipX(1);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleFlip = () => {
    setFlipX(prev => prev * -1);
  };

  const bakeImage = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto del canvas"));
          return;
        }

        const isVertical = rotation === 90 || rotation === 270;
        canvas.width = isVertical ? img.height : img.width;
        canvas.height = isVertical ? img.width : img.height;

        ctx.filter = `
          brightness(${brightness}%) 
          contrast(${contrast}%) 
          saturate(${saturate}%) 
          brightness(${exposure}%)
          sepia(${sepia}%)
          grayscale(${grayscale}%)
          hue-rotate(${hueRotate}deg)
          blur(${blur}px)
          invert(${invert}%)
        `;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(flipX, 1);
        
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => reject(new Error("Error al cargar la imagen para procesar"));
      img.src = editedImageUri || selectedMedia!.url;
    });
  };

  const handleAiEdit = async () => {
    if (!selectedMedia || !prompt || !user) return;
    
    setIsProcessing(true);
    try {
      const result = await aiGenerativeImageEditor({
        photoDataUri: selectedMedia.url,
        prompt: prompt
      });
      setEditedImageUri(result.editedPhotoDataUri);
      await unlockAchievement(user.id, 'ai_editor');
      toast({ title: "Magia Completada", description: "La red neuronal ha transformado tu imagen." });
    } catch (error) {
      console.error("Error al procesar edición generativa con IA:", error);
      toast({ title: "Falla de Procesamiento", description: "Error al generar la imagen editada.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async (mode: 'copy' | 'replace') => {
    if (!selectedMedia || !user) return;
    setIsProcessing(true);
    try {
      const finalUrl = await bakeImage();
      
      const editTags = ['editado'];
      if (editedImageUri) {
        editTags.push('ai-edit');
      } else {
        editTags.push('manual-edit');
        await unlockAchievement(user.id, 'manual_tweak');
      }

      if (mode === 'replace') {
        await updateMedia(selectedMedia.id, user.id, {
          url: finalUrl,
          thumbnailUrl: finalUrl,
          tags: Array.from(new Set([...(selectedMedia.tags || []), ...editTags])),
          createdAt: new Date().toISOString()
        });
        toast({ title: "Activo Reemplazado", description: "Los cambios físicos han sido aplicados sobre el archivo original." });
      } else {
        const newMedia: Media = {
          id: Math.random().toString(36).substring(2, 11),
          userId: user.id,
          type: 'image',
          url: finalUrl,
          path: selectedMedia.path.replace(/(\.[\w\d]+)$/, `_edited_${Date.now()}$1`),
          thumbnailUrl: finalUrl,
          filename: `Editado_${selectedMedia.filename}`,
          size: Math.round(finalUrl.length * 0.75), 
          width: selectedMedia.width,
          height: selectedMedia.height,
          mimeType: 'image/jpeg',
          tags: Array.from(new Set([...(selectedMedia.tags || []), ...editTags])),
          isPrivate: false,
          isAdultContent: selectedMedia.isAdultContent,
          createdAt: new Date().toISOString()
        };

        await saveMediaMetadata(newMedia);
        toast({ title: "Copia Guardada", description: "Una nueva versión física ha sido añadida a tu galería." });
      }
      
      setIsSaveDialogOpen(false);
      router.push('/gallery');
    } catch (error) {
      console.error(error);
      toast({ title: "Error al Guardar", description: "No se pudo procesar la imagen final.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredGallery = userMedia.filter(m => 
    m.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filterStyle = {
    filter: isComparing ? 'none' : `
      brightness(${brightness}%) 
      contrast(${contrast}%) 
      saturate(${saturate}%) 
      brightness(${exposure}%)
      sepia(${sepia}%)
      grayscale(${grayscale}%)
      hue-rotate(${hueRotate}deg)
      blur(${blur}px)
      invert(${invert}%)
    `,
    transform: isComparing ? 'none' : `rotate(${rotation}deg) scaleX(${flipX})`
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-white font-headline">Editor Maestro</h1>
          <p className="text-muted-foreground">Orquestación visual: IA Generativa y Controles de Precisión.</p>
        </div>
        <Button 
          onClick={() => setIsGalleryOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white rounded-2xl h-14 px-8 font-bold shadow-lg shadow-primary/20"
        >
          <Library className="mr-2 h-5 w-5" /> Seleccionar de Galería
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-card/40 border-white/5 overflow-hidden backdrop-blur-3xl rounded-[2rem] h-full flex flex-col">
            <Tabs defaultValue="ai" className="w-full flex-1 flex flex-col">
              <TabsList className="w-full grid grid-cols-2 rounded-none bg-white/5 h-14">
                <TabsTrigger value="ai" className="data-[state=active]:bg-primary rounded-none h-full font-bold">IA Lab</TabsTrigger>
                <TabsTrigger value="manual" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-none h-full font-bold">Manual</TabsTrigger>
              </TabsList>
              
              <TabsContent value="ai" className="p-6 space-y-6 animate-slide-up flex-1 flex flex-col">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Instrucción Neural</Label>
                  <div className="space-y-2">
                    <Textarea 
                      placeholder="Ej. 'Convierte el cielo en una aurora boreal púrpura con estilo cyberpunk'" 
                      className="min-h-[140px] bg-white/5 border-white/10 rounded-2xl resize-none focus:ring-primary text-sm p-4 text-white"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ajustes Preestablecidos</Label>
                  <div className="flex flex-wrap gap-2">
                    {['Cinematic', 'Futuristic', 'Oil Painting', 'Sketch'].map(style => (
                      <Badge 
                        key={style} 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-primary/20 hover:text-primary py-1.5 px-3 rounded-full transition-all border-white/5 text-[10px]"
                        onClick={() => setPrompt(p => `${p} in ${style} style`.trim())}
                      >
                        {style}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <Button 
                    className="w-full h-14 bg-primary hover:bg-primary/90 rounded-2xl shadow-xl shadow-primary/20 text-lg font-bold text-white"
                    disabled={isProcessing || !selectedMedia || !prompt}
                    onClick={handleAiEdit}
                  >
                    {isProcessing ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando...</>
                    ) : (
                      <><Sparkles className="mr-2 h-5 w-5" /> Aplicar IA</>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="p-0 animate-slide-up flex-1 flex flex-col">
                <ScrollArea className="flex-1 max-h-[calc(100vh-350px)]">
                  <div className="p-6 space-y-8">
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        variant="outline" 
                        className="h-14 border-white/5 rounded-2xl hover:bg-white/5 flex-col gap-1 py-2 text-white"
                        onClick={resetFilters}
                      >
                        <RefreshCw className="h-4 w-4 text-accent" /> <span className="text-[10px] font-bold uppercase">Resetear</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-14 border-white/5 rounded-2xl hover:bg-white/5 flex-col gap-1 py-2 text-white"
                        onClick={handleFlip}
                      >
                        <FlipHorizontal className="h-4 w-4 text-accent" /> <span className="text-[10px] font-bold uppercase">Espejo</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-14 border-white/5 rounded-2xl hover:bg-white/5 flex-col gap-1 py-2 text-white col-span-2"
                        onClick={handleRotate}
                      >
                        <RotateCcw className="h-4 w-4 text-accent" /> <span className="text-[10px] font-bold uppercase">Rotar 90°</span>
                      </Button>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2"><Sun className="h-3 w-3" /> Brillo</Label><span className="text-[10px] text-white font-mono">{brightness}%</span></div>
                        <Slider value={[brightness]} min={0} max={200} step={1} onValueChange={(v) => setBrightness(v[0])} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2"><Contrast className="h-3 w-3" /> Contraste</Label><span className="text-[10px] text-white font-mono">{contrast}%</span></div>
                        <Slider value={[contrast]} min={0} max={200} step={1} onValueChange={(v) => setContrast(v[0])} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-1"><Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2"><Droplets className="h-3 w-3" /> Saturación</Label><span className="text-[10px] text-white font-mono">{saturate}%</span></div>
                        <Slider value={[saturate]} min={0} max={200} step={1} onValueChange={(v) => setSaturate(v[0])} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-1"><Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sepia</Label><span className="text-[10px] text-white font-mono">{sepia}%</span></div>
                        <Slider value={[sepia]} min={0} max={100} step={1} onValueChange={(v) => setSepia(v[0])} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-1"><Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Escala de Grises</Label><span className="text-[10px] text-white font-mono">{grayscale}%</span></div>
                        <Slider value={[grayscale]} min={0} max={100} step={1} onValueChange={(v) => setGrayscale(v[0])} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-1"><Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Rotación de Tono</Label><span className="text-[10px] text-white font-mono">{hueRotate}°</span></div>
                        <Slider value={[hueRotate]} min={0} max={360} step={1} onValueChange={(v) => setHueRotate(v[0])} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-1"><Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Desenfoque</Label><span className="text-[10px] text-white font-mono">{blur}px</span></div>
                        <Slider value={[blur]} min={0} max={20} step={0.5} onValueChange={(v) => setBlur(v[0])} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-1"><Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Invertir</Label><span className="text-[10px] text-white font-mono">{invert}%</span></div>
                        <Slider value={[invert]} min={0} max={100} step={1} onValueChange={(v) => setInvert(v[0])} />
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                <div className="p-6 border-t border-white/5 mt-auto">
                  <Button 
                    className="w-full h-14 bg-white text-black hover:bg-white/90 rounded-2xl font-bold"
                    onClick={() => setIsSaveDialogOpen(true)}
                    disabled={isProcessing || !selectedMedia}
                  >
                    <Save className="mr-2 h-5 w-5" />
                    Finalizar Edición
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="relative aspect-[16/9] w-full bg-black/40 rounded-[3rem] border border-white/5 flex items-center justify-center overflow-hidden group shadow-2xl">
            {!selectedMedia ? (
              <div className="flex flex-col items-center text-center p-12 space-y-8">
                <div className="w-24 h-24 rounded-[2.5rem] bg-primary/10 flex items-center justify-center border border-primary/20 animate-pulse">
                  <ImageIcon className="h-12 w-12 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-extrabold text-white font-headline">Lienzo Vacío</h3>
                  <p className="text-muted-foreground max-sm mx-auto">Selecciona una imagen de tu galería para iniciar el proceso de orquestación visual.</p>
                </div>
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 rounded-full px-10 h-16 text-lg font-bold shadow-2xl shadow-primary/20 text-white"
                  onClick={() => setIsGalleryOpen(true)}
                >
                  Abrir Galería <ArrowRight className="ml-2 h-6 w-6" />
                </Button>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center p-8 overflow-hidden">
                <img 
                  src={editedImageUri || selectedMedia.url} 
                  alt="Lienzo de edición" 
                  style={filterStyle}
                  className="max-h-full max-w-full object-contain transition-all duration-300 rounded-lg shadow-2xl" 
                />
                
                <div className="absolute top-8 right-8 flex gap-3">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className={cn(
                      "h-12 w-12 bg-black/60 backdrop-blur-xl border border-white/10 hover:bg-black/80 rounded-2xl text-white",
                      isComparing && "bg-primary text-white border-primary"
                    )}
                    onMouseDown={() => setIsComparing(true)}
                    onMouseUp={() => setIsComparing(false)}
                    onMouseLeave={() => setIsComparing(false)}
                    onTouchStart={() => setIsComparing(true)}
                    onTouchEnd={() => setIsComparing(false)}
                  >
                    <Eye className="h-6 w-6" />
                  </Button>
                </div>

                <div className="absolute bottom-8 left-8 flex items-center gap-4">
                  <div className="px-5 py-2.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shadow-[0_0_10px_#66E0FF]" />
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                      {isComparing ? 'VISTA ORIGINAL' : `MODO LIVE: ${editedImageUri ? 'IA' : 'MANUAL'}`}
                    </span>
                  </div>
                  {editedImageUri && (
                    <Button 
                      variant="ghost" 
                      className="text-xs bg-white/5 hover:bg-white/10 text-white rounded-full px-6 h-10 font-bold border border-white/5"
                      onClick={() => setEditedImageUri(null)}
                    >
                      Resetear a Original
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="max-w-md bg-[#0a0a0c] border-white/10 rounded-[2rem] shadow-2xl p-8">
          <DialogHeader className="space-y-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto border border-primary/20">
              <Save className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white">Persistencia de Activo</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Selecciona el protocolo de escritura para esta edición. Los cambios se renderizarán físicamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-6">
            <Button 
              variant="outline" 
              className="h-20 justify-start gap-4 rounded-2xl border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-primary/50 group px-6 text-white"
              onClick={() => handleSave('copy')}
              disabled={isProcessing}
            >
              <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <Copy className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Guardar como Copia</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Crea un nuevo archivo renderizado</p>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 justify-start gap-4 rounded-2xl border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-accent/50 group px-6 text-white"
              onClick={() => handleSave('replace')}
              disabled={isProcessing}
            >
              <div className="p-3 rounded-xl bg-accent/10 text-accent group-hover:scale-110 transition-transform">
                <FileEdit className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Reemplazar Original</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Sobreescribe el activo físico actual</p>
              </div>
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSaveDialogOpen(false)} className="w-full rounded-xl text-white">Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent className="max-w-4xl bg-[#0a0a0c] border-white/10 rounded-[2.5rem] shadow-2xl p-0 overflow-hidden">
          <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                <Library className="h-6 w-6 text-primary" /> Explorador de Galería
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs uppercase tracking-widest font-bold">Selecciona un activo para la edición</DialogDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar archivos..." 
                className="w-full bg-white/5 border border-white/10 rounded-full h-10 pl-10 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary" 
              />
            </div>
          </div>
          
          <ScrollArea className="h-[500px] p-8">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-white/5 animate-pulse" />)}
              </div>
            ) : filteredGallery.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <ImageIconAlt className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No se encontraron imágenes en tu infraestructura</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {filteredGallery.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => handleSelectFromGallery(item)}
                    className="group relative aspect-square rounded-3xl overflow-hidden bg-white/5 border border-white/5 hover:border-primary cursor-pointer transition-all duration-500"
                  >
                    <Image 
                      src={item.thumbnailUrl} 
                      alt={item.filename} 
                      fill 
                      className={cn("object-cover transition-transform duration-700 group-hover:scale-110", item.isAdultContent && "blur-xl")} 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                      <p className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{item.filename}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end">
            <Button variant="ghost" onClick={() => setIsGalleryOpen(false)} className="rounded-xl text-white">Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EditorPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
        <EditorContent />
      </Suspense>
    </DashboardLayout>
  );
}
