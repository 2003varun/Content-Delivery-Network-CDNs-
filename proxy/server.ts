import http from 'node:http';
import type * as httpTypes from 'node:http';
import { URL } from 'node:url';

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 8080;
const UPSTREAM_HOST = '127.0.0.1';
const UPSTREAM_PORT = 9002;
const UPSTREAM_TIMEOUT_MS = 30000;

// Configurable Cache Limits (defaults can be overridden via environment variables)
const DEFAULT_MAX_CACHE_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES || '100', 10);
const DEFAULT_MAX_CACHE_BYTES = parseInt(process.env.CACHE_MAX_BYTES || String(20 * 1024 * 1024), 10); // 20 MB
const DEFAULT_MAX_ENTRY_SIZE_BYTES = parseInt(process.env.CACHE_MAX_ENTRY_SIZE || String(2 * 1024 * 1024), 10); // 2 MB
const DEFAULT_TTL_MS = parseInt(process.env.CACHE_DEFAULT_TTL_MS || String(60 * 1000), 10); // 60 seconds

/**
 * Hop-by-hop headers defined in RFC 7230 / RFC 9110 that should not be forwarded
 * by an HTTP/1.1 proxy or stored in cache.
 */
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

/**
 * Remove hop-by-hop headers and any headers named in the Connection header.
 */
function filterHopByHopHeaders(
  headers: httpTypes.IncomingHttpHeaders,
  additionalHops: ReadonlySet<string> = new Set()
): httpTypes.OutgoingHttpHeaders {
  const dynamicHops = new Set<string>(additionalHops);

  const conn = headers['connection'];
  if (conn) {
    const rawTokens = Array.isArray(conn) ? conn.join(',') : conn;
    for (const token of rawTokens.split(',')) {
      const trimmed = token.trim().toLowerCase();
      if (trimmed) {
        dynamicHops.add(trimmed);
      }
    }
  }

  const cleaned: httpTypes.OutgoingHttpHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerKey) || dynamicHops.has(lowerKey)) {
      continue;
    }
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export interface CacheControlDirectives {
  noStore: boolean;
  noCache: boolean;
  isPrivate: boolean;
  maxAge?: number;
  sMaxAge?: number;
}

/**
 * Parse Cache-Control header into directives.
 */
export function parseCacheControl(headerValue?: string | string[]): CacheControlDirectives {
  const directives: CacheControlDirectives = {
    noStore: false,
    noCache: false,
    isPrivate: false,
  };
  if (!headerValue) return directives;

  const raw = Array.isArray(headerValue) ? headerValue.join(',') : headerValue;
  const parts = raw.split(',').map((p) => p.trim().toLowerCase());

  for (const part of parts) {
    if (part === 'no-store') directives.noStore = true;
    else if (part === 'no-cache') directives.noCache = true;
    else if (part === 'private') directives.isPrivate = true;
    else if (part.startsWith('max-age=')) {
      const val = parseInt(part.slice(8), 10);
      if (!isNaN(val)) directives.maxAge = val;
    } else if (part.startsWith('s-maxage=')) {
      const val = parseInt(part.slice(9), 10);
      if (!isNaN(val)) directives.sMaxAge = val;
    }
  }

  return directives;
}

/**
 * Calculate TTL in milliseconds from upstream Cache-Control directives.
 */
export function calculateTtlMs(headerValue: string | string[] | undefined, defaultTtlMs: number): number {
  const cc = parseCacheControl(headerValue);
  if (cc.sMaxAge !== undefined) {
    return cc.sMaxAge * 1000;
  }
  if (cc.maxAge !== undefined) {
    return cc.maxAge * 1000;
  }
  return defaultTtlMs;
}

/**
 * Generate a cache key distinguishing HTTP method, path, query string, and supported Vary (Accept-Encoding).
 */
export function getCacheKey(targetPath: string, acceptEncoding?: string | string[]): string {
  let encoding = 'identity';
  if (acceptEncoding) {
    const raw = (Array.isArray(acceptEncoding) ? acceptEncoding.join(',') : acceptEncoding).toLowerCase();
    if (raw.includes('gzip')) encoding = 'gzip';
    else if (raw.includes('br')) encoding = 'br';
    else if (raw.includes('deflate')) encoding = 'deflate';
  }
  return `GET:${targetPath}:${encoding}`;
}

