"use client";

import React, { useState, useEffect } from 'react';
import type { NetworkConfig, NetworkPresetId } from '@/types/network';
import { NETWORK_PRESETS, DEFAULT_NETWORK_CONFIG } from '@/types/network';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Sliders,
  Check,
  RotateCcw,
  Wifi,
  WifiOff,
  Signal,
  SignalLow,
  Clock,
  Gauge,
  AlertTriangle,
  Info,
  Undo2,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NetworkControlsProps {
  appliedConfig: NetworkConfig;
  onApplyConfig: (config: NetworkConfig) => void;
  onResetConfig: () => void;
  className?: string;
}

export function NetworkControls({
  appliedConfig,
  onApplyConfig,
  onResetConfig,
  className,
}: NetworkControlsProps) {
  // Local draft state for user manipulation before pressing Apply
  const [draftConfig, setDraftConfig] = useState<NetworkConfig>(appliedConfig);

  // Sync draft whenever appliedConfig changes from an external source or reset
  useEffect(() => {
    setDraftConfig(appliedConfig);
  }, [appliedConfig]);

  // Check if draft differs from currently applied configuration
  const hasUnappliedChanges =
    draftConfig.preset !== appliedConfig.preset ||
    draftConfig.latencyMs !== appliedConfig.latencyMs ||
    draftConfig.bandwidthMbps !== appliedConfig.bandwidthMbps ||
    draftConfig.packetLossPercent !== appliedConfig.packetLossPercent;

  // Determine preset icon based on preset ID
  const getPresetIcon = (presetId: NetworkPresetId) => {
    switch (presetId) {
      case 'fast-4g':
        return <Wifi className="h-5 w-5 text-emerald-600" />;
      case '3g':
        return <Signal className="h-5 w-5 text-blue-600" />;
      case 'slow-3g':
        return <SignalLow className="h-5 w-5 text-amber-600" />;
      case 'offline':
        return <WifiOff className="h-5 w-5 text-destructive" />;
      default:
        return <Sliders className="h-5 w-5 text-purple-600" />;
    }
  };

  // Helper to detect if custom values happen to match a known preset
  const detectPresetOrCustom = (latency: number, bandwidth: number, loss: number): { preset: NetworkPresetId; name: string } => {
    const matched = NETWORK_PRESETS.find(
      p => p.latencyMs === latency && p.bandwidthMbps === bandwidth && p.packetLossPercent === loss
    );
    if (matched) {
      return { preset: matched.id, name: matched.name };
    }
    return { preset: 'custom', name: 'Custom Profile' };
  };

  // Preset click handler
  const handleSelectPreset = (presetId: NetworkPresetId) => {
    const preset = NETWORK_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setDraftConfig({
        preset: preset.id,
        name: preset.name,
        latencyMs: preset.latencyMs,
        bandwidthMbps: preset.bandwidthMbps,
        packetLossPercent: preset.packetLossPercent,
        description: preset.description,
      });
    }
  };

  // Slider change handlers
  const handleLatencyChange = (latencyMs: number) => {
    const { preset, name } = detectPresetOrCustom(latencyMs, draftConfig.bandwidthMbps, draftConfig.packetLossPercent);
    setDraftConfig(prev => ({
      ...prev,
      preset,
      name,
      latencyMs,
    }));
  };

  const handleBandwidthChange = (bandwidthMbps: number) => {
    // Round to 1 decimal place to prevent floating-point inaccuracies
    const rounded = Math.round(bandwidthMbps * 10) / 10;
    const { preset, name } = detectPresetOrCustom(draftConfig.latencyMs, rounded, draftConfig.packetLossPercent);
    setDraftConfig(prev => ({
      ...prev,
      preset,
      name,
      bandwidthMbps: rounded,
    }));
  };

  const handlePacketLossChange = (packetLossPercent: number) => {
    const { preset, name } = detectPresetOrCustom(draftConfig.latencyMs, draftConfig.bandwidthMbps, packetLossPercent);
    setDraftConfig(prev => ({
      ...prev,
      preset,
      name,
      packetLossPercent,
    }));
  };

  const handleApply = () => {
    onApplyConfig(draftConfig);
  };

  const handleDiscard = () => {
    setDraftConfig(appliedConfig);
  };

  const formatBandwidth = (mbps: number) => {
    if (mbps === 0) return '0 Mbps (Offline)';
    if (mbps < 1) return `${Math.round(mbps * 1000)} Kbps (${mbps.toFixed(1)} Mbps)`;
    return `${mbps.toFixed(1)} Mbps`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Top Section: Active Status Banner vs Draft State */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Currently Applied Configuration Banner */}
        <Card className="border border-emerald-200/90 bg-emerald-50/30 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="p-4 border-b border-emerald-100 bg-emerald-50/60 flex flex-row items-center justify-between gap-2 space-y-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <CardTitle className="text-sm font-semibold text-emerald-950">
                Currently Applied Network
              </CardTitle>
            </div>
            <Badge variant="outline" className="bg-emerald-100/80 text-emerald-800 border-emerald-300 font-medium text-xs px-2 py-0.5">
              Active in Simulation
            </Badge>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white rounded-lg border border-emerald-200/80 shadow-xs">
                  {getPresetIcon(appliedConfig.preset)}
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">{appliedConfig.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {appliedConfig.appliedAt ? `Applied at ${appliedConfig.appliedAt}` : 'Default startup configuration'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-white border border-emerald-100 rounded-lg p-2 shadow-xs">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Latency (RTT)</div>
                <div className="text-xs sm:text-sm font-bold text-foreground mt-0.5">{appliedConfig.latencyMs} ms</div>
              </div>
              <div className="bg-white border border-emerald-100 rounded-lg p-2 shadow-xs">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bandwidth</div>
                <div className="text-xs sm:text-sm font-bold text-foreground mt-0.5">
                  {appliedConfig.bandwidthMbps === 0 ? '0 Mbps' : `${appliedConfig.bandwidthMbps} Mbps`}
                </div>
              </div>
              <div className="bg-white border border-emerald-100 rounded-lg p-2 shadow-xs">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Packet Loss</div>
                <div className="text-xs sm:text-sm font-bold text-foreground mt-0.5">{appliedConfig.packetLossPercent}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Draft Settings Status & Actions Card */}
        <Card className={cn(
          "border shadow-sm rounded-xl overflow-hidden transition-all",
          hasUnappliedChanges
            ? "border-amber-300 bg-amber-50/30"
            : "border-border bg-white"
        )}>
          <CardHeader className={cn(
            "p-4 border-b flex flex-row items-center justify-between gap-2 space-y-0",
            hasUnappliedChanges
              ? "border-amber-200 bg-amber-50/70"
              : "border-border bg-slate-50/70"
          )}>
            <div className="flex items-center gap-2">
              <Sliders className={cn("h-4 w-4", hasUnappliedChanges ? "text-amber-700" : "text-muted-foreground")} />
              <CardTitle className="text-sm font-semibold text-foreground">
                Draft Configuration State
              </CardTitle>
            </div>
            {hasUnappliedChanges ? (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-xs px-2 py-0.5">
                Unapplied Changes
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 font-medium text-xs px-2 py-0.5">
                In Sync
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {hasUnappliedChanges ? (
                  <span className="text-amber-900 font-medium">
                    Draft: <strong className="text-foreground">{draftConfig.name}</strong> ({draftConfig.latencyMs}ms RTT, {formatBandwidth(draftConfig.bandwidthMbps)}, {draftConfig.packetLossPercent}% loss)
                  </span>
                ) : (
                  <span>Sliders reflect the currently applied configuration. Drag controls to prepare new conditions.</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                onClick={handleApply}
                disabled={!hasUnappliedChanges}
                className={cn(
                  "h-8 px-3.5 text-xs font-semibold shadow-sm transition-all",
                  hasUnappliedChanges
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "opacity-60 cursor-not-allowed"
                )}
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Apply Configuration
              </Button>

              {hasUnappliedChanges && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDiscard}
                  className="h-8 px-3 text-xs font-medium border-amber-300 bg-white text-amber-900 hover:bg-amber-50"
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1.5 text-amber-700" />
                  Discard Draft
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={onResetConfig}
                className="h-8 px-3 text-xs font-medium border-border bg-white text-foreground hover:bg-slate-50 ml-auto"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preset Profiles Selector Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground tracking-tight">
              Network Profile Presets
            </h4>
          </div>
          <span className="text-xs text-muted-foreground">Select a preset or customize sliders below</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {NETWORK_PRESETS.map(preset => {
            const isDraftActive = draftConfig.preset === preset.id;
            const isApplied = appliedConfig.preset === preset.id && !hasUnappliedChanges;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={cn(
                  "p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between group",
                  isDraftActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                    : "border-border bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-xs"
                )}
              >
                <div className="flex items-start justify-between gap-2 w-full mb-2">
                  <div className="p-2 rounded-lg bg-slate-50 border border-border group-hover:border-slate-300 transition-colors">
                    {getPresetIcon(preset.id)}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0">
                      {preset.badgeLabel}
                    </Badge>
                    {isApplied && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Applied
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-sm text-foreground">{preset.name}</div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border/70 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{preset.latencyMs}ms RTT</span>
                  <span>{preset.bandwidthMbps === 0 ? '0 Mbps' : `${preset.bandwidthMbps} Mbps`}</span>
                  <span>{preset.packetLossPercent}% loss</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Separator className="border-border" />

      {/* Granular Sliders & Direct Controls */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground tracking-tight">
            Detailed Parameter Conditioning
          </h4>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 1. Latency Control */}
          <Card className="border border-border bg-white shadow-xs rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs sm:text-sm font-semibold text-foreground">Round-Trip Latency</span>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold bg-slate-50 text-foreground border-slate-300">
                {draftConfig.latencyMs} ms
              </Badge>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Injected network round-trip delay mimicking geographical distance between the client and edge/origin server.
            </p>

            <div className="pt-2">
              <Slider
                value={[draftConfig.latencyMs]}
                onValueChange={([val]) => handleLatencyChange(val ?? 0)}
                min={0}
                max={2000}
                step={10}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-mono">
                <span>0 ms (Edge)</span>
                <span>500 ms</span>
                <span>1,000 ms</span>
                <span>2,000 ms (Origin)</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
              {[0, 50, 150, 400, 2000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleLatencyChange(val)}
                  className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded border transition-colors",
                    draftConfig.latencyMs === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-slate-50 text-slate-700 border-border hover:bg-slate-100"
                  )}
                >
                  {val === 0 ? '0ms (Edge)' : val === 2000 ? '2s (Origin)' : `${val}ms`}
                </button>
              ))}
            </div>
          </Card>

          {/* 2. Bandwidth Control */}
          <Card className="border border-border bg-white shadow-xs rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <span className="text-xs sm:text-sm font-semibold text-foreground">Downstream Bandwidth</span>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold bg-slate-50 text-foreground border-slate-300">
                {formatBandwidth(draftConfig.bandwidthMbps)}
              </Badge>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Maximum download throughput available to the HTML5 video pipeline before media buffer exhaustion occurs.
            </p>

            <div className="pt-2">
              <Slider
                value={[draftConfig.bandwidthMbps]}
                onValueChange={([val]) => handleBandwidthChange(val ?? 0)}
                min={0}
                max={50}
                step={0.1}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-mono">
                <span>0 Mbps (Offline)</span>
                <span>10 Mbps</span>
                <span>25 Mbps</span>
                <span>50 Mbps</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
              {[
                { label: 'Offline', val: 0 },
                { label: '400k (Slow)', val: 0.4 },
                { label: '1.6M (3G)', val: 1.6 },
                { label: '10M (4G)', val: 10 },
                { label: '25M (Fast)', val: 25 },
              ].map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleBandwidthChange(item.val)}
                  className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded border transition-colors",
                    draftConfig.bandwidthMbps === item.val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-slate-50 text-slate-700 border-border hover:bg-slate-100"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Card>

          {/* 3. Packet Loss Control */}
          <Card className="border border-border bg-white shadow-xs rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <span className="text-xs sm:text-sm font-semibold text-foreground">Packet Loss Rate</span>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold bg-slate-50 text-foreground border-slate-300">
                {draftConfig.packetLossPercent}%
              </Badge>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Simulated transport layer packet drop probability leading to stream retransmissions and jitter.
            </p>

            <div className="pt-2">
              <Slider
                value={[draftConfig.packetLossPercent]}
                onValueChange={([val]) => handlePacketLossChange(val ?? 0)}
                min={0}
                max={100}
                step={1}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-mono">
                <span>0% (Clean)</span>
                <span>25%</span>
                <span>50%</span>
                <span>100% (Offline)</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
              {[0, 2, 5, 10, 100].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handlePacketLossChange(val)}
                  className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded border transition-colors",
                    draftConfig.packetLossPercent === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-slate-50 text-slate-700 border-border hover:bg-slate-100"
                  )}
                >
                  {val === 0 ? '0% (Clean)' : val === 100 ? '100% (Drop All)' : `${val}%`}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Phase C Roadmap Notice */}
      <div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/50 flex items-start gap-3 text-xs leading-relaxed text-blue-900 shadow-xs">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-blue-950">Phase C1 Simulation State Active</div>
          <p className="mt-0.5 text-blue-800">
            Network profiles configured here establish the active simulation state layer. In Phase C2, this state will directly throttle the progressive video stream buffer pipeline, injecting artificial startup RTT and deterministically triggering the 5-second ABR quality downgrade.
          </p>
        </div>
      </div>
    </div>
  );
}
