import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface ProxyLimits {
  maxEntries: number;
  maxCacheBytes: number;
  maxEntrySizeBytes: number;
  defaultTtlMs: number;
}

export interface ProxyStats {
  hits: number;
  misses: number;
  bypasses: number;
  evictions: number;
  entries: number;
  cachedBytes: number;
  limits: ProxyLimits;
}

export interface ProxyStatsResponse {
  connected: boolean;
  stats?: ProxyStats;
  error?: string;
  timestamp: number;
}

const PROXY_STATS_URL = 'http://127.0.0.1:8080/__proxy/stats';
const FETCH_TIMEOUT_MS = 2500;

export async function GET(): Promise<NextResponse<ProxyStatsResponse>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(PROXY_STATS_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json(
        {
          connected: false,
          error: `Reverse proxy responded with status ${res.status}`,
          timestamp: Date.now(),
        },
        {
          status: 502,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    const data: ProxyStats = await res.json();
    return NextResponse.json(
      {
        connected: true,
        stats: data,
        timestamp: Date.now(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return NextResponse.json(
      {
        connected: false,
        error: isTimeout
          ? 'Reverse proxy connection timed out on 127.0.0.1:8080'
          : 'Reverse proxy is offline or unreachable on 127.0.0.1:8080',
        timestamp: Date.now(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