/**
 * Check whether a client request is eligible for caching.
 */
export function isRequestCacheable(req: httpTypes.IncomingMessage): boolean {
  if (req.method !== 'GET') {
    return false;
  }
  // Sensitive/dynamic headers bypass cache
  if (req.headers['authorization'] || req.headers['cookie']) {
    return false;
  }
  // Range requests must bypass cache
  if (req.headers['range']) {
    return false;
  }
  // Client Cache-Control bypass directives
  const cc = parseCacheControl(req.headers['cache-control']);
  if (cc.noStore || cc.noCache) {
    return false;
  }
  const pragma = req.headers['pragma'];
  if (pragma && String(pragma).toLowerCase().includes('no-cache')) {
    return false;
  }
  return true;
}

/**
 * Check whether an upstream response is eligible to be stored in cache.
 */
export function isResponseCacheable(
  upstreamRes: httpTypes.IncomingMessage,
  maxEntrySizeBytes: number
): boolean {
  // Only 200 OK responses are cacheable
  if (upstreamRes.statusCode !== 200) {
    return false;
  }

  // Do not cache Set-Cookie responses
  if (upstreamRes.headers['set-cookie']) {
    return false;
  }

  // Do not cache partial responses
  if (upstreamRes.headers['content-range']) {
    return false;
  }

  // Upstream Cache-Control directives
  const cc = parseCacheControl(upstreamRes.headers['cache-control']);
  if (cc.noStore || cc.isPrivate || cc.noCache) {
    return false;
  }
  if (
    (cc.sMaxAge !== undefined && cc.sMaxAge <= 0) ||
    (cc.maxAge !== undefined && cc.maxAge <= 0)
  ) {
    return false;
  }

  // Vary header checks
  const vary = upstreamRes.headers['vary'];
  if (vary) {
    const rawVary = (Array.isArray(vary) ? vary.join(',') : vary).toLowerCase();
    const tokens = rawVary.split(',').map((t) => t.trim());
    if (tokens.includes('*')) {
      return false; // Be conservative with Vary: *
    }
    // Only allow supported Vary dimensions (Accept-Encoding)
    for (const token of tokens) {
      if (token && token !== 'accept-encoding') {
        return false; // Bypass caching if safe variation cannot be guaranteed
      }
    }
  }

  // Content-Length check if available upfront
  const cl = upstreamRes.headers['content-length'];
  if (cl) {
    const len = parseInt(cl, 10);
    if (!isNaN(len) && len > maxEntrySizeBytes) {
      return false;
    }
  }

  return true;
}

export interface CacheEntry {
  key: string;
  statusCode: number;
  statusMessage?: string;
  headers: httpTypes.OutgoingHttpHeaders;
  body: Buffer;
  sizeBytes: number;
  createdAt: number;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  bypasses: number;
  evictions: number;
  entries: number;
  cachedBytes: number;
  limits: {
    maxEntries: number;
    maxCacheBytes: number;
    maxEntrySizeBytes: number;
    defaultTtlMs: number;
  };
}

/**
 * Bounded, in-memory LRU HTTP response cache.
 */
export class HttpCache {
  private entries = new Map<string, CacheEntry>();
  private currentBytes = 0;
  readonly maxEntries: number;
  readonly maxCacheBytes: number;
  readonly maxEntrySizeBytes: number;
  readonly defaultTtlMs: number;

  private hits = 0;
  private misses = 0;
  private bypasses = 0;
  private evictions = 0;

  constructor(options?: {
    maxEntries?: number;
    maxCacheBytes?: number;
    maxEntrySizeBytes?: number;
    defaultTtlMs?: number;
  }) {
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_CACHE_ENTRIES;
    this.maxCacheBytes = options?.maxCacheBytes ?? DEFAULT_MAX_CACHE_BYTES;
    this.maxEntrySizeBytes = options?.maxEntrySizeBytes ?? DEFAULT_MAX_ENTRY_SIZE_BYTES;
    this.defaultTtlMs = options?.defaultTtlMs ?? DEFAULT_TTL_MS;
  }

