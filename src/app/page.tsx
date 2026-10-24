
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sampleVideos } from '@/lib/video-data';
import type { SampleVideo, PlayerMetrics, QualitySwitchEntry, TimelineEvent, PlaybackState } from '@/types/video';
import { VideoSelector } from '@/components/cdn-sim/VideoSelector';
import { VideoPlayer } from '@/components/cdn-sim/VideoPlayer';
import { PerformancePanel } from '@/components/cdn-sim/PerformancePanel';
import { NetworkControls } from '@/components/cdn-sim/NetworkControls';
import { ContentSuggestionTool } from '@/components/cdn-sim/ContentSuggestionTool';
import type { NetworkConfig } from '@/types/network';
import { DEFAULT_NETWORK_CONFIG } from '@/types/network';
import type { EdgeCacheState } from '@/types/cache';
import { INITIAL_EDGE_CACHE_STATE } from '@/types/cache';
import { EdgeCachePanel } from '@/components/cdn-sim/EdgeCachePanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart3, Activity, Sliders, HardDrive, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function CdnSimPage() {
  const [selectedVideo, setSelectedVideo] = useState<SampleVideo | null>(() => sampleVideos[0] || null);
  const [localVideoSrc, setLocalVideoSrc] = useState<string | undefined>(() => sampleVideos[0]?.hqSrc);
  const [remoteVideoSrc, setRemoteVideoSrc] = useState<string | undefined>(() => sampleVideos[0]?.hqSrc);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const { toast } = useToast();

  // Phase B: Telemetry & Monitoring state
  const [localMetrics, setLocalMetrics] = useState<PlayerMetrics>({
    playerId: 'local',
    title: 'Local Server (Edge Node)',
    playbackState: 'idle',
    simulatedDelayMs: 0,
    measuredStartupTimeMs: null,
    stallCount: 0,
    totalStallDurationMs: 0,
    currentStallDurationMs: 0,
    lastStallDurationMs: null,
    currentResolution: '',
  });

  const [remoteMetrics, setRemoteMetrics] = useState<PlayerMetrics>({
    playerId: 'remote',
    title: 'Remote Server (Origin Server)',
    playbackState: 'idle',
    simulatedDelayMs: 2000,
    measuredStartupTimeMs: null,
    stallCount: 0,
    totalStallDurationMs: 0,
    currentStallDurationMs: 0,
    lastStallDurationMs: null,
    currentResolution: '',
  });

  const [qualityHistory, setQualityHistory] = useState<QualitySwitchEntry[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [metricsResetToken, setMetricsResetToken] = useState<number>(0);

  // Phase C1: Network Simulation State
  const [appliedNetworkConfig, setAppliedNetworkConfig] = useState<NetworkConfig>(DEFAULT_NETWORK_CONFIG);

  // Phase D: Edge Cache Simulation State
  const [cacheState, setCacheState] = useState<EdgeCacheState>(INITIAL_EDGE_CACHE_STATE);

  // Phase C2: Keep simulated delay metrics in sync with applied network latency
  useEffect(() => {
    setLocalMetrics(prev => ({
      ...prev,
      simulatedDelayMs: appliedNetworkConfig.latencyMs,
    }));
    setRemoteMetrics(prev => ({
      ...prev,
      simulatedDelayMs: 2000 + appliedNetworkConfig.latencyMs,
    }));
  }, [appliedNetworkConfig.latencyMs]);

  // Bounded timeline logger (latest 100 events, newest first)
  const addTimelineEvent = useCallback((event: { player: 'local' | 'remote' | 'system'; type: TimelineEvent['type']; message: string; details?: string }) => {
    const now = new Date();
    const formattedTime = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const newEvent: TimelineEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      formattedTime,
      player: event.player,
      type: event.type,
      message: event.message,
      details: event.details,
    };
    setTimelineEvents(prev => [newEvent, ...prev.slice(0, 99)]);
  }, []);

  const handleApplyNetworkConfig = useCallback((newConfig: NetworkConfig) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const configWithTimestamp: NetworkConfig = {
      ...newConfig,
      appliedAt: timeStr,
    };
    setAppliedNetworkConfig(configWithTimestamp);
    addTimelineEvent({
      player: 'system',
      type: 'network',
      message: `Network applied: ${newConfig.name}`,
      details: `Latency: ${newConfig.latencyMs}ms RTT • Bandwidth: ${newConfig.bandwidthMbps === 0 ? '0 Mbps (Offline)' : `${newConfig.bandwidthMbps} Mbps`} • Loss: ${newConfig.packetLossPercent}%`,
    });
    toast({
      title: "Network Profile Applied",
      description: `Active configuration set to ${newConfig.name} (${newConfig.latencyMs}ms RTT, ${newConfig.bandwidthMbps === 0 ? 'Offline' : `${newConfig.bandwidthMbps} Mbps`}, ${newConfig.packetLossPercent}% loss).`,
    });
  }, [addTimelineEvent, toast]);

  const handleResetNetworkConfig = useCallback(() => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const configWithTimestamp: NetworkConfig = {
      ...DEFAULT_NETWORK_CONFIG,
      appliedAt: timeStr,
    };
    setAppliedNetworkConfig(configWithTimestamp);
    addTimelineEvent({
      player: 'system',
      type: 'network',
      message: `Network reset to default: ${DEFAULT_NETWORK_CONFIG.name}`,
      details: `Latency: ${DEFAULT_NETWORK_CONFIG.latencyMs}ms RTT • Bandwidth: ${DEFAULT_NETWORK_CONFIG.bandwidthMbps} Mbps • Loss: ${DEFAULT_NETWORK_CONFIG.packetLossPercent}%`,
    });
    toast({
      title: "Network Profile Reset",
      description: `Restored default configuration: ${DEFAULT_NETWORK_CONFIG.name}.`,
    });
  }, [addTimelineEvent, toast]);

  // Phase D: Purge Edge Cache Handler
  const handlePurgeCache = useCallback(() => {
    setCacheState(INITIAL_EDGE_CACHE_STATE);
    addTimelineEvent({
      player: 'system',
      type: 'cache',
      message: 'Edge Cache purged',
      details: 'All in-memory cached video entries have been cleared',
    });
    toast({
      title: "Edge Cache Purged",
      description: "All cached items have been cleared. Next request will be a Cache MISS.",
    });
  }, [addTimelineEvent, toast]);

  const handleClearMonitoringData = useCallback(() => {
    setMetricsResetToken(prev => prev + 1);
    setLocalMetrics(prev => ({
      ...prev,
      measuredStartupTimeMs: null,
      stallCount: prev.playbackState === 'buffering' ? 1 : 0,
      totalStallDurationMs: 0,
      currentStallDurationMs: 0,
      lastStallDurationMs: null,
    }));
    setRemoteMetrics(prev => ({
      ...prev,
      measuredStartupTimeMs: null,
      stallCount: prev.playbackState === 'buffering' ? 1 : 0,
      totalStallDurationMs: 0,
      currentStallDurationMs: 0,
      lastStallDurationMs: null,
    }));
    setQualityHistory([]);
    setTimelineEvents([]);
    toast({
      title: "Monitoring Data Reset",
      description: "Metrics and event timeline have been cleared. Active video playback continues unaffected.",
    });
  }, [toast]);

  const handleVideoSelect = useCallback((videoId: string) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setUploadedFile(null);

    const video = sampleVideos.find(v => v.id === videoId);
    if (video) {
      setSelectedVideo(video);
      setLocalVideoSrc(video.hqSrc);
      setRemoteVideoSrc(video.hqSrc);
      setLocalMetrics(prev => ({
        ...prev,
        measuredStartupTimeMs: null,
        playbackState: 'loading',
        stallCount: 0,
        totalStallDurationMs: 0,
        currentStallDurationMs: 0,
        lastStallDurationMs: null,
        currentResolution: '',
      }));
      setRemoteMetrics(prev => ({
        ...prev,
        measuredStartupTimeMs: null,
        playbackState: 'loading',
        stallCount: 0,
        totalStallDurationMs: 0,
        currentStallDurationMs: 0,
        lastStallDurationMs: null,
        currentResolution: '',
      }));

      // Phase D: Edge Cache lookup
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      setCacheState(prev => {
        const isCached = !!prev.cachedItems[video.id];
        if (isCached) {
          const nextHitCount = prev.cachedItems[video.id].hitCount + 1;
          addTimelineEvent({
            player: 'local',
            type: 'cache',
            message: `Edge Cache HIT: "${video.title}"`,
            details: `Served directly from Edge Node cache (Hits: ${nextHitCount})`,
          });
          toast({
            title: "Edge Cache HIT",
            description: `"${video.title}" served directly from Edge cache.`,
          });
          return {
            ...prev,
            hits: prev.hits + 1,
            lastStatus: 'HIT',
            lastItemTitle: video.title,
            cachedItems: {
              ...prev.cachedItems,
              [video.id]: {
                ...prev.cachedItems[video.id],
                hitCount: nextHitCount,
              },
            },
          };
        } else {
          addTimelineEvent({
            player: 'local',
            type: 'cache',
            message: `Edge Cache MISS: "${video.title}"`,
            details: 'Content not found in Edge cache — fetched through Origin Server and stored in Edge cache',
          });
          toast({
            title: "Edge Cache MISS",
            description: `"${video.title}" fetched from Origin and stored in Edge cache.`,
          });
          return {
            ...prev,
            misses: prev.misses + 1,
            lastStatus: 'MISS',
            lastItemTitle: video.title,
            cachedItems: {
              ...prev.cachedItems,
              [video.id]: {
                id: video.id,
                title: video.title,
                cachedAt: timeStr,
                hitCount: 0,
              },
            },
          };
        }
      });

      addTimelineEvent({
        player: 'system',
        type: 'source',
        message: `Sample video selected: ${video.title}`,
        details: 'Loaded high-quality stream for Edge and Origin',
      });
    } else {
      setSelectedVideo(null);
      setLocalVideoSrc(undefined);
      setRemoteVideoSrc(undefined);
    }
  }, [addTimelineEvent, toast]);

  useEffect(() => {
    // If no video/file is active, restore default sample video
    if (sampleVideos.length > 0 && !selectedVideo && !uploadedFile) {
      handleVideoSelect(sampleVideos[0].id);
    }
  }, [selectedVideo, uploadedFile, handleVideoSelect]);

  useEffect(() => {
    // Cleanup object URL on unmount
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  // Phase D: Initial cache registration for default video on startup
  useEffect(() => {
    const defaultVideo = sampleVideos[0];
    if (defaultVideo) {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      setCacheState(prev => {
        if (prev.lastStatus !== null || Object.keys(prev.cachedItems).length > 0) return prev;
        return {
          cachedItems: {
            [defaultVideo.id]: {
              id: defaultVideo.id,
              title: defaultVideo.title,
              cachedAt: timeStr,
              hitCount: 0,
            },
          },
          hits: 0,
          misses: 1,
          lastStatus: 'MISS',
          lastItemTitle: defaultVideo.title,
        };
      });
      addTimelineEvent({
        player: 'local',
        type: 'cache',
        message: `Initial Cache MISS: "${defaultVideo.title}"`,
        details: 'Initial content fetched through Origin Server and populated in Edge Cache',
      });
    }
  }, [addTimelineEvent]);

  const handleLocalFileSelect = useCallback((file: File) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    setSelectedVideo(null);
    setUploadedFile(file);

    const newObjectUrl = URL.createObjectURL(file);
    objectUrlRef.current = newObjectUrl;

    setLocalVideoSrc(newObjectUrl);
    setRemoteVideoSrc(newObjectUrl);
    setLocalMetrics(prev => ({
      ...prev,
      measuredStartupTimeMs: null,
      playbackState: 'loading',
      stallCount: 0,
      totalStallDurationMs: 0,
      currentStallDurationMs: 0,
      lastStallDurationMs: null,
      currentResolution: '',
    }));
    setRemoteMetrics(prev => ({
      ...prev,
      measuredStartupTimeMs: null,
      playbackState: 'loading',
      stallCount: 0,
      totalStallDurationMs: 0,
      currentStallDurationMs: 0,
      lastStallDurationMs: null,
      currentResolution: '',
    }));

    // Phase D: Edge Cache lookup for uploaded file
    const fileId = `file-${file.name}`;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setCacheState(prev => {
      const isCached = !!prev.cachedItems[fileId];
      if (isCached) {
        const nextHitCount = prev.cachedItems[fileId].hitCount + 1;
        addTimelineEvent({
          player: 'local',
          type: 'cache',
          message: `Edge Cache HIT: "${file.name}"`,
          details: `Served directly from Edge Node cache (Hits: ${nextHitCount})`,
        });
        toast({
          title: "Edge Cache HIT",
          description: `"${file.name}" served directly from Edge cache.`,
        });
        return {
          ...prev,
          hits: prev.hits + 1,
          lastStatus: 'HIT',
          lastItemTitle: file.name,
          cachedItems: {
            ...prev.cachedItems,
            [fileId]: {
              ...prev.cachedItems[fileId],
              hitCount: nextHitCount,
            },
          },
        };
      } else {
        addTimelineEvent({
          player: 'local',
          type: 'cache',
          message: `Edge Cache MISS: "${file.name}"`,
          details: 'Uploaded file not in Edge cache — ingested and stored in Edge cache',
        });
        toast({
          title: "Edge Cache MISS",
          description: `"${file.name}" ingested and stored in Edge cache.`,
        });
        return {
          ...prev,
          misses: prev.misses + 1,
          lastStatus: 'MISS',
          lastItemTitle: file.name,
          cachedItems: {
            ...prev.cachedItems,
            [fileId]: {
              id: fileId,
              title: file.name,
              cachedAt: timeStr,
              hitCount: 0,
            },
          },
        };
      }
    });

    addTimelineEvent({
      player: 'system',
      type: 'source',
      message: `Local file uploaded: ${file.name}`,
      details: `${(file.size / (1024 * 1024)).toFixed(2)} MB • Object URL generated`,
    });
  }, [addTimelineEvent, toast]);

  const handleClearLocalFile = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setUploadedFile(null);

    const defaultVideo = sampleVideos[0];
    if (defaultVideo) {
      setSelectedVideo(defaultVideo);
      setLocalVideoSrc(defaultVideo.hqSrc);
      setRemoteVideoSrc(defaultVideo.hqSrc);
      setLocalMetrics(prev => ({
        ...prev,
        measuredStartupTimeMs: null,
        playbackState: 'loading',
        stallCount: 0,
        totalStallDurationMs: 0,
        currentStallDurationMs: 0,
        lastStallDurationMs: null,
        currentResolution: '',
      }));
      setRemoteMetrics(prev => ({
        ...prev,
        measuredStartupTimeMs: null,
        playbackState: 'loading',
        stallCount: 0,
        totalStallDurationMs: 0,
        currentStallDurationMs: 0,
        lastStallDurationMs: null,
        currentResolution: '',
      }));
      addTimelineEvent({
        player: 'system',
        type: 'source',
        message: 'Local file cleared',
        details: `Object URL revoked • Restored default: ${defaultVideo.title}`,
      });
    } else {
      setSelectedVideo(null);
      setLocalVideoSrc(undefined);
      setRemoteVideoSrc(undefined);
    }
  }, [addTimelineEvent]);

  const handleSlowBuffering = useCallback((playerId: 'local' | 'remote') => {
    const playerTitle = playerId === 'local' ? (uploadedFile ? `Local: ${uploadedFile.name}` : 'Local Server') : (uploadedFile ? `Remote: ${uploadedFile.name}` : 'Remote Server');

    if (uploadedFile) {
      toast({
        title: "Buffering Slowly",
        description: `${playerTitle} is buffering. No lower quality available for uploaded files.`,
        variant: "default",
      });
      return;
    }

    if (!selectedVideo) return;

    // Existing logic for sample videos
    if (playerId === 'local' && localVideoSrc === selectedVideo.hqSrc && selectedVideo.lqSrc) {
      setLocalVideoSrc(selectedVideo.lqSrc);
      setLocalMetrics(prev => ({ ...prev, measuredStartupTimeMs: null, playbackState: 'loading' }));
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const entry: QualitySwitchEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: timeStr,
        playerId: 'local',
        playerTitle: 'Edge (Local)',
        previousQuality: '720p (HQ)',
        newQuality: '360p (LQ)',
        reason: 'Adaptive ABR: Continuous buffering exceeded 5s threshold',
      };
      setQualityHistory(prev => [entry, ...prev]);
      addTimelineEvent({
        player: 'local',
        type: 'quality',
        message: 'Adaptive ABR Switch: 720p (HQ) → 360p (LQ)',
        details: 'Buffering exceeded 5,000ms threshold on high quality',
      });
      toast({
        title: "Adaptive Quality Triggered",
        description: `${playerTitle} is buffering slowly. Switched to lower quality.`,
      });
    } else if (playerId === 'remote' && remoteVideoSrc === selectedVideo.hqSrc && selectedVideo.lqSrc) {
      setRemoteVideoSrc(selectedVideo.lqSrc);
      setRemoteMetrics(prev => ({ ...prev, measuredStartupTimeMs: null, playbackState: 'loading' }));
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const entry: QualitySwitchEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: timeStr,
        playerId: 'remote',
        playerTitle: 'Origin (Remote)',
        previousQuality: '720p (HQ)',
        newQuality: '360p (LQ)',
        reason: 'Adaptive ABR: Continuous buffering exceeded 5s threshold',
      };
      setQualityHistory(prev => [entry, ...prev]);
      addTimelineEvent({
        player: 'remote',
        type: 'quality',
        message: 'Adaptive ABR Switch: 720p (HQ) → 360p (LQ)',
        details: 'Buffering exceeded 5,000ms threshold on high quality',
      });
      toast({
        title: "Adaptive Quality Triggered",
        description: `${playerTitle} is buffering slowly. Switched to lower quality.`,
      });
    } else if (selectedVideo.lqSrc && (localVideoSrc === selectedVideo.lqSrc || remoteVideoSrc === selectedVideo.lqSrc)) {
      toast({
        title: "Buffering Slowly",
        description: `${playerTitle} is buffering slowly even on lower quality.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Buffering Slowly",
        description: `${playerTitle} is buffering slowly. No lower quality available.`,
        variant: "destructive",
      });
    }
  }, [selectedVideo, localVideoSrc, remoteVideoSrc, uploadedFile, toast, addTimelineEvent]);

  // Memoized playback callbacks for dual video players
  const handleLocalSlowBuffering = useCallback(() => handleSlowBuffering('local'), [handleSlowBuffering]);
  const handleRemoteSlowBuffering = useCallback(() => handleSlowBuffering('remote'), [handleSlowBuffering]);

  const handleLocalPlaybackStateChange = useCallback((state: PlaybackState) => {
    setLocalMetrics(prev => ({ ...prev, playbackState: state }));
  }, []);

  const handleRemotePlaybackStateChange = useCallback((state: PlaybackState) => {
    setRemoteMetrics(prev => ({ ...prev, playbackState: state }));
  }, []);

  const handleLocalStartupMeasured = useCallback((timeMs: number) => {
    setLocalMetrics(prev => ({ ...prev, measuredStartupTimeMs: timeMs }));
  }, []);

  const handleRemoteStartupMeasured = useCallback((timeMs: number) => {
    setRemoteMetrics(prev => ({ ...prev, measuredStartupTimeMs: timeMs }));
  }, []);

  const handleLocalStallStart = useCallback(() => {
    setLocalMetrics(prev => ({ ...prev, stallCount: prev.stallCount + 1 }));
  }, []);

  const handleRemoteStallStart = useCallback(() => {
    setRemoteMetrics(prev => ({ ...prev, stallCount: prev.stallCount + 1 }));
  }, []);

  const handleLocalStallEnd = useCallback((durationMs: number) => {
    setLocalMetrics(prev => ({
      ...prev,
      totalStallDurationMs: prev.totalStallDurationMs + durationMs,
      lastStallDurationMs: durationMs,
      currentStallDurationMs: 0,
    }));
  }, []);

  const handleRemoteStallEnd = useCallback((durationMs: number) => {
    setRemoteMetrics(prev => ({
      ...prev,
      totalStallDurationMs: prev.totalStallDurationMs + durationMs,
      lastStallDurationMs: durationMs,
      currentStallDurationMs: 0,
    }));
  }, []);

  const handleLocalStallDurationUpdate = useCallback((curMs: number) => {
    setLocalMetrics(prev => ({ ...prev, currentStallDurationMs: curMs }));
  }, []);

  const handleRemoteStallDurationUpdate = useCallback((curMs: number) => {
    setRemoteMetrics(prev => ({ ...prev, currentStallDurationMs: curMs }));
  }, []);

  const handleLocalResolutionDetected = useCallback((res: string) => {
    setLocalMetrics(prev => ({ ...prev, currentResolution: res }));
  }, []);

  const handleRemoteResolutionDetected = useCallback((res: string) => {
    setRemoteMetrics(prev => ({ ...prev, currentResolution: res }));
  }, []);

  const localPlayerTitle = uploadedFile ? `Local Playback: ${uploadedFile.name}` : "Local Server (Low Latency)";
  const remotePlayerTitle = uploadedFile ? `Simulated Remote: ${uploadedFile.name}` : "Remote Server (Simulated High Latency)";
  const currentLqSrc = uploadedFile ? undefined : selectedVideo?.lqSrc;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-8 md:px-8 md:py-10">
      {/* Header */}
      <header className="w-full max-w-6xl mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 border border-blue-200/80 text-blue-700 mb-3.5 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
          <span>Interactive Edge vs Origin Streaming</span>
        </div>
        <div className="flex items-center gap-3.5 mb-2.5">
          <div className="p-2.5 bg-blue-50 border border-blue-200/80 rounded-xl text-primary shadow-sm">
            <BarChart3 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            CDN Video Streaming Simulator
          </h1>
        </div>
        <p className="text-muted-foreground text-sm sm:text-base max-w-2xl leading-relaxed">
          Experience the performance impact of edge caching versus high-latency origin delivery with real-time adaptive quality switching and client telemetry.
        </p>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-6xl space-y-8">
        {/* Video Comparison Area (Always visible above tabs) */}
        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border bg-slate-50/70 px-5 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                  Video Streaming Comparison
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Select a sample video or upload your own to compare playback between a simulated local edge server and a distant origin server.
                </CardDescription>
              </div>
              {/* Phase C2: Network Simulation Active Indication */}
              <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs shadow-xs transition-colors self-start sm:self-auto",
                appliedNetworkConfig.bandwidthMbps === 0
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : "bg-blue-50/80 text-blue-900 border-blue-200/80"
              )}>
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  appliedNetworkConfig.bandwidthMbps === 0 ? "bg-destructive animate-pulse" : "bg-blue-600"
                )} />
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="font-semibold">
                    Network Simulation: {appliedNetworkConfig.name}
                  </span>
                  <span className="text-[11px] opacity-80 font-mono">
                    {appliedNetworkConfig.bandwidthMbps === 0
                      ? "Connection unavailable"
                      : `${appliedNetworkConfig.latencyMs} ms RTT • ${appliedNetworkConfig.bandwidthMbps} Mbps`}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
              <VideoSelector
                videos={sampleVideos}
                selectedVideoId={selectedVideo?.id || null}
                onSelectVideo={handleVideoSelect}
                onSelectLocalFile={handleLocalFileSelect}
                onClearLocalFile={handleClearLocalFile}
                uploadedFileName={uploadedFile?.name || null}
                className="flex-shrink-0 w-full lg:w-auto"
              />
              <ContentSuggestionTool />
            </div>

            {(selectedVideo || uploadedFile) && localVideoSrc && remoteVideoSrc ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <VideoPlayer
                  key={`local-${selectedVideo?.id || uploadedFile?.name || 'player'}-${localVideoSrc}`}
                  videoId="local"
                  videoSrc={localVideoSrc}
                  lqVideoSrc={currentLqSrc}
                  title={localPlayerTitle}
                  isRemote={false}
                  resetToken={metricsResetToken}
                  networkConfig={appliedNetworkConfig}
                  onSlowBuffering={handleLocalSlowBuffering}
                  onPlaybackStateChange={handleLocalPlaybackStateChange}
                  onStartupMeasured={handleLocalStartupMeasured}
                  onStallStart={handleLocalStallStart}
                  onStallEnd={handleLocalStallEnd}
                  onCurrentStallDurationUpdate={handleLocalStallDurationUpdate}
                  onResolutionDetected={handleLocalResolutionDetected}
                  onTimelineEvent={addTimelineEvent}
                  className="border-emerald-200/90 shadow-sm hover:border-emerald-300"
                />
                <VideoPlayer
                  key={`remote-${selectedVideo?.id || uploadedFile?.name || 'player'}-${remoteVideoSrc}`}
                  videoId="remote"
                  videoSrc={remoteVideoSrc}
                  lqVideoSrc={currentLqSrc}
                  title={remotePlayerTitle}
                  isRemote={true}
                  resetToken={metricsResetToken}
                  networkConfig={appliedNetworkConfig}
                  onSlowBuffering={handleRemoteSlowBuffering}
                  onPlaybackStateChange={handleRemotePlaybackStateChange}
                  onStartupMeasured={handleRemoteStartupMeasured}
                  onStallStart={handleRemoteStallStart}
                  onStallEnd={handleRemoteStallEnd}
                  onCurrentStallDurationUpdate={handleRemoteStallDurationUpdate}
                  onResolutionDetected={handleRemoteResolutionDetected}
                  onTimelineEvent={addTimelineEvent}
                  className="border-blue-200/90 shadow-sm hover:border-blue-300"
                />
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <p>Please select a sample video or upload a local file to start the simulation.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compact Workspace Tabs (Beneath video players) */}
        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border bg-slate-50/70 px-5 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                  Simulation Workspace
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Explore performance telemetry, network conditioning controls, and CDN cache behavior.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-xs transition-colors",
                  appliedNetworkConfig.bandwidthMbps === 0
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                )}>
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    appliedNetworkConfig.bandwidthMbps === 0 ? "bg-destructive animate-pulse" : "bg-emerald-500 animate-pulse"
                  )} />
                  <span>
                    Network: <strong className="font-semibold">{appliedNetworkConfig.name}</strong> ({appliedNetworkConfig.bandwidthMbps === 0 ? 'Offline • Connection unavailable' : `${appliedNetworkConfig.latencyMs}ms RTT, ${appliedNetworkConfig.bandwidthMbps} Mbps`})
                  </span>
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            <Tabs defaultValue="performance" className="w-full space-y-6">
              <TabsList className="grid w-full grid-cols-3 max-w-lg bg-slate-100/90 p-1 border border-border rounded-lg h-auto">
                <TabsTrigger
                  value="performance"
                  className="py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <Activity className="h-4 w-4 shrink-0" />
                  <span>Performance</span>
                </TabsTrigger>
                <TabsTrigger
                  value="network"
                  className="py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <Sliders className="h-4 w-4 shrink-0" />
                  <span>Network Controls</span>
                </TabsTrigger>
                <TabsTrigger
                  value="cache"
                  className="py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <HardDrive className="h-4 w-4 shrink-0" />
                  <span>Edge Cache</span>
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Performance Monitoring (Phase B) */}
              <TabsContent value="performance" forceMount className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <PerformancePanel
                  localMetrics={localMetrics}
                  remoteMetrics={remoteMetrics}
                  qualityHistory={qualityHistory}
                  timelineEvents={timelineEvents}
                  onClearMetrics={handleClearMonitoringData}
                />
              </TabsContent>

              {/* Tab 2: Network Controls (Phase C1) */}
              <TabsContent value="network" forceMount className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <NetworkControls
                  appliedConfig={appliedNetworkConfig}
                  onApplyConfig={handleApplyNetworkConfig}
                  onResetConfig={handleResetNetworkConfig}
                />
              </TabsContent>

              {/* Tab 3: Edge Cache (Phase D) */}
              <TabsContent value="cache" forceMount className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <EdgeCachePanel
                  cacheState={cacheState}
                  onPurgeCache={handlePurgeCache}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Separator className="my-8 border-border" />

        {/* How It Works Card */}
        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border bg-slate-50/70 px-5 sm:px-6 py-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-lg font-semibold tracking-tight text-foreground">How it Works</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 space-y-3.5 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Video Selection:</strong> Choose from curated open-license sample videos (hosted on Wikimedia Commons) or upload a local video file from your disk.
            </p>
            <p>
              <strong className="text-foreground">Dual Display:</strong> Two video players are rendered side-by-side.
              The <strong className="text-emerald-700">"{uploadedFile ? `Local: ${uploadedFile.name.substring(0, 20)}...` : 'Local Server'}"</strong> player simulates a fast, nearby server (like a CDN edge node at 0ms latency).
              The <strong className="text-amber-700">"{uploadedFile ? `Remote: ${uploadedFile.name.substring(0, 20)}...` : 'Remote Server'}"</strong> player simulates a distant origin server with artificial startup latency.
            </p>
            <p>
              <strong className="text-foreground">Latency Simulation:</strong> The Remote Server video enforces an artificial delay before playback starts to mimic network RTT transit time.
            </p>
            <p>
              <strong className="text-foreground">Adaptive Bitrate (ABR):</strong> For sample videos, if a player encounters prolonged buffering (&gt;5 seconds), it automatically switches to a lower quality stream to restore continuous playback.
            </p>
            <p>
              <strong className="text-foreground">Content Caching Advisor:</strong> Use the "Get Content Suggestions" tool to submit content concepts and receive AI-guided caching recommendations optimized for CDN distribution.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mt-12 py-6 text-center text-muted-foreground text-xs border-t border-border">
        <p>&copy; {new Date().getFullYear()} CDN Video Streaming Simulator. Built with Next.js, Tailwind CSS, and Genkit.</p>
      </footer>
    </div>
  );
}
