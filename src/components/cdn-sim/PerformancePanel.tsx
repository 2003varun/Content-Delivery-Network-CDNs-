"use client";

import React from 'react';
import type { PlayerMetrics, QualitySwitchEntry, TimelineEvent } from '@/types/video';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  RotateCcw,
  Clock,
  Zap,
  AlertTriangle,
  Play,
  Pause,
  Layers,
  ArrowRight,
  Server,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PerformancePanelProps {
  localMetrics: PlayerMetrics;
  remoteMetrics: PlayerMetrics;
  qualityHistory: QualitySwitchEntry[];
  timelineEvents: TimelineEvent[];
  onClearMetrics: () => void;
  className?: string;
}

export function PerformancePanel({
  localMetrics,
  remoteMetrics,
  qualityHistory,
  timelineEvents,
  onClearMetrics,
  className,
}: PerformancePanelProps) {
  const getPlaybackStateBadge = (state: PlayerMetrics['playbackState']) => {
    switch (state) {
      case 'playing':
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-medium text-xs px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
            Playing
          </Badge>
        );
      case 'buffering':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 font-medium text-xs px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-ping mr-1.5" />
            Buffering
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-medium text-xs px-2 py-0.5">
            <Pause className="h-3 w-3 mr-1 text-slate-500" />
            Paused
          </Badge>
        );
      case 'loading':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium text-xs px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse mr-1.5" />
            Loading
          </Badge>
        );
      case 'ended':
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 font-medium text-xs px-2 py-0.5">
            <CheckCircle2 className="h-3 w-3 mr-1 text-slate-500" />
            Ended
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="font-medium text-xs px-2 py-0.5">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 font-medium text-xs px-2 py-0.5">
            Idle
          </Badge>
        );
    }
  };

  const getTimelineTypeIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'startup':
        return <Zap className="h-3.5 w-3.5 text-blue-600 shrink-0" />;
      case 'buffering_start':
        return <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />;
      case 'buffering_end':
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
      case 'play':
        return <Play className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
      case 'pause':
        return <Pause className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
      case 'quality':
        return <Layers className="h-3.5 w-3.5 text-amber-600 shrink-0" />;
      case 'source':
        return <Server className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
      case 'ended':
        return <CheckCircle2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
      default:
        return <Radio className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
    }
  };

  const getPlayerBadge = (player: TimelineEvent['player']) => {
    if (player === 'local') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          Edge
        </span>
      );
    }
    if (player === 'remote') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          Origin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        System
      </span>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
              Streaming Performance & Live Telemetry
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Comparing empirical client playback metrics between the local edge node and the simulated origin server.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearMetrics}
          className="h-8 px-3 text-xs font-medium border-border bg-white text-foreground hover:bg-slate-50 hover:text-primary transition-all self-start sm:self-auto shadow-sm"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          Clear Monitoring Data
        </Button>
      </div>

      {/* Dual Player Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Local Edge Telemetry */}
        <Card className="border border-emerald-200 bg-white shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="p-4 border-b border-emerald-100 bg-emerald-50/40 flex flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-sm sm:text-base font-semibold text-emerald-950 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Local Server (Edge Node)
              </CardTitle>
              <CardDescription className="text-xs text-emerald-800/80 mt-0.5">
                Simulated 0ms round-trip edge server delivery
              </CardDescription>
            </div>
            {getPlaybackStateBadge(localMetrics.playbackState)}
          </CardHeader>
          <CardContent className="p-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50/70 border border-border rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" />
                  Startup Time (TTFF)
                </div>
                <div className="text-base sm:text-lg font-bold text-foreground mt-1">
                  {localMetrics.measuredStartupTimeMs !== null ? (
                    <span className="text-primary">{localMetrics.measuredStartupTimeMs.toLocaleString()} ms</span>
                  ) : (
                    <span className="text-muted-foreground font-normal text-xs italic">Pending playback</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Simulated delay: {localMetrics.simulatedDelayMs} ms
                </div>
              </div>

              <div className="bg-slate-50/70 border border-border rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Layers className="h-3 w-3 text-primary" />
                  Resolution
                </div>
                <div className="text-sm sm:text-base font-semibold text-foreground mt-1 truncate">
                  {localMetrics.currentResolution || "Detecting..."}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Native video dimensions
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="bg-slate-50/70 border border-border rounded-lg p-2 text-center">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stalls</div>
                <div className="text-base font-bold text-foreground mt-0.5">{localMetrics.stallCount}</div>
              </div>
              <div className="bg-slate-50/70 border border-border rounded-lg p-2 text-center">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Stall</div>
                <div className="text-base font-bold text-foreground mt-0.5">{localMetrics.totalStallDurationMs} ms</div>
              </div>
              <div className="bg-slate-50/70 border border-border rounded-lg p-2 text-center">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {localMetrics.playbackState === 'buffering' ? 'Active Stall' : 'Last Stall'}
                </div>
                <div className={cn(
                  "text-base font-bold mt-0.5",
                  localMetrics.playbackState === 'buffering' ? "text-destructive animate-pulse" : "text-foreground"
                )}>
                  {localMetrics.playbackState === 'buffering'
                    ? `${localMetrics.currentStallDurationMs} ms`
                    : localMetrics.lastStallDurationMs !== null
                      ? `${localMetrics.lastStallDurationMs} ms`
                      : '—'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remote Origin Telemetry */}
        <Card className="border border-blue-200 bg-white shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="p-4 border-b border-blue-100 bg-blue-50/40 flex flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-sm sm:text-base font-semibold text-blue-950 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Remote Server (Origin Server)
              </CardTitle>
              <CardDescription className="text-xs text-blue-800/80 mt-0.5">
                Simulated +2,000ms high-latency origin server transit
              </CardDescription>
            </div>
            {getPlaybackStateBadge(remoteMetrics.playbackState)}
          </CardHeader>
          <CardContent className="p-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50/70 border border-border rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" />
                  Startup Time (TTFF)
                </div>
                <div className="text-base sm:text-lg font-bold text-foreground mt-1">
                  {remoteMetrics.measuredStartupTimeMs !== null ? (
                    <span className="text-amber-600">{remoteMetrics.measuredStartupTimeMs.toLocaleString()} ms</span>
                  ) : (
                    <span className="text-muted-foreground font-normal text-xs italic">Pending playback</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Simulated delay: +{remoteMetrics.simulatedDelayMs} ms
                </div>
              </div>

              <div className="bg-slate-50/70 border border-border rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Layers className="h-3 w-3 text-primary" />
                  Resolution
                </div>
                <div className="text-sm sm:text-base font-semibold text-foreground mt-1 truncate">
                  {remoteMetrics.currentResolution || "Detecting..."}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Native video dimensions
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="bg-slate-50/70 border border-border rounded-lg p-2 text-center">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stalls</div>
                <div className="text-base font-bold text-foreground mt-0.5">{remoteMetrics.stallCount}</div>
              </div>
              <div className="bg-slate-50/70 border border-border rounded-lg p-2 text-center">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Stall</div>
                <div className="text-base font-bold text-foreground mt-0.5">{remoteMetrics.totalStallDurationMs} ms</div>
              </div>
              <div className="bg-slate-50/70 border border-border rounded-lg p-2 text-center">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {remoteMetrics.playbackState === 'buffering' ? 'Active Stall' : 'Last Stall'}
                </div>
                <div className={cn(
                  "text-base font-bold mt-0.5",
                  remoteMetrics.playbackState === 'buffering' ? "text-destructive animate-pulse" : "text-foreground"
                )}>
                  {remoteMetrics.playbackState === 'buffering'
                    ? `${remoteMetrics.currentStallDurationMs} ms`
                    : remoteMetrics.lastStallDurationMs !== null
                      ? `${remoteMetrics.lastStallDurationMs} ms`
                      : '—'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality-Switch History */}
      <Card className="border border-border bg-white shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="p-4 border-b border-border bg-slate-50/70 flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Adaptive Quality Transitions (ABR History)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Logged events when persistent buffering (&gt;5s) triggers stream downgrades
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-medium">
            {qualityHistory.length} {qualityHistory.length === 1 ? 'event' : 'events'}
          </Badge>
        </CardHeader>
        <CardContent className="p-4">
          {qualityHistory.length > 0 ? (
            <div className="space-y-2">
              {qualityHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border border-border bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground text-[11px]">{item.timestamp}</span>
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-semibold px-1.5 py-0",
                      item.playerId === 'local' ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
                    )}>
                      {item.playerTitle}
                    </Badge>
                    <div className="flex items-center gap-1 font-medium text-foreground">
                      <span className="text-slate-600 line-through">{item.previousQuality}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-primary font-bold">{item.newQuality}</span>
                    </div>
                  </div>
                  <div className="text-muted-foreground italic text-[11px]">
                    {item.reason}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-xs">
              <p>No adaptive quality switches have occurred in this session.</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1">
                Quality will automatically downgrade if high-quality streams stall continuously for more than 5 seconds.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timestamped Event Timeline */}
      <Card className="border border-border bg-white shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="p-4 border-b border-border bg-slate-50/70 flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Session Event Timeline (Latest 100 Events)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Chronological log of media events, decode milestones, and buffering transitions
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {timelineEvents.length} recorded
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {timelineEvents.length > 0 ? (
            <ScrollArea className="h-[280px] w-full px-4 py-2">
              <div className="space-y-1.5 divide-y divide-border/40">
                {timelineEvents.map((event) => (
                  <div
                    key={event.id}
                    className="pt-2 first:pt-1 pb-1.5 flex items-start gap-2.5 text-xs hover:bg-slate-50/80 px-2 rounded-md transition-colors"
                  >
                    <span className="font-mono text-muted-foreground text-[11px] shrink-0 mt-0.5">
                      [{event.formattedTime}]
                    </span>
                    <div className="shrink-0 mt-0.5">{getPlayerBadge(event.player)}</div>
                    <div className="shrink-0 mt-1">{getTimelineTypeIcon(event.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground tracking-tight">{event.message}</p>
                      {event.details && (
                        <p className="text-[11px] text-muted-foreground truncate">{event.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-xs">
              <Activity className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-medium text-foreground">No monitoring events recorded yet</p>
              <p className="text-[11px] mt-0.5">
                Events will appear here in real-time as video sources activate, play, pause, or buffer.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
