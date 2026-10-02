"use client";

import { useMemo } from 'react';
import { Album, Media } from '@/lib/types';
import { 
  ChevronLeft, 
  Folder, 
  ChevronRight, 
  Check, 
  CheckCircle2, 
  MinusCircle, 
  FolderTree 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface AlbumBrowserProps {
  allAlbums: Album[];
  selectedMedia: Media | null;
  linkNavParentId: string | null;
  setLinkNavParentId: (id: string | null) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export const AlbumBrowser = ({ 
  allAlbums, 
  selectedMedia, 
  linkNavParentId, 
  setLinkNavParentId, 
  onSelect, 
  onRemove 
}: AlbumBrowserProps) => {
  const currentList = useMemo(() => 
    allAlbums.filter(a => a.parentId === (linkNavParentId || undefined)), 
    [linkNavParentId, allAlbums]
  );
  
  const parentAlbum = useMemo(() => 
    allAlbums.find(a => a.id === linkNavParentId), 
    [linkNavParentId, allAlbums]
  );
  
  const isAlreadyLinked = selectedMedia ? parentAlbum?.mediaIds.includes(selectedMedia.id) : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          {linkNavParentId ? (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 text-[10px] uppercase font-bold text-primary hover:bg-primary/10" 
              onClick={() => setLinkNavParentId(parentAlbum?.parentId || null)}
            >
              <ChevronLeft className="h-3 w-3 mr-1" /> Volver
            </Button>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Infraestructura Raíz</span>
          )}
          {linkNavParentId && (
            <span className="text-[10px] font-bold text-white truncate max-w-[120px]">{parentAlbum?.title}</span>
          )}
        </div>
        
        {linkNavParentId && (
          isAlreadyLinked ? (
            <Button 
              className="w-full h-12 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-bold gap-2 group transition-all"
              onClick={() => onRemove(linkNavParentId)}
            >
              <MinusCircle className="h-4 w-4" /> Desvincular de "{parentAlbum?.title}"
            </Button>
          ) : (
            <Button 
              className="w-full h-12 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-xl text-xs font-bold gap-2 group transition-all"
              onClick={() => onSelect(linkNavParentId)}
            >
              <Check className="h-4 w-4" /> Vincular en "{parentAlbum?.title}"
            </Button>
          )
        )}
        {!linkNavParentId && (
          <div className="w-full h-12 bg-white/5 text-muted-foreground/40 border border-white/5 rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Selecciona una carpeta
          </div>
        )}
      </div>

      <Separator className="bg-white/5" />

      <ScrollArea className="h-64 pr-2">
        <div className="space-y-1">
          {currentList.map(album => {
            const hasMedia = selectedMedia && album.mediaIds.includes(selectedMedia.id);
            return (
              <Button 
                key={album.id}
                variant="ghost" 
                className={cn(
                  "w-full justify-between h-14 px-4 rounded-xl hover:bg-white/5 group border border-transparent transition-all",
                  hasMedia && "bg-primary/5 border-primary/10"
                )}
                onClick={() => setLinkNavParentId(album.id)}
              >
                <div className="flex items-center min-w-0">
                  <Folder className={cn("h-5 w-5 mr-3 shrink-0 group-hover:scale-110 transition-transform", hasMedia ? "text-primary" : "text-accent/60")} />
                  <div className="text-left min-w-0">
                    <p className={cn("text-sm font-bold truncate", hasMedia ? "text-primary" : "text-white")}>{album.title}</p>
                    <p className="text-[9px] uppercase font-black text-muted-foreground/40">{album.mediaIds.length} activos vinculados</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasMedia && <CheckCircle2 className="h-3 w-3 text-primary" />}
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </Button>
            );
          })}
          {currentList.length === 0 && (
            <div className="py-12 text-center opacity-20">
              <FolderTree className="h-10 w-10 mx-auto mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-white">Carpeta Despejada</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
