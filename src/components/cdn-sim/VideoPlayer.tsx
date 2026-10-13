"use client";

import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface VideoPlayerProps {
  videoSrc: string;
  lqVideoSrc?: string;
  title: string;
  isRemote: boolean;
  videoId: string; // Unique ID for this player instance (e.g., 'local' or 'remote')
  onSlowBuffering?: (playerId: string) => void; // Callback when slow buffering is detected
  className?: string;
}

const SIMULATED_REMOTE_LATENCY_MS = 2000; // 2 seconds
const BUFFERING_TIMEOUT_MS = 5000; // 5 seconds

export function VideoPlayer({
  videoSrc,
  lqVideoSrc,
  title,
  isRemote,
  videoId,
  onSlowBuffering,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSrc, setCurrentSrc] = useState(videoSrc);
  const [isLoading, setIsLoading] = useState(true);
  const [isBufferingSlow, setIsBufferingSlow] = useState(false);
  const isWaitingRef = useRef(false);
  const bufferingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentSrc(videoSrc);
    setIsLoading(true);
    setIsBufferingSlow(false); // Reset slow buffering state on src change
    isWaitingRef.current = false;
    if (bufferingTimerRef.current) {
      clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
  }, [videoSrc]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const clearBufferingTimer = () => {
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
    };

    const handleCanPlay = () => {
      isWaitingRef.current = false;
      setIsLoading(false);
      clearBufferingTimer();
      if (isRemote) {
        setTimeout(() => {
          videoElement.play().catch(error => console.error("Error playing remote video:", error));
        }, SIMULATED_REMOTE_LATENCY_MS);
      } else {
        videoElement.play().catch(error => console.error("Error playing local video:", error));
      }
    };

    const handleWaiting = () => {
      isWaitingRef.current = true;
      setIsLoading(true);
      clearBufferingTimer();
      bufferingTimerRef.current = setTimeout(() => {
        if (!isWaitingRef.current || videoElement.paused || videoElement.ended) return; // Check if still buffering
        setIsBufferingSlow(true);
        if (onSlowBuffering && lqVideoSrc && currentSrc !== lqVideoSrc) {
          onSlowBuffering(videoId);
        } else if (lqVideoSrc && currentSrc === lqVideoSrc) {
          toast({
            title: "Buffering Slowly",
            description: `${title} is buffering slowly even on lower quality.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Buffering Slowly",
            description: `${title} is buffering slowly. No lower quality available.`,
            variant: "destructive",
          });
        }
      }, BUFFERING_TIMEOUT_MS);
    };

    const handlePlaying = () => {
      isWaitingRef.current = false;
      setIsLoading(false);
      setIsBufferingSlow(false);
      clearBufferingTimer();
    };

    const handlePauseOrEnd = () => {
      isWaitingRef.current = false;
      clearBufferingTimer();
    };

    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('pause', handlePauseOrEnd);
    videoElement.addEventListener('ended', handlePauseOrEnd);
    videoElement.addEventListener('loadeddata', () => setIsLoading(false));

    // Autoplay muted is generally more reliable
    videoElement.muted = true; 

    return () => {
      isWaitingRef.current = false;
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('pause', handlePauseOrEnd);
      videoElement.removeEventListener('ended', handlePauseOrEnd);
      videoElement.removeEventListener('loadeddata', () => setIsLoading(false));
      clearBufferingTimer();
    };
  }, [currentSrc, isRemote, title, videoId, onSlowBuffering, lqVideoSrc, toast]);

  return (
    <Card className={cn("w-full shadow-lg rounded-xl overflow-hidden bg-card border transition-all", className)}>
      <CardHeader className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {isRemote ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Origin (+2s)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-300 border border-teal-500/25">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              Edge (0ms)
            </span>
          )}
          {lqVideoSrc && (
            <span
              className={cn(
                "text-[11px] font-medium px-2 py-0.5 rounded border transition-colors",
                currentSrc === lqVideoSrc
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-secondary/70 text-slate-300 border-border/70"
              )}
            >
              {currentSrc === lqVideoSrc ? "360p (Adaptive)" : "High Quality"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 relative aspect-video bg-black/95">
        <video
          ref={videoRef}
          key={currentSrc} // Re-mount video element when src changes
          src={currentSrc}
          controls
          width="100%"
          className="w-full h-full object-contain"
          playsInline // Important for mobile
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-[2px] transition-opacity">
            <div className="text-white text-center p-4">
              <svg className="animate-spin h-8 w-8 text-primary mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Loading video...</p>
              {isRemote && <p className="text-sm text-slate-300">(Simulating remote server latency)</p>}
            </div>
          </div>
        )}
        {isBufferingSlow && !isLoading && (
          <div className="absolute top-3 left-3 bg-destructive/90 backdrop-blur-sm text-destructive-foreground px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-md">
            <AlertCircle size={14} />
            <span>Buffering slowly</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
