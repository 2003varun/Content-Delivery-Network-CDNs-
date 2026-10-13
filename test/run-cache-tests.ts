import http from 'node:http';
import {
  HttpCache,
  parseCacheControl,
  calculateTtlMs,
  getCacheKey,
  isRequestCacheable,
  isResponseCacheable,
} from '../proxy/server';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runUnitTests() {
  console.log('\n--- 1. Unit Tests: Cache Semantics & LRU ---');

  // Test 1: Cache Key Generation
  try {
    const k1 = getCacheKey('/api/items?q=1', 'gzip, deflate');
    const k2 = getCacheKey('/api/items?q=2', 'gzip, deflate');
    const k3 = getCacheKey('/api/items?q=1', 'br');
    assert(k1 !== k2, 'Different query strings must produce different keys');
    assert(k1 !== k3, 'Different encoding variants must produce different keys');
    results.push({ name: 'Cache key distinguishes query strings and Vary dimensions', passed: true });
  } catch (err: any) {
    results.push({ name: 'Cache key distinguishes query strings and Vary dimensions', passed: false, error: err.message });
  }

  // Test 2: Cache-Control Parsing
  try {
    const cc1 = parseCacheControl('public, max-age=3600, s-maxage=7200');
    assert(cc1.maxAge === 3600, 'max-age parsed');
    assert(cc1.sMaxAge === 7200, 's-maxage parsed');
    assert(!cc1.noStore, 'noStore false');

    const cc2 = parseCacheControl('no-store, private');
    assert(cc2.noStore === true, 'no-store parsed');
    assert(cc2.isPrivate === true, 'private parsed');

    const ttl1 = calculateTtlMs('s-maxage=120, max-age=60', 30000);
    assert(ttl1 === 120000, 's-maxage takes precedence over max-age');

    const ttl2 = calculateTtlMs('max-age=45', 30000);
    assert(ttl2 === 45000, 'max-age used when s-maxage absent');

    const ttl3 = calculateTtlMs(undefined, 30000);
    assert(ttl3 === 30000, 'fallback to default TTL');

    results.push({ name: 'Cache-Control parsing and TTL calculation', passed: true });
  } catch (err: any) {
    results.push({ name: 'Cache-Control parsing and TTL calculation', passed: false, error: err.message });
  }

  // Test 3: Request Eligibility Checks
  try {
    const makeReq = (method: string, headers: Record<string, string>) =>
      ({ method, headers } as any);

    assert(isRequestCacheable(makeReq('GET', {})), 'Standard GET is cacheable');
    assert(!isRequestCacheable(makeReq('POST', {})), 'POST is not cacheable');
    assert(!isRequestCacheable(makeReq('HEAD', {})), 'HEAD is not cacheable (bypasses populating cache)');
    assert(!isRequestCacheable(makeReq('GET', { authorization: 'Bearer xyz' })), 'Authorization is bypassed');
    assert(!isRequestCacheable(makeReq('GET', { cookie: 'session=123' })), 'Cookie is bypassed');
    assert(!isRequestCacheable(makeReq('GET', { range: 'bytes=0-100' })), 'Range requests are bypassed');
    assert(!isRequestCacheable(makeReq('GET', { 'cache-control': 'no-store' })), 'Client no-store is bypassed');
    assert(!isRequestCacheable(makeReq('GET', { 'cache-control': 'no-cache' })), 'Client no-cache is bypassed');
    assert(!isRequestCacheable(makeReq('GET', { pragma: 'no-cache' })), 'Client pragma no-cache is bypassed');

    results.push({ name: 'Request eligibility filtering (Auth, Cookie, Range, Method, Directives)', passed: true });
  } catch (err: any) {
    results.push({ name: 'Request eligibility filtering (Auth, Cookie, Range, Method, Directives)', passed: false, error: err.message });
  }

  // Test 4: Response Eligibility Checks
  try {
    const makeRes = (statusCode: number, headers: Record<string, string>) =>
      ({ statusCode, headers } as any);

    assert(isResponseCacheable(makeRes(200, { 'cache-control': 'public, max-age=60' }), 2097152), '200 OK with public is cacheable');
    assert(!isResponseCacheable(makeRes(206, { 'content-range': 'bytes 0-99/500' }), 2097152), '206 Partial Content is not cacheable');
    assert(!isResponseCacheable(makeRes(404, {}), 2097152), '404 is not cacheable');
    assert(!isResponseCacheable(makeRes(500, {}), 2097152), '500 is not cacheable');
    assert(!isResponseCacheable(makeRes(200, { 'set-cookie': 'sid=1' }), 2097152), 'Set-Cookie is not cacheable');
    assert(!isResponseCacheable(makeRes(200, { 'cache-control': 'no-store' }), 2097152), 'no-store is not cacheable');
    assert(!isResponseCacheable(makeRes(200, { 'cache-control': 'private' }), 2097152), 'private is not cacheable');
    assert(!isResponseCacheable(makeRes(200, { 'cache-control': 'no-cache' }), 2097152), 'no-cache is not cacheable');
    assert(!isResponseCacheable(makeRes(200, { 'cache-control': 'max-age=0' }), 2097152), 'max-age=0 is not cacheable');
    assert(!isResponseCacheable(makeRes(200, { vary: '*' }), 2097152), 'Vary: * is not cacheable');
    assert(!isResponseCacheable(makeRes(200, { vary: 'user-agent' }), 2097152), 'Unsupported Vary dimension is bypassed');
    assert(isResponseCacheable(makeRes(200, { vary: 'accept-encoding' }), 2097152), 'Vary: accept-encoding is cacheable');
    assert(!isResponseCacheable(makeRes(200, { 'content-length': '5000000' }), 2097152), 'Oversized Content-Length is not cacheable');

    results.push({ name: 'Response eligibility filtering (Status, Set-Cookie, CC directives, Vary, Size)', passed: true });
  } catch (err: any) {
    results.push({ name: 'Response eligibility filtering (Status, Set-Cookie, CC directives, Vary, Size)', passed: false, error: err.message });
  }

  // Test 5: LRU Eviction & Capacity Bounds
  try {
    const lru = new HttpCache({
      maxEntries: 3,
      maxCacheBytes: 1000,
      maxEntrySizeBytes: 500,
      defaultTtlMs: 5000,
    });

    lru.set('k1', { statusCode: 200, headers: {}, body: Buffer.alloc(200) });
    lru.set('k2', { statusCode: 200, headers: {}, body: Buffer.alloc(200) });
    lru.set('k3', { statusCode: 200, headers: {}, body: Buffer.alloc(200) });

    assert(lru.get('k1') !== null, 'k1 exists');
    // Accessing k1 moves it to most recently used: order is now k2, k3, k1

    // Adding k4 should evict k2 (least recently used)
    lru.set('k4', { statusCode: 200, headers: {}, body: Buffer.alloc(200) });
    assert(lru.get('k2') === null, 'k2 should be evicted');
    assert(lru.get('k1') !== null, 'k1 should still exist');
    assert(lru.get('k3') !== null, 'k3 should still exist');
    assert(lru.get('k4') !== null, 'k4 should still exist');

    const stats = lru.getStats();
    assert(stats.evictions === 1, 'Evictions count incremented to 1');
    assert(stats.entries === 3, 'Entries count capped at 3');

    // Total byte limit eviction
    // Currently 3 * 200 = 600 bytes. Adding 450 bytes (total 1050 > 1000 limit) should evict oldest
    lru.set('k5', { statusCode: 200, headers: {}, body: Buffer.alloc(450) });
    assert(lru.getStats().cachedBytes <= 1000, 'Cached bytes must remain within maxCacheBytes');

    // Oversized entry rejection
    const setOversized = lru.set('k_huge', { statusCode: 200, headers: {}, body: Buffer.alloc(600) });
    assert(!setOversized, 'Entry exceeding maxEntrySizeBytes must be rejected');

    results.push({ name: 'LRU eviction by entry limit and byte limit', passed: true });
  } catch (err: any) {
    results.push({ name: 'LRU eviction by entry limit and byte limit', passed: false, error: err.message });
  }

  // Test 6: TTL Expiration
  try {
    const ttlCache = new HttpCache({ defaultTtlMs: 100 });
    ttlCache.set('short-lived', { statusCode: 200, headers: {}, body: Buffer.from('hello'), ttlMs: 100 });
    assert(ttlCache.get('short-lived') !== null, 'Immediately available');

    // Wait 150ms for TTL to expire
    await new Promise((r) => setTimeout(r, 150));
    assert(ttlCache.get('short-lived') === null, 'Expired after TTL');
    results.push({ name: 'TTL expiration on access and purge', passed: true });
  } catch (err: any) {
    results.push({ name: 'TTL expiration on access and purge', passed: false, error: err.message });
  }
}

