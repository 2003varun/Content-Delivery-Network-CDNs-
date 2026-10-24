"use client";

import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { PlaybackState, TimelineEvent } from '@/types/video';
import type { NetworkConfig } from '@/types/network';
import {
  calculateEffectiveStartupDelay,
  isNetworkOffline,
  getBandwidthPlaybackBehavior,
} from './network-simulation';

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
  networkConfig?: NetworkConfig;
}

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
  networkConfig,
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

  // Phase C2: Network Simulation refs
  const networkConfigRef = useRef(networkConfig);
  networkConfigRef.current = networkConfig;
  const isSimulatedStallRef = useRef(false);
  const bandwidthStallTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bandwidthRecoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const clearBandwidthTimers = () => {
    if (bandwidthStallTimeoutRef.current) {
      clearTimeout(bandwidthStallTimeoutRef.current);
      bandwidthStallTimeoutRef.current = null;
    }
    if (bandwidthRecoveryTimeoutRef.current) {
      clearTimeout(bandwidthRecoveryTimeoutRef.current);
      bandwidthRecoveryTimeoutRef.current = null;
    }
    isSimulatedStallRef.current = false;
  };

  // Source change handling
  useEffect(() => {
    setCurrentSrc(videoSrc);
    setIsLoading(true);
    setIsBufferingSlow(false);
    isWaitingRef.current = false;
    clearBandwidthTimers();

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

    // Check if applied network configuration is offline
    if (isNetworkOffline(networkConfigRef.current)) {
      setIsLoading(false);
      onPlaybackStateChangeRef.current?.('error');
      onTimelineEventRef.current?.({
        player: videoId,
        type: 'source',
        message: `Source activated: ${title} (Offline)`,
        details: 'Simulated network is offline — playback unavailable',
      });
      return;
    }

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

  // Phase C2: React to network configuration changes during active playback
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // If applied network configuration transitions to offline:
    if (isNetworkOffline(networkConfig)) {
      clearBandwidthTimers();
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
      if (remotePlayTimeoutRef.current) {
        clearTimeout(remotePlayTimeoutRef.current);
        remotePlayTimeoutRef.current = null;
      }
      videoElement.pause();
      setIsLoading(false);
      onPlaybackStateChangeRef.current?.('error');
      onTimelineEventRef.current?.({
        player: videoId,
        type: 'error',
        message: 'Playback halted: Applied network configuration is Offline',
        details: 'Connection unavailable',
      });
      return;
    }

    // If transitioning from offline back to online before startup completed:
    if (!isNetworkOffline(networkConfig) && !hasMeasuredStartupRef.current && videoElement.paused) {
      const currentNetworkLatency = networkConfig?.latencyMs ?? 0;
      const { totalDelayMs } = calculateEffectiveStartupDelay(isRemote, currentNetworkLatency);
      setIsLoading(true);
      onPlaybackStateChangeRef.current?.('loading');
      if (remotePlayTimeoutRef.current) clearTimeout(remotePlayTimeoutRef.current);
      remotePlayTimeoutRef.current = setTimeout(() => {
        remotePlayTimeoutRef.current = null;
        setIsLoading(false);
        if (videoRef.current) {
          videoRef.current.play().catch(e => console.error("Error starting video after restoring network:", e));
        }
      }, totalDelayMs);
      return;
    }

    // If startup has completed and network configuration changes:
    if (hasMeasuredStartupRef.current) {
      const wasSimulatedStall = isSimulatedStallRef.current;
      clearBandwidthTimers();
      const isLq = currentSrc === lqVideoSrc;
      const currentBandwidth = networkConfig?.bandwidthMbps ?? 25;
      const behavior = getBandwidthPlaybackBehavior(currentBandwidth, isLq, true);

      // Case A: The player was currently stalled by the bandwidth simulation
      if (wasSimulatedStall) {
        if (!behavior.shouldStall) {
          // Recover immediately if profile changed to non-stalling (e.g. Fast / 4G)
          isSimulatedStallRef.current = false;
          isWaitingRef.current = false;
          setIsLoading(false);
          setIsBufferingSlow(false);

          // Clear the continuous 5-second ABR timer
          if (bufferingTimerRef.current) {
            clearTimeout(bufferingTimerRef.current);
            bufferingTimerRef.current = null;
          }

          // Conclude any active stall metric cleanly
          if (isStallingRef.current) {
            isStallingRef.current = false;
            const duration = Math.round(performance.now() - (stallStartTimestampRef.current ?? performance.now()));
            stallStartTimestampRef.current = null;
            if (stallTickerRef.current) {
              clearInterval(stallTickerRef.current);
              stallTickerRef.current = null;
            }
            onCurrentStallDurationUpdateRef.current?.(0);
            if (duration > 0) {
              onStallEndRef.current?.(duration);
              onTimelineEventRef.current?.({
                player: videoId,
                type: 'buffering_end',
                message: `Buffering recovered after ${duration}ms (Network restored to ${networkConfig?.name ?? 'Fast / 4G'})`,
              });
            }
          }

          onPlaybackStateChangeRef.current?.('playing');
          if (!videoElement.ended && !isSeekingRef.current) {
            videoElement.play().catch(e => console.error("Error resuming playback after network profile change:", e));
          }
        }
      }
      // Case B: Currently playing actively
      else if (!videoElement.paused && !videoElement.ended && !isSeekingRef.current) {
        if (behavior.shouldStall) {
          bandwidthStallTimeoutRef.current = setTimeout(() => {
            bandwidthStallTimeoutRef.current = null;
            if (videoElement.paused || videoElement.ended || isSeekingRef.current) return;
            isSimulatedStallRef.current = true;
            videoElement.pause();
            // Trigger stall via standard handler
            videoElement.dispatchEvent(new Event('waiting'));

            if (behavior.stallDurationMs !== null) {
              bandwidthRecoveryTimeoutRef.current = setTimeout(() => {
                bandwidthRecoveryTimeoutRef.current = null;
                isSimulatedStallRef.current = false;
                if (!videoElement.ended && !isSeekingRef.current) {
                  videoElement.play().catch(e => console.error("Error resuming playback after simulated stall:", e));
                }
              }, behavior.stallDurationMs);
            }
          }, behavior.delayBeforeStallMs);
        }
      }
    }
  }, [networkConfig, currentSrc, lqVideoSrc, videoId, isRemote]);

  // Clean up interval and timeouts on unmount
  useEffect(() => {
    return () => {
      clearBandwidthTimers();
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
      clearBufferingTimer();
      clearRemotePlayTimeout();
      clearBandwidthTimers();

      // Block playback start if applied network is offline
      if (isNetworkOffline(networkConfigRef.current)) {
        setIsLoading(false);
        onPlaybackStateChangeRef.current?.('error');
        onTimelineEventRef.current?.({
          player: videoId,
          type: 'error',
          message: 'Playback blocked: Simulated network is offline',
          details: 'Connection unavailable',
        });
        return;
      }

      const activationId = currentActivationIdRef.current;
      const currentNetworkLatency = networkConfigRef.current?.latencyMs ?? 0;
      const { totalDelayMs } = calculateEffectiveStartupDelay(isRemote, currentNetworkLatency);

      // Phase C2: Apply simulated startup delay (base server latency + network RTT)
      if (!hasMeasuredStartupRef.current && totalDelayMs > 0) {
        setIsLoading(true); // Maintain visual loading state during startup delay
        remotePlayTimeoutRef.current = setTimeout(() => {
          remotePlayTimeoutRef.current = null;
          setIsLoading(false);
          if (currentActivationIdRef.current === activationId && videoElement) {
            videoElement.play().catch(error => {
              console.error("Error playing video:", error);
            });
          }
        }, totalDelayMs);
      } else {
        setIsLoading(false);
        videoElement.play().catch(error => {
          console.error("Error playing video:", error);
        });
      }
    };

    const handleStallIncident = (source: 'waiting' | 'stalled') => {
      isWaitingRef.current = true;
      setIsLoading(true);

      // Check if this is a genuine buffering stall:
      // Must not be paused by user (unless commanded by simulation stall), not ended, not seeking, AND initial startup must have completed
      const isGenuineStall =
        (!videoElement.paused || isSimulatedStallRef.current) &&
        !videoElement.ended &&
        !videoElement.seeking &&
        !isSeekingRef.current &&
        hasMeasuredStartupRef.current;

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
            details: source === 'stalled'
              ? 'Media download stalled'
              : isSimulatedStallRef.current
                ? 'Simulated bandwidth constraint buffer depletion'
                : 'Player waiting on media buffer',
          });

          // Ticker for active stall duration
          if (stallTickerRef.current) clearInterval(stallTickerRef.current);
          stallTickerRef.current = setInterval(() => {
            if (isStallingRef.current && stallStartTimestampRef.current !== null) {
              onCurrentStallDurationUpdateRef.current?.(Math.round(performance.now() - stallStartTimestampRef.current));
            }
          }, 250);

          // 5-second continuous buffering threshold for ABR
          clearBufferingTimer();
          bufferingTimerRef.current = setTimeout(() => {
            if (!isWaitingRef.current || (videoElement.paused && !isSimulatedStallRef.current) || videoElement.ended || isSeekingRef.current) return;
            setIsBufferingSlow(true);
            if (onSlowBufferingRef.current && lqVideoSrc && currentSrc !== lqVideoSrc) {
              // Finalize the stall that triggered ABR so its duration is preserved in metrics
              if (isStallingRef.current) {
                isStallingRef.current = false;
                const elapsedStall = stallStartTimestampRef.current !== null
                  ? Math.round(performance.now() - stallStartTimestampRef.current)
                  : BUFFERING_TIMEOUT_MS;
                stallStartTimestampRef.current = null;
                if (stallTickerRef.current) {
                  clearInterval(stallTickerRef.current);
                  stallTickerRef.current = null;
                }
                onCurrentStallDurationUpdateRef.current?.(0);
                if (elapsedStall > 0) {
                  onStallEndRef.current?.(elapsedStall);
                  onTimelineEventRef.current?.({
                    player: videoId,
                    type: 'buffering_end',
                    message: `Buffering ended on ABR switch after ${elapsedStall}ms`,
                  });
                }
              }
              clearBandwidthTimers();
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
        }
      }
    };

    const handleWaiting = () => handleStallIncident('waiting');
    const handleStalled = () => handleStallIncident('stalled');

    const handlePlaying = () => {
      isWaitingRef.current = false;
      setIsLoading(false);
      setIsBufferingSlow(false);
      clearBufferingTimer();
      clearRemotePlayTimeout();
      onPlaybackStateChangeRef.current?.('playing');

      const currentNetworkLatency = networkConfigRef.current?.latencyMs ?? 0;
      const { baseDelayMs, networkDelayMs, totalDelayMs } = calculateEffectiveStartupDelay(isRemote, currentNetworkLatency);

      // 1. Measure Startup Time on first playing event for this activation
      if (!hasMeasuredStartupRef.current && activationTimestampRef.current !== null) {
        hasMeasuredStartupRef.current = true;
        const startupDuration = Math.round(performance.now() - activationTimestampRef.current);
        onStartupMeasuredRef.current?.(startupDuration);
        onTimelineEventRef.current?.({
          player: videoId,
          type: 'startup',
          message: `Startup completed in ${startupDuration}ms`,
          details: `Server latency: ${baseDelayMs}ms • Network RTT: ${networkDelayMs}ms (Total delay: ${totalDelayMs}ms) | Monotonic elapsed: ${startupDuration}ms`,
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
        if (duration > 0) {
          onStallEndRef.current?.(duration);
          onTimelineEventRef.current?.({
            player: videoId,
            type: 'buffering_end',
            message: `Buffering recovered after ${duration}ms`,
          });
        }
      }

      // 3. Phase C2: Bandwidth simulation - schedule deterministic buffering pressure
      clearBandwidthTimers();
      const currentBandwidth = networkConfigRef.current?.bandwidthMbps ?? 25;
      const isLq = currentSrc === lqVideoSrc;
      const behavior = getBandwidthPlaybackBehavior(currentBandwidth, isLq, false);

      if (behavior.shouldStall) {
        bandwidthStallTimeoutRef.current = setTimeout(() => {
          bandwidthStallTimeoutRef.current = null;
          if (videoElement.paused || videoElement.ended || isSeekingRef.current) return;
          isSimulatedStallRef.current = true;
          videoElement.pause();
          handleStallIncident('waiting');

          if (behavior.stallDurationMs !== null) {
            bandwidthRecoveryTimeoutRef.current = setTimeout(() => {
              bandwidthRecoveryTimeoutRef.current = null;
              isSimulatedStallRef.current = false;
              if (!videoElement.ended && !isSeekingRef.current) {
                videoElement.play().catch(e => console.error("Error resuming playback after simulated stall:", e));
              }
            }, behavior.stallDurationMs);
          }
        }, behavior.delayBeforeStallMs);
      }
    };

    const handleSeeking = () => {
      clearBandwidthTimers();
      isSeekingRef.current = true;
      clearBufferingTimer();
      clearRemotePlayTimeout();

      // If a stall was active, close it and record the duration up to the seek
      if (isStallingRef.current) {
        isStallingRef.current = false;
        const duration = stallStartTimestampRef.current !== null
          ? Math.round(performance.now() - stallStartTimestampRef.current)
          : 0;
        stallStartTimestampRef.current = null;
        if (stallTickerRef.current) {
          clearInterval(stallTickerRef.current);
          stallTickerRef.current = null;
        }
        onCurrentStallDurationUpdateRef.current?.(0);
        if (duration > 0) {
          onStallEndRef.current?.(duration);
          onTimelineEventRef.current?.({
            player: videoId,
            type: 'buffering_end',
            message: `Buffering ended on seek after ${duration}ms`,
          });
        }
      }

      // Ensure playback state reflects non-buffering state
      if (videoElement.paused) {
        onPlaybackStateChangeRef.current?.('paused');
      } else {
        onPlaybackStateChangeRef.current?.('loading');
      }
    };

    const handleSeeked = () => {
      isSeekingRef.current = false;
      if (videoElement.paused) {
        onPlaybackStateChangeRef.current?.('paused');
      }
    };

    const handlePause = () => {
      if (isSimulatedStallRef.current) return; // Ignore programmatic pause from simulation stall
      clearBandwidthTimers();
      isWaitingRef.current = false;
      clearBufferingTimer();
      clearRemotePlayTimeout();

      // If a stall was active, close it and record the duration up to the pause
      if (isStallingRef.current) {
        isStallingRef.current = false;
        const duration = stallStartTimestampRef.current !== null
          ? Math.round(performance.now() - stallStartTimestampRef.current)
          : 0;
        stallStartTimestampRef.current = null;
        if (stallTickerRef.current) {
          clearInterval(stallTickerRef.current);
          stallTickerRef.current = null;
        }
        onCurrentStallDurationUpdateRef.current?.(0);
        if (duration > 0) {
          onStallEndRef.current?.(duration);
          onTimelineEventRef.current?.({
            player: videoId,
            type: 'buffering_end',
            message: `Buffering ended on pause after ${duration}ms`,
          });
        }
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
      clearBandwidthTimers();
      isWaitingRef.current = false;
      clearBufferingTimer();
      clearRemotePlayTimeout();

      if (isStallingRef.current) {
        isStallingRef.current = false;
        const duration = stallStartTimestampRef.current !== null
          ? Math.round(performance.now() - stallStartTimestampRef.current)
          : 0;
        stallStartTimestampRef.current = null;
        if (stallTickerRef.current) {
          clearInterval(stallTickerRef.current);
          stallTickerRef.current = null;
        }
        onCurrentStallDurationUpdateRef.current?.(0);
        if (duration > 0) {
          onStallEndRef.current?.(duration);
          onTimelineEventRef.current?.({
            player: videoId,
            type: 'buffering_end',
            message: `Buffering ended on completion after ${duration}ms`,
          });
        }
      }

      onPlaybackStateChangeRef.current?.('ended');
      onTimelineEventRef.current?.({
        player: videoId,
        type: 'ended',
        message: 'Playback completed',
      });
    };

    const handleError = () => {
      clearBandwidthTimers();
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
    videoElement.addEventListener('stalled', handleStalled);
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('seeking', handleSeeking);
    videoElement.addEventListener('seeked', handleSeeked);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('ended', handleEnded);
    videoElement.addEventListener('error', handleError);

    videoElement.muted = true;

    return () => {
      clearBandwidthTimers();
      isWaitingRef.current = false;
      videoElement.removeEventListener('loadstart', handleLoadStart);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('stalled', handleStalled);
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

  const isOffline = isNetworkOffline(networkConfig);
  const currentNetworkLatency = networkConfig?.latencyMs ?? 0;
  const effectiveDelayMs = isRemote ? (2000 + currentNetworkLatency) : currentNetworkLatency;

  return (
    <Card className={cn("w-full shadow-sm rounded-xl overflow-hidden bg-card border border-border transition-all", className)}>
      <CardHeader className="p-3.5 sm:p-4 border-b border-border bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {isOffline ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-800 border border-red-200 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Offline
            </span>
          ) : isRemote ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Origin ({effectiveDelayMs}ms)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Edge ({effectiveDelayMs}ms)
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
        {/* Controlled Offline Overlay */}
        {isOffline && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 backdrop-blur-[2px] transition-opacity z-10">
            <div className="text-center p-4 max-w-xs">
              <div className="h-10 w-10 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-2.5 text-destructive">
                <WifiOff className="h-5 w-5" />
              </div>
              <p className="font-semibold text-sm text-white">Network Simulation: Offline</p>
              <p className="text-xs text-slate-300 mt-1">
                Connection is currently unavailable. Apply an online network profile in Network Controls to resume.
              </p>
            </div>
          </div>
        )}
        {isLoading && !isOffline && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-[2px] transition-opacity">
            <div className="text-white text-center p-4">
              <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="font-medium text-sm">Loading video...</p>
              {isRemote && (
                <p className="text-xs text-slate-300 mt-1">
                  (Simulating {2000 + currentNetworkLatency}ms origin + RTT latency)
                </p>
              )}
              {!isRemote && currentNetworkLatency > 0 && (
                <p className="text-xs text-slate-300 mt-1">
                  (Simulating {currentNetworkLatency}ms edge RTT latency)
                </p>
              )}
            </div>
          </div>
        )}
        {isBufferingSlow && !isLoading && !isOffline && (
          <div className="absolute top-3 left-3 bg-destructive/95 backdrop-blur-sm text-destructive-foreground px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-md">
            <AlertCircle size={14} />
            <span>Buffering slowly</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
