"use client";

import React from 'react';
import type { EdgeCacheState } from '@/types/cache';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Trash2,
  BarChart2,
  Layers,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EdgeCachePanelProps {
  cacheState: EdgeCacheState;
  onPurgeCache: () => void;
  className?: string;
}

export function EdgeCachePanel({
  cacheState,
  onPurgeCache,
  className,
}: EdgeCachePanelProps) {
  const cachedItemsList = Object.values(cacheState.cachedItems);
  const totalRequests = cacheState.hits + cacheState.misses;
  const hitRatio = totalRequests > 0
    ? ((cacheState.hits / totalRequests) * 100).toFixed(1)
    : '0.0';

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header and Purge Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
              Edge Cache Management & Telemetry
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Demonstrates in-memory client-side CDN edge caching, hit/miss detection, and origin offloading.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPurgeCache}
          disabled={cachedItemsList.length === 0 && totalRequests === 0}
          className="h-8 px-3 text-xs font-medium border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors self-start sm:self-auto"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          Purge Edge Cache
        </Button>
      </div>

      {/* Current Cache Status Banner */}
      {cacheState.lastStatus === 'HIT' && (
        <div className="p-3.5 rounded-xl border border-emerald-200/90 bg-emerald-50/50 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Current Status: Cache HIT
              </span>
              <p className="text-xs text-emerald-800 mt-0.5">
                <strong>"{cacheState.lastItemTitle}"</strong> was served directly from the local Edge Node cache.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-xs shrink-0">
            Fast Response
          </Badge>
        </div>
      )}

      {cacheState.lastStatus === 'MISS' && (
        <div className="p-3.5 rounded-xl border border-amber-200/90 bg-amber-50/50 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Current Status: Cache MISS
              </span>
              <p className="text-xs text-amber-800 mt-0.5">
                <strong>"{cacheState.lastItemTitle}"</strong> was not cached. Fetched through Origin Server and stored in Edge Cache.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-xs shrink-0">
            Origin Fetch
          </Badge>
        </div>
      )}

      {cacheState.lastStatus === null && (
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center gap-2.5 text-xs text-muted-foreground shadow-xs">
          <Zap className="h-4 w-4 text-slate-400" />
          <span>Cache is idle. Select a sample video above to demonstrate Cache MISS and Cache HIT behavior.</span>
        </div>
      )}

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Cache Hits */}
        <Card className="border border-border bg-white shadow-xs rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Cache Hits
            </span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">
            {cacheState.hits}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Requests served from Edge
          </p>
        </Card>

        {/* 2. Cache Misses */}
        <Card className="border border-border bg-white shadow-xs rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Cache Misses
            </span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">
            {cacheState.misses}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Requests fetched from Origin
          </p>
        </Card>

        {/* 3. Hit Ratio */}
        <Card className="border border-border bg-white shadow-xs rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Hit Ratio
            </span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <BarChart2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-2">
            {hitRatio}%
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {cacheState.hits} of {totalRequests} total requests
          </p>
        </Card>

        {/* 4. Cached Items */}
        <Card className="border border-border bg-white shadow-xs rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Cached Items
            </span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-700 mt-2">
            {cachedItemsList.length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Videos currently in Edge storage
          </p>
        </Card>
      </div>

      {/* Cached Video List */}
      <Card className="border border-border bg-white shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="p-4 border-b border-border bg-slate-50/70 flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">
              Edge Cache Storage Contents
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Live in-memory items stored at the local edge node.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-mono bg-white text-muted-foreground border-border">
            {cachedItemsList.length} {cachedItemsList.length === 1 ? 'item' : 'items'}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {cachedItemsList.length > 0 ? (
            <div className="divide-y divide-border">
              {cachedItemsList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                      <HardDrive className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {item.title}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-mono">ID: {item.id}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Cached at {item.cachedAt}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-medium">
                      Hits: {item.hitCount}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      Cached
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 px-4 text-muted-foreground">
              <HardDrive className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Edge Cache is Empty</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                No videos are currently cached. Select a sample video above to trigger the first request and observe a Cache MISS followed by cache storage.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