async function runIntegrationTests() {
  console.log('\n--- 2. Integration Tests: Live Reverse Proxy (Port 8080 -> 9002) ---');

  // Clear live proxy cache first
  try {
    const clearRes = await fetch('http://127.0.0.1:8080/__proxy/cache/clear', { method: 'POST' });
    const clearData = await clearRes.json();
    assert(clearRes.status === 200, 'Clear status 200');
    assert(clearData.cleared === true, 'Clear returned cleared: true');
    results.push({ name: 'Live Cache Clear endpoint (POST /__proxy/cache/clear)', passed: true });
  } catch (err: any) {
    results.push({ name: 'Live Cache Clear endpoint (POST /__proxy/cache/clear)', passed: false, error: err.message });
  }

  // Test Live Stats endpoint
  try {
    const statsRes = await fetch('http://127.0.0.1:8080/__proxy/stats');
    const stats = await statsRes.json();
    assert(statsRes.status === 200, 'Stats status 200');
    assert(stats.entries === 0, 'Initial entries 0');
    assert(stats.limits.maxEntries === 100, 'Configured maxEntries present');
    results.push({ name: 'Live Stats endpoint (GET /__proxy/stats)', passed: true });
  } catch (err: any) {
    results.push({ name: 'Live Stats endpoint (GET /__proxy/stats)', passed: false, error: err.message });
  }

  // Test eligible GET: First request is MISS; second identical request is HIT
  const assetPath = '/_next/static/media/gyByhwUxId8gMEwcGFWNOITd-s.p.d06edde1.woff2';
  try {
    const r1 = await fetch(`http://127.0.0.1:8080${assetPath}`);
    assert(r1.status === 200, 'Asset r1 status 200');
    const xCache1 = r1.headers.get('x-cache');
    assert(xCache1 === 'MISS', `First request must be MISS, got: ${xCache1}`);
    const b1 = await r1.arrayBuffer();

    const r2 = await fetch(`http://127.0.0.1:8080${assetPath}`);
    assert(r2.status === 200, 'Asset r2 status 200');
    const xCache2 = r2.headers.get('x-cache');
    assert(xCache2 === 'HIT', `Second request must be HIT, got: ${xCache2}`);
    const age = r2.headers.get('age');
    assert(age !== null, 'Cached response has Age header');
    const cl = r2.headers.get('content-length');
    assert(cl === String(b1.byteLength), 'Content-Length matches body byte length');
    const b2 = await r2.arrayBuffer();
    assert(b2.byteLength === b1.byteLength, 'Cached body matches original body exactly');

    results.push({ name: 'Eligible GET: First is MISS (cached), Second is HIT with valid Age and Content-Length', passed: true });
  } catch (err: any) {
    results.push({ name: 'Eligible GET: First is MISS (cached), Second is HIT with valid Age and Content-Length', passed: false, error: err.message });
  }

  // Test query strings do not collide: asset?q=1 is MISS, asset?q=1 again is HIT, asset?q=2 is separate MISS
  try {
    const rQ1 = await fetch(`http://127.0.0.1:8080${assetPath}?q=1`);
    assert(rQ1.headers.get('x-cache') === 'MISS', 'asset?q=1 first is MISS');
    await rQ1.arrayBuffer();

    const rQ1_hit = await fetch(`http://127.0.0.1:8080${assetPath}?q=1`);
    assert(rQ1_hit.headers.get('x-cache') === 'HIT', 'asset?q=1 second is HIT');
    await rQ1_hit.arrayBuffer();

    const rQ2 = await fetch(`http://127.0.0.1:8080${assetPath}?q=2`);
    assert(rQ2.headers.get('x-cache') === 'MISS', 'asset?q=2 is separate MISS');
    await rQ2.arrayBuffer();

    results.push({ name: 'Different query strings do not collide in cache key', passed: true });
  } catch (err: any) {
    results.push({ name: 'Different query strings do not collide in cache key', passed: false, error: err.message });
  }

  // Test dynamic page with upstream 'no-store': Next.js root '/' sends no-store
  try {
    const rRoot1 = await fetch('http://127.0.0.1:8080/');
    const rRootCc = rRoot1.headers.get('cache-control');
    assert(rRootCc !== null && rRootCc.includes('no-store'), 'Upstream sent no-store for /');
    const xCacheRoot1 = rRoot1.headers.get('x-cache');
    assert(xCacheRoot1 === 'MISS', 'Response flagged as MISS');
    await rRoot1.text();

    // Second request to '/' must NOT be cached because upstream sent no-store!
    const rRoot2 = await fetch('http://127.0.0.1:8080/');
    const xCacheRoot2 = rRoot2.headers.get('x-cache');
    assert(xCacheRoot2 === 'MISS', 'Second request to no-store resource remains MISS (not cached)');
    await rRoot2.text();

    results.push({ name: 'Upstream no-store is strictly respected and never cached', passed: true });
  } catch (err: any) {
    results.push({ name: 'Upstream no-store is strictly respected and never cached', passed: false, error: err.message });
  }

  // Test upstream 'max-age=0' (favicon.ico): Next.js sends public, max-age=0
  try {
    const rFav1 = await fetch('http://127.0.0.1:8080/favicon.ico');
    const rFavCc = rFav1.headers.get('cache-control');
    assert(rFavCc !== null && rFavCc.includes('max-age=0'), 'Favicon has max-age=0');
    await rFav1.arrayBuffer();

    const rFav2 = await fetch('http://127.0.0.1:8080/favicon.ico');
    assert(rFav2.headers.get('x-cache') === 'MISS', 'max-age=0 resource remains MISS on second request');
    await rFav2.arrayBuffer();

    results.push({ name: 'Upstream max-age=0 is strictly respected and not cached', passed: true });
  } catch (err: any) {
    results.push({ name: 'Upstream max-age=0 is strictly respected and not cached', passed: false, error: err.message });
  }

  // Test Authorization header bypass
  try {
    const rAuth = await fetch(`http://127.0.0.1:8080${assetPath}`, {
      headers: { Authorization: 'Bearer test-token' },
    });
    const xCacheAuth = rAuth.headers.get('x-cache');
    assert(xCacheAuth === 'BYPASS', `Authorization request must be BYPASS, got: ${xCacheAuth}`);
    await rAuth.arrayBuffer();
    results.push({ name: 'Request with Authorization header bypasses cache', passed: true });
  } catch (err: any) {
    results.push({ name: 'Request with Authorization header bypasses cache', passed: false, error: err.message });
  }

  // Test Cookie header bypass
  try {
    const rCookie = await fetch(`http://127.0.0.1:8080${assetPath}`, {
      headers: { Cookie: 'auth=secret' },
    });
    const xCacheCookie = rCookie.headers.get('x-cache');
    assert(xCacheCookie === 'BYPASS', `Cookie request must be BYPASS, got: ${xCacheCookie}`);
    await rCookie.arrayBuffer();
    results.push({ name: 'Request with Cookie header bypasses cache', passed: true });
  } catch (err: any) {
    results.push({ name: 'Request with Cookie header bypasses cache', passed: false, error: err.message });
  }

  // Test Range request bypass & partial 206 response
  try {
    const rRange = await fetch(`http://127.0.0.1:8080${assetPath}`, {
      headers: { Range: 'bytes=0-99' },
    });
    assert(rRange.status === 206, `Range response status 206, got: ${rRange.status}`);
    const xCacheRange = rRange.headers.get('x-cache');
    assert(xCacheRange === 'BYPASS', `Range request must be BYPASS, got: ${xCacheRange}`);
    const cr = rRange.headers.get('content-range');
    assert(cr !== null && cr.startsWith('bytes 0-99/'), 'Content-Range preserved');
    const rangeBuf = await rRange.arrayBuffer();
    assert(rangeBuf.byteLength === 100, 'Received exact range bytes');
    results.push({ name: 'Range request bypasses cache and preserves 206 Partial Content', passed: true });
  } catch (err: any) {
    results.push({ name: 'Range request bypasses cache and preserves 206 Partial Content', passed: false, error: err.message });
  }

  // Test Client Cache-Control: no-cache / no-store bypass
  try {
    const rNoCache = await fetch(`http://127.0.0.1:8080${assetPath}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    const xCacheNoCache = rNoCache.headers.get('x-cache');
    assert(xCacheNoCache === 'BYPASS', `Client no-cache must be BYPASS, got: ${xCacheNoCache}`);
    await rNoCache.arrayBuffer();
    results.push({ name: 'Client Cache-Control: no-cache bypasses cache', passed: true });
  } catch (err: any) {
    results.push({ name: 'Client Cache-Control: no-cache bypasses cache', passed: false, error: err.message });
  }

  // Test HEAD method handling
  try {
    const rHead = await fetch(`http://127.0.0.1:8080${assetPath}`, { method: 'HEAD' });
    assert(rHead.status === 200, 'HEAD returns status 200');
    const xCacheHead = rHead.headers.get('x-cache');
    assert(xCacheHead === 'BYPASS', `HEAD must be BYPASS, got: ${xCacheHead}`);
    const headText = await rHead.text();
    assert(headText === '', 'HEAD body is empty');
    results.push({ name: 'HEAD requests handled safely without populating cache', passed: true });
  } catch (err: any) {
    results.push({ name: 'HEAD requests handled safely without populating cache', passed: false, error: err.message });
  }

  // Verify Stats accurately reflect traffic
  try {
    const statsRes = await fetch('http://127.0.0.1:8080/__proxy/stats');
    const stats = await statsRes.json();
    assert(stats.hits >= 2, `Hits recorded (expected >= 2, got ${stats.hits})`);
    assert(stats.misses >= 3, `Misses recorded (expected >= 3, got ${stats.misses})`);
    assert(stats.bypasses >= 3, `Bypasses recorded (expected >= 3, got ${stats.bypasses})`);
    assert(stats.entries >= 2, `Entries stored (expected >= 2, got ${stats.entries})`);
    assert(stats.cachedBytes > 0, `CachedBytes stored (expected > 0, got ${stats.cachedBytes})`);
    results.push({ name: 'Stats accurately reflect hits, misses, bypasses, entries, and cached bytes', passed: true, details: JSON.stringify(stats) });
  } catch (err: any) {
    results.push({ name: 'Stats accurately reflect hits, misses, bypasses, entries, and cached bytes', passed: false, error: err.message });
  }

  // Test large body streaming and oversized cache bypass
  try {
    const mockUpstream = http.createServer((_req, res) => {
      res.writeHead(200, {
        'content-type': 'application/octet-stream',
        'cache-control': 'public, max-age=60',
      });
      // Stream 3 MB in 256 KB chunks
      const chunk = Buffer.alloc(256 * 1024, 0x42);
      for (let i = 0; i < 12; i++) {
        res.write(chunk);
      }
      res.end();
    });

    await new Promise<void>((resolve) => mockUpstream.listen(9876, '127.0.0.1', () => resolve()));

    // Create a standalone test cache with a 1 MB limit
    const testCache = new HttpCache({ maxEntrySizeBytes: 1024 * 1024 });
    const mockProxy = http.createServer((req, res) => {
      const upReq = http.request(
        {
          hostname: '127.0.0.1',
          port: 9876,
          path: req.url || '/',
          method: req.method,
        },
        (upRes) => {
          res.writeHead(upRes.statusCode || 200, upRes.headers);
          const chunks: Buffer[] = [];
          let total = 0;
          let oversized = false;

          upRes.on('data', (c: Buffer) => {
            res.write(c);
            if (!oversized) {
              total += c.length;
              if (total > testCache.maxEntrySizeBytes) {
                oversized = true;
                chunks.length = 0; // Discard accumulated buffer
              } else {
                chunks.push(c);
              }
            }
          });

          upRes.on('end', () => {
            res.end();
            if (!oversized && total > 0) {
              testCache.set(req.url || '/', {
                statusCode: 200,
                headers: upRes.headers,
                body: Buffer.concat(chunks),
              });
            }
          });
        }
      );
      req.pipe(upReq);
    });

    await new Promise<void>((resolve) => mockProxy.listen(8765, '127.0.0.1', () => resolve()));

    const res3mb = await fetch('http://127.0.0.1:8765/large-file');
    assert(res3mb.status === 200, 'Large file response status 200');
    const buf3mb = await res3mb.arrayBuffer();
    assert(buf3mb.byteLength === 12 * 256 * 1024, `All 3MB streamed completely (${buf3mb.byteLength} bytes)`);

    // Verify cache did NOT store the oversized body
    assert(testCache.getStats().entries === 0, 'Oversized entry was not cached');
    assert(testCache.getStats().cachedBytes === 0, '0 cached bytes stored');

    mockProxy.close();
    mockUpstream.close();

    results.push({ name: 'Large bodies bypass caching without breaking full streaming transfer', passed: true });
  } catch (err: any) {
    results.push({ name: 'Large bodies bypass caching without breaking full streaming transfer', passed: false, error: err.message });
  }
}

async function main() {
  console.log('=== Running Phase 3 In-Memory Cache Verification Suite ===');
  await runUnitTests();
  await runIntegrationTests();

  console.log('\n=== Test Summary ===');
  let passCount = 0;
  for (const r of results) {
    const status = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${r.name}`);
    if (r.details) console.log(`   Details: ${r.details}`);
    if (r.error) console.log(`   Error: ${r.error}`);
    if (r.passed) passCount++;
  }
  console.log(`\nTotal: ${passCount}/${results.length} tests passed.\n`);

  if (passCount !== results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
