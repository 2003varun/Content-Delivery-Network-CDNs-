"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  Layers,
  Network,
  Pause,
  Play,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ProxyStatsResponse, ProxyStats } from '@/app/api/proxy-stats/route';

interface TrafficSnapshot {
  time: string;
  hits: number;
  misses: number;
  bypasses: number;
  total: number;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(ms: number): string {
  if (!ms || ms === 0) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  return remS > 0 ? `${m}m ${remS}s` : `${m}m`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<ProxyStats | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [history, setHistory] = useState<TrafficSnapshot[]>([]);

  const isMountedRef = useRef<boolean>(true);
  const inFlightRef = useRef<boolean>(false);

  const fetchStats = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsFetching(true);

    try {
      const res = await fetch('/api/proxy-stats', { cache: 'no-store' });
      const data: ProxyStatsResponse = await res.json();

      if (!isMountedRef.current) return;

      if (data.connected && data.stats) {
        setConnected(true);
        setErrorMessage(null);
        setStats(data.stats);
        setLastRefreshedAt(new Date(data.timestamp));
        setSecondsAgo(0);

        // Record rolling timeline point for the session activity chart
        const nowStr = new Date(data.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        setHistory((prev) => {
          const newPoint: TrafficSnapshot = {
            time: nowStr,
            hits: data.stats!.hits,
            misses: data.stats!.misses,
            bypasses: data.stats!.bypasses,
            total: data.stats!.hits + data.stats!.misses + data.stats!.bypasses,
          };
          const updated = [...prev, newPoint];
          // Keep up to 20 rolling points
          return updated.slice(-20);
        });
      } else {
        setConnected(false);
        setErrorMessage(data.error || 'Reverse proxy is offline');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setConnected(false);
      setErrorMessage(err?.message || 'Failed to fetch proxy telemetry');
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) {
        setIsFetching(false);
      }
    }
  }, []);

  // Initial fetch and unmount cleanup
  useEffect(() => {
    isMountedRef.current = true;
    fetchStats();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchStats]);

