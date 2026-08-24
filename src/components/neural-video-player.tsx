
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Loader2,
  MoreVertical,
  Volume1
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface NeuralVideoPlayerProps {
  src: string;
  className?: string;
}

export default function NeuralVideoPlayer({ src, className }: NeuralVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isPlaying && !isHovering) {
      timeout = setTimeout(() => setShowControls(false), 2500);
    } else {
      setShowControls(true);
    }
    return () => clearTimeout(timeout);
  }, [isPlaying, isHovering]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
      setShowControls(true);
    }
  }, [isPlaying]);

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
    setIsMuted(newVolume === 0);
    if (newVolume > 0) setPrevVolume(newVolume);
  };

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      
      if (newMuted) {
        setPrevVolume(volume);
        setVolume(0);
        videoRef.current.volume = 0;
      } else {
        const targetVol = prevVolume > 0 ? prevVolume : 0.5;
        setVolume(targetVol);
        videoRef.current.volume = targetVol;
      }
    }
  }, [isMuted, volume, prevVolume]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setCurrentTime(current);
      if (total > 0) {
        setProgress((current / total) * 100);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      videoRef.current.volume = volume;
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      const newTime = (value[0] / 100) * duration;
      videoRef.current.currentTime = newTime;
      setProgress(value[0]);
      setIsBuffering(true);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const VolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="h-6 w-6" />;
    if (volume < 0.5) return <Volume1 className="h-6 w-6" />;
    return <Volume2 className="h-6 w-6" />;
  };

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className={cn(
        "relative group bg-black flex items-center justify-center overflow-hidden outline-none",
        className
      )}
      onMouseMove={() => setShowControls(true)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onTouchStart={() => setShowControls(true)}
    >
      <video
        ref={videoRef}
        src={src}
        preload="auto"
        className={cn(
          "w-full h-full max-h-[85vh] object-contain cursor-pointer transition-all duration-500",
          isBuffering && "blur-sm opacity-70"
        )}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onSeeked={() => setIsBuffering(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setShowControls(true);
        }}
        onClick={togglePlay}
        playsInline
      />

      {/* Overlay de Carga (Buffering) */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/20 pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Loader2 className="h-16 w-16 text-accent animate-spin" />
              <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full animate-pulse" />
            </div>
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] drop-shadow-md">Sincronizando Fragmentos</span>
          </div>
        </div>
      )}

      {/* Overlay de Controles Táctiles Pro */}
      <div 
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 transition-opacity duration-500 flex flex-col justify-between p-4 lg:p-8 z-30",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={togglePlay}
      >
        {/* Superior: Info rápida */}
        <div className="flex justify-between items-start">
          <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_#66E0FF]", isPlaying && "animate-pulse")} />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Neural Streaming</span>
          </div>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 lg:hidden">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>

        {/* Inferior: Barra de mando */}
        <div 
          className="w-full space-y-6 sm:space-y-8" 
          onClick={(e) => e.stopPropagation()}
        >
          {/* Barra de progreso de alto contraste */}
          <div className="w-full group/slider">
            <Slider
              value={[progress]}
              max={100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-none sm:[&_[role=slider]]:h-4 sm:[&_[role=slider]]:w-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={togglePlay}
                className="h-12 w-12 sm:h-10 sm:w-10 text-white hover:bg-white/10 rounded-full"
              >
                {isPlaying ? <Pause className="h-8 w-8 fill-white" /> : <Play className="h-8 w-8 fill-white ml-1" />}
              </Button>

              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white font-mono tracking-tighter">
                <span>{formatTime(currentTime)}</span>
                <span className="opacity-30">/</span>
                <span className="opacity-50">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 group/volume transition-all">
                <div className="w-0 overflow-hidden group-hover/volume:w-20 lg:group-hover/volume:w-24 transition-all duration-300 flex items-center">
                  <Slider
                    value={[isMuted ? 0 : volume * 100]}
                    max={100}
                    step={1}
                    onValueChange={handleVolumeChange}
                    className="w-20 lg:w-24 cursor-pointer mr-2"
                  />
                </div>
                <Button 
                  variant="ghost" size="icon" 
                  onClick={toggleMute}
                  className="h-12 w-12 sm:h-10 sm:w-10 text-white hover:bg-white/10 rounded-full"
                >
                  <VolumeIcon />
                </Button>
              </div>

              <Button 
                variant="ghost" size="icon" 
                onClick={toggleFullscreen}
                className="h-12 w-12 sm:h-10 sm:w-10 text-white hover:bg-white/10 rounded-full"
              >
                {isFullscreen ? <Minimize2 className="h-6 w-6" /> : <Maximize2 className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Play central persistente */}
      {!isPlaying && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="h-24 w-24 bg-primary/20 backdrop-blur-2xl rounded-full border border-primary/30 flex items-center justify-center animate-zoom-in shadow-[0_0_50px_rgba(115,115,240,0.3)]">
            <Play className="h-12 w-12 text-white fill-white ml-2" />
          </div>
        </div>
      )}
    </div>
  );
}
