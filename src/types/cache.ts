export type CacheStatus = 'HIT' | 'MISS' | null;

export interface CachedItem {
  id: string;
  title: string;
  cachedAt: string;
  hitCount: number;
}

export interface EdgeCacheState {
  cachedItems: Record<string, CachedItem>;
  hits: number;
  misses: number;
  lastStatus: CacheStatus;
  lastItemTitle: string | null;
}

export const INITIAL_EDGE_CACHE_STATE: EdgeCacheState = {
  cachedItems: {},
  hits: 0,
  misses: 0,
  lastStatus: null,
  lastItemTitle: null,
};
