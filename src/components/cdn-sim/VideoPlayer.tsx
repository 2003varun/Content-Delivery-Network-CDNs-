"use client";

import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { PlaybackState, TimelineEvent } from '@/types/video';

interface VideoPlayerProps {
  videoSrc: string;
  lqVideoSrc?: string;
  title: string;
  isRemote: boolean;
  videoId: 'local' | 'remote';
  resetToken?: number;
  onSlowBuffering?: (playerId: string) => void;
  className?: string;
  onPlaybackStateChange?: (state: PlaybackState) => void;
  onStartupMeasured?: (startupTimeMs: number) => void;
  onStallStart?: () => void;
  onStallEnd?: (durationMs: number) => void;
  onCurrentStallDurationUpdate?: (currentDurationMs: number) => void;
  onResolutionDetected?: (resolution: string) => void;
  onTimelineEvent?: (event: { player: 'local' | 'remote'; type: TimelineEvent['type']; message: string; details?: string }) => void;
}

const SIMULATED_REMOTE_LATENCY_MS = 2000; // 2 seconds
const BUFFERING_TIMEOUT_MS = 5000; // 5 seconds

export function VideoPlayer({
  videoSrc,
  lqVideoSrc,
  title,
  isRemote,
  videoId,
  resetToken,
  onSlowBuffering,
  className,
  onPlaybackStateChange,
  onStartupMeasured,
  onStallStart,
  onStallEnd,
  onCurrentStallDurationUpdate,
  onResolutionDetected,
  onTimelineEvent,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSrc, setCurrentSrc] = useState(videoSrc);
  const [isLoading, setIsLoading] = useState(true);
  const [isBufferingSlow, setIsBufferingSlow] = useState(false);
  const isWaitingRef = useRef(false);
  const bufferingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const remotePlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Phase B: Telemetry and monotonic timing refs
  const activationIdRef = useRef<number>(0);
  const currentActivationIdRef = useRef<number>(0);
  const activationTimestampRef = useRef<number>(performance.now());
  const hasMeasuredStartupRef = useRef<boolean>(false);
  const isSeekingRef = useRef<boolean>(false);
  const isStallingRef = useRef<boolean>(false);
  const stallStartTimestampRef = useRef<number | null>(null);
  const stallTickerRef = useRef<NodeJS.Timeout | null>(null);

  // Stable callback refs to prevent re-triggering effects on parent re-renders
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  onPlaybackStateChangeRef.current = onPlaybackStateChange;
  const onStartupMeasuredRef = useRef(onStartupMeasured);
  onStartupMeasuredRef.current = onStartupMeasured;
  const onStallStartRef = useRef(onStallStart);
  onStallStartRef.current = onStallStart;
  const onStallEndRef = useRef(onStallEnd);
  onStallEndRef.current = onStallEnd;
  const onCurrentStallDurationUpdateRef = useRef(onCurrentStallDurationUpdate);
  onCurrentStallDurationUpdateRef.current = onCurrentStallDurationUpdate;
  const onResolutionDetectedRef = useRef(onResolutionDetected);
  onResolutionDetectedRef.current = onResolutionDetected;
  const onTimelineEventRef = useRef(onTimelineEvent);
  onTimelineEventRef.current = onTimelineEvent;
  const onSlowBufferingRef = useRef(onSlowBuffering);
  onSlowBufferingRef.current = onSlowBuffering;

  // Source change handling
  useEffect(() => {
    setCurrentSrc(videoSrc);
    setIsLoading(true);
    setIsBufferingSlow(false);
    isWaitingRef.current = false;
    if (bufferingTimerRef.current) {
      clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
    if (remotePlayTimeoutRef.current) {
      clearTimeout(remotePlayTimeoutRef.current);
      remotePlayTimeoutRef.current = null;
    }

    // Clean up any ongoing stall
    if (stallTickerRef.current) {
      clearInterval(stallTickerRef.current);
      stallTickerRef.current = null;
    }
    isStallingRef.current = false;
    stallStartTimestampRef.current = null;
    onCurrentStallDurationUpdateRef.current?.(0);

    // Record source activation for startup measurement
    const newActivationId = ++activationIdRef.current;
    currentActivationIdRef.current = newActivationId;
    activationTimestampRef.current = performance.now();
    hasMeasuredStartupRef.current = false;

    onPlaybackStateChangeRef.current?.('loading');
    onTimelineEventRef.current?.({
      player: videoId,
      type: 'source',
      message: `Source activated: ${title}`,
      details: videoSrc.startsWith('blob:') ? 'Uploaded local blob URL' : 'Remote stream',
    });
  }, [videoSrc, title, videoId]);

  // Handle metrics reset during active playback or stalls
  useEffect(() => {
    if (resetToken === undefined || resetToken === 0) return;
    if (isStallingRef.current) {
      stallStartTimestampRef.current = performance.now();
      onCurrentStallDurationUpdateRef.current?.(0);
    }
  }, [resetToken]);

  // Clean up interval and timeouts on unmount
  useEffect(() => {
    return () => {
      if (stallTickerRef.current) {
        clearInterval(stallTickerRef.current);
        stallTickerRef.current = null;
      }
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
      if (remotePlayTimeoutRef.current) {
        clearTimeout(remotePlayTimeoutRef.current);
        remotePlayTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const clearBufferingTimer = () => {
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
    };

    const clearRemotePlayTimeout = () => {
      if (remotePlayTimeoutRef.current) {
        clearTimeout(remotePlayTimeoutRef.current);
        remotePlayTimeoutRef.current = null;
      }
    };

    const handleLoadStart = () => {
      if (videoElement.paused && !videoElement.ended) {
        onPlaybackStateChangeRef.current?.('loading');
      }
    };

    const handleLoadedMetadata = () => {
      if (videoElement.videoWidth && videoElement.videoHeight) {
        onResolutionDetectedRef.current?.(`${videoElement.videoWidth}x${videoElement.videoHeight} (${videoElement.videoHeight}p)`);
      }
    };

    const handleLoadedData = () => {
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      isWaitingRef.current = false;
      setIsLoading(false);
      clearBufferingTimer();
      clearRemotePlayTimeout();

      const activationId = currentActivationIdRef.current;

      if (isRemote) {
        remotePlayTimeoutRef.current = setTimeout(() => {
          remotePlayTimeoutRef.current = null;
          if (currentActivationIdRef.current === activationId && videoElement) {
            videoElement.play().catch(error => {
              console.error("Error playing remote video:", error);
            });
          }
        }, SIMULATED_REMOTE_LATENCY_MS);
      } else {
        videoElement.play().catch(error => {
          console.error("Error playing local video:", error);
        });
      }
    };

    const handleWaiting = () => {
      isWaitingRef.current = true;
      setIsLoading(true);
      clearBufferingTimer();

      // Check if this is a genuine buffering stall (not paused, not ended, not seeking)
      const isGenuineStall = !videoElement.paused && !videoElement.ended && !isSeekingRef.current;
      if (isGenuineStall) {
        onPlaybackStateChangeRef.current?.('buffering');
        if (!isStallingRef.current) {
          isStallingRef.current = true;
          const now = performance.now();
          stallStartTimestampRef.current = now;
          onStallStartRef.current?.();
          onTimelineEventRef.current?.({
            player: videoId,
            type: 'buffering_start',
            message: 'Buffering stall started',
            details: 'Player waiting on media buffer',
          });

          // Ticker for active stall duration
          if (stallTickerRef.current) clearInterval(stallTickerRef.current);
          stallTickerRef.current = setInterval(() => {
            if (isStallingRef.current && stallStartTimestampRef.current !== null) {
              onCurrentStallDurationUpdateRef.current?.(Math.round(performance.now() - stallStartTimestampRef.current));
            }
          }, 250);
        }
      }

      bufferingTimerRef.current = setTimeout(() => {
        if (!isWaitingRef.current || videoElement.paused || videoElement.ended || isSeekingRef.current) return;
        setIsBufferingSlow(true);
        if (onSlowBufferingRef.current && lqVideoSrc && currentSrc !== lqVideoSrc) {
          onSlowBufferingRef.current(videoId);
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
      clearRemotePlayTimeout();
      onPlaybackStateChangeRef.current?.('playing');

      // 1. Measure Startup Time on first playing event for this activation
      if (!hasMeasuredStartupRef.current && activationTimestampRef.current !== null) {
        hasMeasuredStartupRef.current = true;
        const startupDuration = Math.round(performance.now() - activationTimestampRef.current);
        onStartupMeasuredRef.current?.(startupDuration);
        onTimelineEventRef.current?.({
          player: videoId,
          type: 'startup',
          message: `Startup completed in ${startupDuration}ms`,
          details: `Simulated delay: ${isRemote ? '2,000ms' : '0ms'} | Monotonic elapsed: ${startupDuration}ms`,
        });
      } else {
        onTimelineEventRef.current?.({
          player: videoId,
          type: 'play',
          message: 'Playback started / resumed',
        });
      }

      // 2. Resolve any active buffering stall
      if (isStallingRef.current) {
        isStallingRef.current = false;
        const duration = Math.round(performance.now() - (stallStartTimestampRef.current ?? performance.now()));
        stallStartTimestampRef.current = null;
        if (stallTickerRef.current) {
          clearInterval(stallTickerRef.current);
          stallTickerRef.current = null;
        }
        onCurrentStallDurationUpdateRef.current?.(0);
        onStallEndRef.current?.(duration);
        onTimelineEventRef.current?.({
          player: videoId,
          type: 'buffering_end',
          message: `Buffering recovered after ${duration}ms`,
        });
      }
    };

    const handleSeeking = () => {
      isSeekingRef.current = true;
      clearBufferingTimer();
      clearRemotePlayTimeout();
      // Seek is an intentional user operation, not a buffering stall
      if (isStallingRef.current) {
        isStallingRef.current = false;
        stallStartTimestampRef.current = null;
        if (stallTickerRef.current) {
          clearInterval(stallTickerRef.current);
          stallTickerRef.current = null;
        }
        onCurrentStallDurationUpdateRef.current?.(0);
      }
    };

    const handleSeeked = () => {
      isSeekingRef.current = false;
    };

    const handlePause = () => {
      isWaitingRef.current = false;
      clearBufferingTimer();
      clearRemotePlayTimeout();

      if (isStallingRef.current) {
        isStallingRef.current = false;
        stallStartTimestampRef.current = null;
        if (stallTickerRef.current) {
          clearInterval(stallTickerRef.current);
          stallTickerRef.current = null;
        }
        onCurrentStallDurationUpdateRef.current?.(0);
      }

      if (!videoElement.ended) {
        onPlaybackStateChangeRef.current?.('paused');
        onTimelineEventRef.current?.({
          player: videoId,
          type: 'pause',
          message: 'Playback paused',
        });
      }
    };

    const handleEnded = () => {
      isWaitingRef.current = false;
      clearBufferingTimer();
      clearRemotePlayTimeout();

      if (isStallingRef.current) {
        isStallingRef.current = false;
        stallStartTimestampRef.current = null;
        if (stallTickerRef.current) {
          clearInterval(stallTickerRef.current);
          stallTickerRef.current = null;
        }
        onCurrentStallDurationUpdateRef.current?.(0);
      }

      onPlaybackStateChangeRef.current?.('ended');
      onTimelineEventRef.current?.({
        player: videoId,
        type: 'ended',
        message: 'Playback completed',
      });
    };

    const handleError = () => {
      isWaitingRef.current = false;
      clearBufferingTimer();
      clearRemotePlayTimeout();
      onPlaybackStateChangeRef.current?.('error');
      onTimelineEventRef.current?.({
        player: videoId,
        type: 'error',
        message: 'Media decode error occurred',
      });
    };

    videoElement.addEventListener('loadstart', handleLoadStart);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('seeking', handleSeeking);
    videoElement.addEventListener('seeked', handleSeeked);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('ended', handleEnded);
    videoElement.addEventListener('error', handleError);

    videoElement.muted = true;

    return () => {
      isWaitingRef.current = false;
      videoElement.removeEventListener('loadstart', handleLoadStart);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('seeking', handleSeeking);
      videoElement.removeEventListener('seeked', handleSeeked);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('ended', handleEnded);
      videoElement.removeEventListener('error', handleError);
      clearBufferingTimer();
      clearRemotePlayTimeout();
    };
  }, [currentSrc, isRemote, title, videoId, lqVideoSrc, toast]);

  return (
    <Card className={cn("w-full shadow-sm rounded-xl overflow-hidden bg-card border border-border transition-all", className)}>
      <CardHeader className="p-3.5 sm:p-4 border-b border-border bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {isRemote ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Origin (+2s)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Edge (0ms)
            </span>
          )}
          {lqVideoSrc && (
            <span
              className={cn(
                "text-[11px] font-medium px-2 py-0.5 rounded border transition-colors",
                currentSrc === lqVideoSrc
                  ? "bg-amber-50 text-amber-800 border-amber-300 font-semibold"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              )}
            >
              {currentSrc === lqVideoSrc ? "360p (Adaptive)" : "High Quality"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 relative aspect-video bg-slate-950">
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
              <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="font-medium text-sm">Loading video...</p>
              {isRemote && <p className="text-xs text-slate-300 mt-1">(Simulating remote server latency)</p>}
            </div>
          </div>
        )}
        {isBufferingSlow && !isLoading && (
          <div className="absolute top-3 left-3 bg-destructive/95 backdrop-blur-sm text-destructive-foreground px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-md">
            <AlertCircle size={14} />
            <span>Buffering slowly</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
