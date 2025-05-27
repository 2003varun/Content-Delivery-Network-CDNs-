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
  const bufferingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentSrc(videoSrc);
    setIsLoading(true);
    setIsBufferingSlow(false); // Reset slow buffering state on src change
  }, [videoSrc]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleCanPlay = () => {
      setIsLoading(false);
      if (isRemote) {
        setTimeout(() => {
          videoElement.play().catch(error => console.error("Error playing remote video:", error));
        }, SIMULATED_REMOTE_LATENCY_MS);
      } else {
        videoElement.play().catch(error => console.error("Error playing local video:", error));
      }
    };

    const handleWaiting = () => {
      setIsLoading(true);
      if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = setTimeout(() => {
        if (videoElement.paused || videoElement.ended || !isLoading) return; // Check if still buffering
        setIsBufferingSlow(true);
        if (onSlowBuffering && lqVideoSrc && currentSrc !== lqVideoSrc) {
          onSlowBuffering(videoId);
          toast({
            title: "Adaptive Quality Triggered",
            description: `${title} is buffering slowly. Switched to lower quality.`,
            variant: "default",
          });
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
      setIsLoading(false);
      setIsBufferingSlow(false);
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
    };
    
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('loadeddata', () => setIsLoading(false));


    // Autoplay muted is generally more reliable
    videoElement.muted = true; 

    return () => {
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('loadeddata', () => setIsLoading(false));
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
      }
    };
  }, [currentSrc, isRemote, title, videoId, onSlowBuffering, lqVideoSrc, toast]);

  return (
    <Card className={cn("w-full shadow-lg rounded-lg overflow-hidden", className)}>
      <CardHeader className="p-4 border-b">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 relative aspect-video bg-black">
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
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white text-center">
              <svg className="animate-spin h-8 w-8 text-primary mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Loading video...</p>
              {isRemote && <p className="text-sm">(Simulating remote server latency)</p>}
            </div>
          </div>
        )}
        {isBufferingSlow && !isLoading && (
           <div className="absolute top-2 left-2 bg-destructive text-destructive-foreground p-2 rounded-md text-xs flex items-center gap-1">
            <AlertCircle size={14} />
            <span>Buffering slowly</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