  // Polling interval (every 3 seconds when autoRefresh is enabled)
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      fetchStats();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, fetchStats]);

  // Second ticker for "Updated Xs ago"
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastRefreshedAt) {
        const diff = Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000);
        setSecondsAgo(Math.max(0, diff));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastRefreshedAt]);

  // Metric calculations
  const totalRequests = (stats?.hits || 0) + (stats?.misses || 0) + (stats?.bypasses || 0);
  const cacheableRequests = (stats?.hits || 0) + (stats?.misses || 0);

  const hitRatio =
    cacheableRequests > 0
      ? (((stats?.hits || 0) / cacheableRequests) * 100).toFixed(1)
      : null;

  const memoryUtilisation =
    stats && stats.limits.maxCacheBytes > 0
      ? ((stats.cachedBytes / stats.limits.maxCacheBytes) * 100).toFixed(1)
      : '0.0';

  const entryUtilisation =
    stats && stats.limits.maxEntries > 0
      ? ((stats.entries / stats.limits.maxEntries) * 100).toFixed(0)
      : '0';

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Header / Navigation */}
      <header className="border-b border-slate-800/80 bg-[#0B0F19]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/10">
              <Network className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  CDN Edge Telemetry
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Phase 4 Live
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Reverse Proxy &amp; In-Memory LRU Cache Monitoring
              </p>
            </div>
          </div>

          {/* Controls & Navigation */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Connection Status Pill */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                connected === true
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                  : connected === false
                  ? 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connected === true
                    ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400'
                    : connected === false
                    ? 'bg-rose-400'
                    : 'bg-amber-400'
                }`}
              />
              <span className="hidden sm:inline">
                {connected === true
                  ? 'Connected'
                  : connected === false
                  ? 'Offline'
                  : 'Connecting'}
              </span>
            </div>

            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-1.5 rounded-lg border text-xs font-medium flex items-center space-x-1 transition-all ${
                autoRefresh
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title={autoRefresh ? 'Pause 3s polling' : 'Resume 3s polling'}
            >
              {autoRefresh ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] hidden md:inline">3s Poll</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] hidden md:inline">Paused</span>
                </>
              )}
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchStats()}
              disabled={isFetching}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center space-x-1 transition-all disabled:opacity-50"
              title="Refresh statistics now"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-300 ${isFetching ? 'animate-spin' : ''}`}
              />
              <span className="hidden md:inline">Refresh</span>
            </button>

            {/* Link back to simulator */}
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center space-x-1 transition-all shadow-sm shadow-cyan-950/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Simulator</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Offline Warning Banner */}
        {connected === false && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 flex items-start space-x-3 text-rose-200">
            <WifiOff className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-rose-300">
                Reverse Proxy Offline
              </div>
              <p className="text-xs text-rose-300/80 mt-0.5">
                {errorMessage || 'Cannot connect to 127.0.0.1:8080'}. Ensure the reverse proxy
                is running in your terminal via{' '}
                <code className="bg-rose-950/60 px-1 py-0.5 rounded text-rose-200 font-mono">
                  npm run proxy
                </code>
                . The dashboard will automatically reconnect once available.
              </p>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-3 gap-2">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>Proxy Origin:</span>
              <span className="text-slate-200 font-mono">http://127.0.0.1:8080</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-slate-500" />
              <span>Upstream:</span>
              <span className="text-slate-200 font-mono">http://127.0.0.1:9002</span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {lastRefreshedAt ? (
                <>
                  Refreshed {secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`}{' '}
                  <span className="text-slate-600">
                    ({lastRefreshedAt.toLocaleTimeString()})
                  </span>
                </>
              ) : (
                'Waiting for initial telemetry...'
              )}
            </span>
          </div>
        </div>

        {/* Top 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Hit Ratio */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0F172A]/70 backdrop-blur-md p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">
                Cache Hit Ratio
              </span>
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Activity className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                {hitRatio !== null ? `${hitRatio}%` : '0.0%'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {cacheableRequests > 0 ? 'of eligible requests' : 'no traffic yet'}
              </span>
            </div>

            {/* Sub-breakdown */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-medium flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Hits: {stats?.hits ?? 0}</span>
              </span>
              <span className="text-amber-400 font-medium flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Misses: {stats?.misses ?? 0}</span>
              </span>
            </div>
          </div>

          {/* KPI 2: Memory Utilisation */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0F172A]/70 backdrop-blur-md p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">
                Memory Capacity
              </span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                {memoryUtilisation}%
              </span>
              <span className="text-xs text-slate-400 font-medium">
                utilised
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                style={{ width: `${Math.min(100, parseFloat(memoryUtilisation))}%` }}
              />
            </div>

            {/* Sub-breakdown */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>{formatBytes(stats?.cachedBytes ?? 0)} stored</span>
              <span>Cap: {formatBytes(stats?.limits.maxCacheBytes ?? 20971520)}</span>
            </div>
          </div>

          {/* KPI 3: Stored Entries & Evictions */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0F172A]/70 backdrop-blur-md p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">
                Active Entries
              </span>
              <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <Database className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                {stats?.entries ?? 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                / {stats?.limits.maxEntries ?? 100} max
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
                style={{ width: `${Math.min(100, parseFloat(entryUtilisation))}%` }}
              />
            </div>

            {/* Sub-breakdown */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="text-slate-300">
                LRU Evictions: {stats?.evictions ?? 0}
              </span>
              <span className="text-cyan-400/80 font-mono">
                {(stats?.limits.maxEntries ?? 100) - (stats?.entries ?? 0)} free
              </span>
            </div>
          </div>

          {/* KPI 4: Total Traffic Volume */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0F172A]/70 backdrop-blur-md p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">
                Total Requests
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Layers className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                {totalRequests}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                processed
              </span>
            </div>

            {/* Sub-breakdown */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="text-violet-400 font-medium">
                Bypassed: {stats?.bypasses ?? 0}
              </span>
              <span>TTL: {formatDuration(stats?.limits.defaultTtlMs ?? 60000)}</span>
            </div>
          </div>
        </div>

        {/* Session Activity Chart & Traffic Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800/80 bg-[#0F172A]/70 backdrop-blur-md p-5 flex flex-col justify-between shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight flex items-center space-x-2">
                  <span>Session Cache Events</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Live Telemetry
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cumulative request progression observed during the current dashboard session.
                </p>
              </div>

              {/* Legend indicator */}
              <div className="flex items-center space-x-3 text-xs">
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-400" />
                  <span className="text-slate-300">Hits</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded bg-amber-400" />
                  <span className="text-slate-300">Misses</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded bg-violet-400" />
                  <span className="text-slate-300">Bypasses</span>
                </div>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-64 w-full">
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={history}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorHits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorMisses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorBypasses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis
                      dataKey="time"
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#F8FAFC',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                      }}
                      itemStyle={{ padding: '0.1rem 0' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="hits"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorHits)"
                      name="Cache Hits"
                    />
                    <Area
                      type="monotone"
                      dataKey="misses"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorMisses)"
                      name="Cache Misses"
                    />
                    <Area
                      type="monotone"
                      dataKey="bypasses"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorBypasses)"
                      name="Bypassed"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Polling live telemetry snapshots...
                </div>
              )}
            </div>
          </div>

          {/* Traffic Distribution Breakdown */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0F172A]/70 backdrop-blur-md p-5 flex flex-col justify-between shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight mb-1">
                Traffic Distribution
              </h2>
              <p className="text-xs text-slate-400 mb-5">
                Relative composition of requests handled by the proxy.
              </p>

              <div className="space-y-4 text-xs">
                {/* Cache Hits Row */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-300 flex items-center space-x-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Cache Hits</span>
                    </span>
                    <span className="font-mono text-emerald-300">
                      {totalRequests > 0
                        ? `${(((stats?.hits || 0) / totalRequests) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all"
                      style={{
                        width: `${
                          totalRequests > 0
                            ? ((stats?.hits || 0) / totalRequests) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Cache Misses Row */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-300 flex items-center space-x-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>Cache Misses (Fetched Upstream)</span>
                    </span>
                    <span className="font-mono text-amber-300">
                      {totalRequests > 0
                        ? `${(((stats?.misses || 0) / totalRequests) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{
                        width: `${
                          totalRequests > 0
                            ? ((stats?.misses || 0) / totalRequests) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Bypasses Row */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-300 flex items-center space-x-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-violet-400" />
                      <span>Cache Bypasses (Auth / Range / no-store)</span>
                    </span>
                    <span className="font-mono text-violet-300">
                      {totalRequests > 0
                        ? `${(((stats?.bypasses || 0) / totalRequests) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-400 transition-all"
                      style={{
                        width: `${
                          totalRequests > 0
                            ? ((stats?.bypasses || 0) / totalRequests) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-center justify-between">
                <span>Maximum Entry Cap:</span>
                <span className="text-slate-200 font-mono">
                  {formatBytes(stats?.limits.maxEntrySizeBytes ?? 2097152)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Default TTL:</span>
                <span className="text-slate-200 font-mono">
                  {formatDuration(stats?.limits.defaultTtlMs ?? 60000)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Engine Architecture & Verification Rules */}
        <div className="rounded-xl border border-slate-800/80 bg-[#0F172A]/70 backdrop-blur-md p-6 shadow-sm">
          <h2 className="text-base font-semibold text-white tracking-tight mb-1 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Proxy &amp; Cache Engine Specifications</span>
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            Active security policies, protocol mechanics, and streaming architecture.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
              <span className="text-slate-400 font-medium">Upstream Destination</span>
              <div className="text-slate-200 font-mono font-medium">http://127.0.0.1:9002</div>
              <p className="text-[11px] text-slate-500">
                Hardcoded origin only; rejects arbitrary upstream forwarding.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
              <span className="text-slate-400 font-medium">Eviction Strategy</span>
              <div className="text-slate-200 font-medium">Least Recently Used (LRU)</div>
              <p className="text-[11px] text-slate-500">
                Maintains entry and byte caps; evicts oldest accessed item upon capacity.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
              <span className="text-slate-400 font-medium">Streaming Mechanics</span>
              <div className="text-slate-200 font-medium">Non-Buffering Stream-Tee</div>
              <p className="text-[11px] text-slate-500">
                Large bodies stream to client with zero added latency; oversized items bypass cache.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
              <span className="text-slate-400 font-medium">Vary Dimensions</span>
              <div className="text-slate-200 font-mono font-medium">Accept-Encoding (gzip, br, deflate)</div>
              <p className="text-[11px] text-slate-500">
                Segregates encoding variants; conservatively bypasses <code className="text-slate-400">Vary: *</code>.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
              <span className="text-slate-400 font-medium">HTTP Range Handling</span>
              <div className="text-slate-200 font-medium">Bypassed &amp; Streamed (206)</div>
              <p className="text-[11px] text-slate-500">
                Never buffers partial video slices into RAM; streams 206 Partial Content directly.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
              <span className="text-slate-400 font-medium">RFC 7234 Directives</span>
              <div className="text-slate-200 font-medium">no-store, private, max-age</div>
              <p className="text-[11px] text-slate-500">
                Respects upstream and client directives; never overrides no-store to force caching.
              </p>
            </div>
          </div>
        </div>

        {/* Live Traffic Generator Tip */}
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <Zap className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-cyan-300">Live Traffic Test Tip:</span>{' '}
              Run curl in PowerShell to observe immediate cache hits, misses, and bypasses live on this dashboard:
              <div className="font-mono bg-black/40 px-2 py-1 rounded text-cyan-200 mt-1 select-all">
                curl.exe -i http://127.0.0.1:8080/_next/static/media/gyByhwUxId8gMEwcGFWNOITd-s.p.d06edde1.woff2
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