  get(key: string): CacheEntry | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    // Check TTL expiration
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    // Refresh LRU order: delete and re-insert
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  set(
    key: string,
    data: {
      statusCode: number;
      statusMessage?: string;
      headers: httpTypes.OutgoingHttpHeaders;
      body: Buffer;
      ttlMs?: number;
    }
  ): boolean {
    const sizeBytes = data.body.length;
    if (sizeBytes > this.maxEntrySizeBytes) {
      return false;
    }

    if (this.entries.has(key)) {
      this.delete(key);
    }

    // Evict least recently used entries when bounds are reached
    while (
      (this.entries.size >= this.maxEntries ||
        this.currentBytes + sizeBytes > this.maxCacheBytes) &&
      this.entries.size > 0
    ) {
      this.evictOldest();
    }

    if (this.currentBytes + sizeBytes > this.maxCacheBytes) {
      return false;
    }

    const now = Date.now();
    const ttl = data.ttlMs !== undefined && data.ttlMs > 0 ? data.ttlMs : this.defaultTtlMs;
    const entry: CacheEntry = {
      key,
      statusCode: data.statusCode,
      statusMessage: data.statusMessage,
      headers: data.headers,
      body: data.body,
      sizeBytes,
      createdAt: now,
      expiresAt: now + ttl,
    };

    this.entries.set(key, entry);
    this.currentBytes += sizeBytes;
    return true;
  }

  private evictOldest(): void {
    const oldestKey = this.entries.keys().next().value;
    if (oldestKey !== undefined) {
      const entry = this.entries.get(oldestKey);
      if (entry) {
        this.currentBytes -= entry.sizeBytes;
      }
      this.entries.delete(oldestKey);
      this.evictions++;
    }
  }

  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (entry) {
      this.currentBytes -= entry.sizeBytes;
      this.entries.delete(key);
      return true;
    }
    return false;
  }

  clear(): { previousEntries: number; previousBytes: number } {
    const previousEntries = this.entries.size;
    const previousBytes = this.currentBytes;
    this.entries.clear();
    this.currentBytes = 0;
    return { previousEntries, previousBytes };
  }

  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.entries.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
        purged++;
      }
    }
    return purged;
  }

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  recordBypass(): void {
    this.bypasses++;
  }

  getStats(): CacheStats {
    this.purgeExpired();
    return {
      hits: this.hits,
      misses: this.misses,
      bypasses: this.bypasses,
      evictions: this.evictions,
      entries: this.entries.size,
      cachedBytes: this.currentBytes,
      limits: {
        maxEntries: this.maxEntries,
        maxCacheBytes: this.maxCacheBytes,
        maxEntrySizeBytes: this.maxEntrySizeBytes,
        defaultTtlMs: this.defaultTtlMs,
      },
    };
  }
}

// Global cache instance for the reverse proxy
export const cache = new HttpCache();

function isLoopbackAddress(remoteAddress?: string): boolean {
  if (!remoteAddress) return false;
  return (
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1' ||
    remoteAddress === 'localhost'
  );
}

/**
 * Handle incoming client requests by checking cache or streaming to upstream origin.
 */
