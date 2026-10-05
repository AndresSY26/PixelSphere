"use client";

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  RefreshCw, 
  FileJson, 
  Copy, 
  Check, 
  HardDrive,
  FolderOpen,
  Users,
  Image as ImageIcon,
  Award
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { inspectDatabase } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

export function DatabaseInspectorDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    paths: Record<string, string>;
    files: {
      'albums.json': any[];
      'media.json': any[];
      'users.json': any[];
      'achievements.json': any[];
    };
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'albums.json' | 'media.json' | 'users.json' | 'achievements.json'>('albums.json');
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await inspectDatabase();
      setData(res);
    } catch (err: any) {
      toast({
        title: "Error al inspeccionar disco",
        description: err.message || "No se pudo leer el almacenamiento físico",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const currentFileContent = data?.files?.[activeTab] || [];
  const currentJsonString = JSON.stringify(currentFileContent, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentJsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copiado al portapapeles", description: `${activeTab} copiado con formato JSON.` });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-9 px-3 gap-2 bg-card/60 border-white/10 hover:border-primary/40 text-xs">
            <HardDrive className="h-3.5 w-3.5 text-primary" />
            <span>Inspector JSON</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-background/95 backdrop-blur-2xl border-white/10 p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/10">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Almacenamiento Físico en Disco (JSON)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Visualiza en tiempo real los registros guardados en los archivos JSON dentro de <code className="text-primary font-mono">backend/data/</code>.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-8 gap-1.5 border-white/10 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Recargar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 gap-1.5 border border-white/10 text-xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              Copiar
            </Button>
          </div>
        </DialogHeader>

        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as any)} 
          className="flex-1 flex flex-col min-h-0 mt-4"
        >
          <TabsList className="bg-white/5 border border-white/10 grid grid-cols-4 w-full h-11 p-1">
            <TabsTrigger value="albums.json" className="gap-2 text-xs">
              <FolderOpen className="h-3.5 w-3.5 text-accent" />
              albums.json
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-white/10">
                {data?.files?.['albums.json']?.length ?? 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="media.json" className="gap-2 text-xs">
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
              media.json
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-white/10">
                {data?.files?.['media.json']?.length ?? 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="users.json" className="gap-2 text-xs">
              <Users className="h-3.5 w-3.5 text-cyan-400" />
              users.json
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-white/10">
                {data?.files?.['users.json']?.length ?? 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="achievements.json" className="gap-2 text-xs">
              <Award className="h-3.5 w-3.5 text-amber-400" />
              achievements.json
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-white/10">
                {data?.files?.['achievements.json']?.length ?? 0}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-3 relative rounded-xl border border-white/10 bg-black/60 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-b border-white/5 text-[11px] font-mono text-muted-foreground">
              <span>Ruta en servidor: <code className="text-white/80">{data?.paths?.[activeTab.split('.')[0].toUpperCase()] || `backend/data/${activeTab}`}</code></span>
              <span>{currentFileContent.length} registro(s)</span>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-xs text-emerald-300/90 leading-relaxed selection:bg-primary/30">
              {loading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  Leyendo bytes físicos del archivo...
                </div>
              ) : currentFileContent.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 py-12">
                  <FileJson className="h-8 w-8 mb-2 opacity-30" />
                  <p>El archivo está vacío: <code>[]</code></p>
                  <p className="text-[10px] mt-1 text-muted-foreground/40">Crea un registro desde la interfaz para ver cómo se guarda aquí.</p>
                </div>
              ) : (
                <pre>{currentJsonString}</pre>
              )}
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
