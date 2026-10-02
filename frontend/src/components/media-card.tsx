"use client";

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import Image from 'next/image';
import { Media } from '@/lib/types';
import { 
  Play, 
  Check, 
  Trash2, 
  Lock, 
  Share2, 
  Wand2, 
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface MediaCardProps {
  item: Media;
  viewMode: 'grid' | 'list';
  index: number;
  isSelected: boolean;
  isSelectionMode: boolean;
  onDelete?: (id: string) => void;
  onVault?: (id: string) => void;
  onShare?: (item: Media) => void;
  onGetSelectionContext?: () => string[]; 
  onClick: (item: Media) => void;
  onPointerDown: (id: string, isSelected: boolean, e: React.PointerEvent) => void;
  onPointerEnter: (id: string) => void;
  onLongPress: () => void;
}

export const MediaCard = memo(({ 
  item, 
  viewMode, 
  isSelected, 
  isSelectionMode, 
  onDelete,
  onVault,
  onShare,
  onGetSelectionContext,
  onClick, 
  onPointerDown, 
  onPointerEnter, 
  onLongPress 
}: MediaCardProps) => {
  const [isInView, setIsInView] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.01, rootMargin: '400px' }); // Margen mayor para precarga fluida
    
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isSelectionMode) {
      timerRef.current = setTimeout(() => {
        onLongPress();
      }, 600);
    }
  }, [isSelectionMode, onLongPress]);
  
  const handleEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleDragStart = (e: React.DragEvent) => {
    if (isSelected && onGetSelectionContext) {
      const selectedIds = onGetSelectionContext();
      if (selectedIds.length > 1) {
        e.dataTransfer.setData('mediaIds', JSON.stringify(selectedIds));
      }
    }
    
    e.dataTransfer.setData('mediaId', item.id);
    e.dataTransfer.effectAllowed = 'move';
    
    const ghost = new window.Image();
    ghost.src = item.thumbnailUrl;
  };

  const handleItemClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.stopPropagation();
      onPointerDown(item.id, isSelected, e as any);
      return;
    }
    onClick(item);
  };

  if (viewMode === 'list') {
    return (
      <div 
        onClick={handleItemClick}
        draggable={!isSelectionMode}
        onDragStart={handleDragStart}
        className={cn(
          "flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-2xl transition-all cursor-pointer group/row",
          isSelected && "bg-primary/20 border-primary/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden relative bg-black/40">
            {isInView && (
              item.type === 'video' ? (
                <img src={item.thumbnailUrl} className={cn("w-full h-full object-cover", item.isAdultContent && "blur-md")} loading="lazy" />
              ) : (
                <Image src={item.thumbnailUrl} alt="" fill sizes="40px" className={cn("object-cover", item.isAdultContent && "blur-md")} loading="lazy" />
              )
            )}
          </div>
          <div>
            <p className="font-bold text-xs text-white truncate max-w-[150px]">{item.filename}</p>
            <span className="text-[8px] text-muted-foreground uppercase font-black">{(item.size / 1024 / 1024).toFixed(1)}MB</span>
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
          {onShare && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={(e) => { e.stopPropagation(); onShare(item); }}><Share2 className="h-4 w-4" /></Button>}
          {onDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={isSelectionMode}>
        <div 
          ref={cardRef} 
          onClick={handleItemClick}
          draggable
          onDragStart={handleDragStart}
          onMouseDown={handleStart}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchEnd={handleEnd}
          onTouchMove={handleEnd}
          onPointerDown={(e) => {
            if (isSelectionMode) onPointerDown(item.id, isSelected, e);
          }}
          onPointerEnter={() => onPointerEnter(item.id)}
          className={cn(
            "group relative aspect-square rounded-2xl overflow-hidden bg-white/[0.02] border border-white/5 transition-all duration-500 cursor-pointer",
            isSelected ? "ring-4 ring-primary scale-[0.98]" : "hover:border-primary/50",
            isSelectionMode && "touch-none" 
          )}
        >
          {isInView && (
            item.type === 'video' ? (
              <img 
                src={item.thumbnailUrl} 
                className={cn("w-full h-full object-cover transition-transform duration-500 group-hover:scale-110", item.isAdultContent && "blur-2xl opacity-40 scale-125")} 
                loading="lazy"
              />
            ) : (
              <Image 
                src={item.thumbnailUrl} 
                alt="" 
                fill 
                sizes="(max-width: 768px) 33vw, (max-width: 1200px) 20vw, 15vw"
                className={cn("object-cover transition-transform duration-500 group-hover:scale-110", item.isAdultContent && "blur-2xl opacity-40 scale-125")} 
                loading="lazy"
              />
            )
          )}
          
          {item.type === 'video' && (
            <div className="absolute top-3 right-3 z-10 p-1.5 bg-black/40 backdrop-blur-md rounded-lg">
              <Play className="h-4 w-4 text-white fill-white" />
            </div>
          )}

          {isSelectionMode && (
            <div className="absolute top-3 left-3 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all bg-black/40 border-white/40 shadow-lg">
              {isSelected && <div className="w-full h-full bg-primary rounded-full flex items-center justify-center animate-zoom-in"><Check className="h-3.5 w-3.5 text-white" /></div>}
            </div>
          )}

          <div className="absolute inset-0 z-30 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300">
            <p className="text-[10px] font-bold text-white truncate uppercase tracking-widest">{item.filename}</p>
            <div className="flex items-center justify-between">
              <p className="text-[8px] text-white/80 font-bold uppercase">{(item.size / 1024 / 1024).toFixed(2)} MB</p>
              {item.isAdultContent && <Badge className="h-3 px-1 text-[6px] bg-accent/20 text-accent border-none font-black uppercase">Adulto</Badge>}
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      
      {!isSelectionMode && (
        <ContextMenuContent className="w-56 bg-card border-white/10 shadow-2xl backdrop-blur-xl">
          <ContextMenuItem onClick={() => onClick(item)}>
            <Eye className="h-4 w-4 mr-2" /> Visualizar
          </ContextMenuItem>
          <ContextMenuItem asChild>
            <Link href={`/editor?id=${item.id}`} className="flex items-center w-full">
              <Wand2 className="h-4 w-4 mr-2" /> Editar
            </Link>
          </ContextMenuItem>
          <ContextMenuSeparator className="bg-white/5" />
          <ContextMenuItem onClick={() => onShare?.(item)} className="text-primary focus:text-primary">
            <Share2 className="h-4 w-4 mr-2" /> Distribución en Red
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onVault?.(item.id)} className="text-accent focus:text-accent">
            <Lock className="h-4 w-4 mr-2" /> Blindar Activo
          </ContextMenuItem>
          <ContextMenuSeparator className="bg-white/5" />
          <ContextMenuItem className="text-red-400 focus:text-red-400" onClick={() => onDelete?.(item.id)}>
            <Trash2 className="h-4 w-4 mr-2" /> Mover a Papelera
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
});

MediaCard.displayName = 'MediaCard';