function handleProxyRequest(req: httpTypes.IncomingMessage, res: httpTypes.ServerResponse): void {
  const startTime = Date.now();
  const clientMethod = req.method || 'GET';
  const rawUrl = req.url || '/';

  // Strictly extract pathname + search to prevent arbitrary upstream destinations
  let targetPath = '/';
  try {
    const parsed = new URL(rawUrl, `http://${PROXY_HOST}:${PROXY_PORT}`);
    targetPath = parsed.pathname + parsed.search;
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request: Invalid URL');
    return;
  }

  // --- Dedicated Proxy Observability Endpoints ---
  // Stats Endpoint (must not be cached)
  if (targetPath === '/__proxy/stats') {
    if (clientMethod === 'GET' || clientMethod === 'HEAD') {
      const stats = cache.getStats();
      const body = JSON.stringify(stats, null, 2);
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store, no-cache, must-revalidate',
        'content-length': Buffer.byteLength(body),
      });
      if (clientMethod === 'GET') {
        res.end(body);
      } else {
        res.end();
      }
      return;
    }
  }

  // Cache Clear Endpoint (restricted to loopback access)
  if (
    (clientMethod === 'POST' && targetPath === '/__proxy/cache/clear') ||
    (clientMethod === 'DELETE' && (targetPath === '/__proxy/cache' || targetPath === '/__proxy/cache/clear'))
  ) {
    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden: Loopback access only.\n');
      return;
    }
    const result = cache.clear();
    const body = JSON.stringify({ cleared: true, ...result });
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  // --- Cache Eligibility Check ---
  const eligibleForCache = isRequestCacheable(req);

  // If eligible GET request, attempt cache lookup
  if (eligibleForCache) {
    const cacheKey = getCacheKey(targetPath, req.headers['accept-encoding']);
    const cachedEntry = cache.get(cacheKey);

    if (cachedEntry) {
      cache.recordHit();
      const durationMs = Date.now() - startTime;
      const hitHeaders = { ...cachedEntry.headers };
      hitHeaders['x-cache'] = 'HIT';
      hitHeaders['age'] = String(Math.floor((Date.now() - cachedEntry.createdAt) / 1000));
      hitHeaders['content-length'] = String(cachedEntry.body.length);

      res.writeHead(cachedEntry.statusCode, cachedEntry.statusMessage, hitHeaders);
      res.end(cachedEntry.body);
      console.log(`[Proxy] GET ${targetPath} -> HIT (${durationMs}ms)`);
      return;
    }
  }

  // Record bypass or miss
  if (!eligibleForCache) {
    cache.recordBypass();
  } else {
    cache.recordMiss();
  }

  // --- Forward to Upstream Origin ---
  const upstreamHeaders = filterHopByHopHeaders(req.headers);
  upstreamHeaders['host'] = `${UPSTREAM_HOST}:${UPSTREAM_PORT}`;

  const originalHost = req.headers['host'] || `${PROXY_HOST}:${PROXY_PORT}`;
  upstreamHeaders['x-forwarded-host'] = originalHost;
  upstreamHeaders['x-forwarded-proto'] = 'http';

  const clientIp = req.socket.remoteAddress;
  if (clientIp) {
    const existingXff = req.headers['x-forwarded-for'];
    upstreamHeaders['x-forwarded-for'] = existingXff
      ? `${existingXff}, ${clientIp}`
      : clientIp;
  }

  const upstreamReq = http.request(
    {
      hostname: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      path: targetPath,
      method: clientMethod,
      headers: upstreamHeaders,
      timeout: UPSTREAM_TIMEOUT_MS,
    },
    (upstreamRes) => {
      const statusCode = upstreamRes.statusCode ?? 200;
      const statusMessage = upstreamRes.statusMessage;
      const clientResponseHeaders = filterHopByHopHeaders(upstreamRes.headers);

      clientResponseHeaders['x-cache'] = eligibleForCache ? 'MISS' : 'BYPASS';

      // Check if upstream response can be cached
      const cacheableResponse =
        eligibleForCache && isResponseCacheable(upstreamRes, cache.maxEntrySizeBytes);

      res.writeHead(statusCode, statusMessage, clientResponseHeaders);

      if (!cacheableResponse) {
        // Stream non-cacheable responses directly without buffering
        upstreamRes.pipe(res);
      } else {
        // Stream-tee: write to client while buffering up to maxEntrySizeBytes for cache
        const cacheKey = getCacheKey(targetPath, req.headers['accept-encoding']);
        const chunks: Buffer[] = [];
        let bufferedBytes = 0;
        let oversized = false;

        upstreamRes.on('data', (chunk: Buffer) => {
          const canContinue = res.write(chunk);
          if (!canContinue) {
            upstreamRes.pause();
            res.once('drain', () => upstreamRes.resume());
          }

          if (!oversized) {
            bufferedBytes += chunk.length;
            if (bufferedBytes > cache.maxEntrySizeBytes) {
              oversized = true;
              chunks.length = 0; // abort buffering, free memory immediately
            } else {
              chunks.push(chunk);
            }
          }
        });

        upstreamRes.on('end', () => {
          res.end();
          if (!oversized && bufferedBytes > 0 && !upstreamRes.destroyed) {
            const body = Buffer.concat(chunks, bufferedBytes);
            const storedHeaders = filterHopByHopHeaders(upstreamRes.headers);
            delete storedHeaders['x-cache'];
            delete storedHeaders['age'];

            const ttlMs = calculateTtlMs(upstreamRes.headers['cache-control'], cache.defaultTtlMs);
            if (ttlMs > 0) {
              cache.set(cacheKey, {
                statusCode,
                statusMessage,
                headers: storedHeaders,
                body,
                ttlMs,
              });
            }
          }
        });
      }

      upstreamRes.on('error', (err) => {
        console.error(`[Proxy] Upstream response error for ${clientMethod} ${targetPath}:`, err.message);
        if (!res.destroyed) {
          res.destroy(err);
        }
      });

      res.on('finish', () => {
        const durationMs = Date.now() - startTime;
        const cacheTag = eligibleForCache ? 'MISS' : 'BYPASS';
        const rangeInfo = req.headers['range'] ? ` [Range: ${req.headers['range']}]` : '';
        console.log(`[Proxy] ${clientMethod} ${targetPath}${rangeInfo} -> ${statusCode} [${cacheTag}] (${durationMs}ms)`);
      });
    }
  );

  // Upstream network error handling
  upstreamReq.on('error', (err) => {
    const durationMs = Date.now() - startTime;
    console.error(`[Proxy] Upstream connection failed for ${clientMethod} ${targetPath} (${err.message}) after ${durationMs}ms`);
    if (!res.headersSent) {
      res.writeHead(502, {
        'content-type': 'text/plain; charset=utf-8',
        'connection': 'close',
      });
      res.end(`502 Bad Gateway: Upstream server is unavailable (${err.message}).\n`);
    } else if (!res.destroyed) {
      res.destroy(err);
    }
  });

  // Upstream timeout handling
  upstreamReq.on('timeout', () => {
    const durationMs = Date.now() - startTime;
    console.error(`[Proxy] Upstream timeout for ${clientMethod} ${targetPath} after ${durationMs}ms`);
    upstreamReq.destroy(new Error('Upstream request timeout'));
    if (!res.headersSent) {
      res.writeHead(504, {
        'content-type': 'text/plain; charset=utf-8',
        'connection': 'close',
      });
      res.end('504 Gateway Timeout: Upstream request timed out.\n');
    } else if (!res.destroyed) {
      res.destroy();
    }
  });

  // Handle client premature disconnect
  res.on('close', () => {
    if (!res.writableFinished && !upstreamReq.destroyed) {
      upstreamReq.destroy();
    }
  });

  req.on('error', (err) => {
    console.error(`[Proxy] Client request error for ${clientMethod} ${targetPath}:`, err.message);
    if (!upstreamReq.destroyed) {
      upstreamReq.destroy(err);
    }
  });

  // Stream request body from client to upstream
  req.pipe(upstreamReq);
}

const server = http.createServer((req, res) => {
  handleProxyRequest(req, res);
});

server.on('clientError', (err: NodeJS.ErrnoException, socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) {
    return;
  }
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Proxy Error] Port ${PROXY_PORT} is already in use. Existing processes must not be terminated abruptly.`);
  } else {
    console.error(`[Proxy Error] Server error:`, err);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('[Proxy] Gracefully shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('[Proxy] Gracefully shutting down...');
  server.close(() => process.exit(0));
});

const isMainModule = !process.argv[1] || process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js');

if (isMainModule) {
  server.listen(PROXY_PORT, PROXY_HOST, () => {
    console.log(`[Proxy] Reverse proxy running at http://${PROXY_HOST}:${PROXY_PORT}`);
    console.log(`[Proxy] Fixed upstream target: http://${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
    console.log(`[Proxy] In-memory cache active: Max ${DEFAULT_MAX_CACHE_ENTRIES} entries, ${(DEFAULT_MAX_CACHE_BYTES / 1024 / 1024).toFixed(1)}MB total, ${(DEFAULT_MAX_ENTRY_SIZE_BYTES / 1024 / 1024).toFixed(1)}MB per entry, default TTL ${DEFAULT_TTL_MS / 1000}s`);
  });
}
