/**
 * Per-IP rate limiting for the public API routes.
 *
 * Follows the `spotify.ts` "configured or degrade" pattern:
 *   - With `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set, limits
 *     are enforced globally via Upstash sliding windows.
 *   - Without them, an in-memory sliding window guards each warm function
 *     instance — weaker (per-instance), but never a hard dependency.
 *
 * Fail-open: an Upstash outage logs and admits the request. Rate limiting
 * protects spend (AudD relay, HF inference) and the fingerprint ingest
 * surface; it must never become the reason the product is down.
 */

import 'server-only';

export type RateLimitBucket =
  | 'identify'
  | 'identify-fallback'
  | 'analyze'
  | 'fingerprints'
  | 'search'
  | 'translate';

interface BucketConfig {
  limit: number;
  windowMs: number;
}

/** Requests per window, per client IP. */
const BUCKETS: Record<RateLimitBucket, BucketConfig> = {
  identify: { limit: 10, windowMs: 60_000 },
  'identify-fallback': { limit: 3, windowMs: 60_000 }, // AudD costs money
  analyze: { limit: 20, windowMs: 60_000 },
  fingerprints: { limit: 30, windowMs: 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  translate: { limit: 20, windowMs: 60_000 },
};

export interface RateLimitResult {
  success: boolean;
  retryAfterMs?: number;
}

/** First hop of x-forwarded-for — what Vercel sets to the client IP. */
export function clientIpFrom(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

// ── In-memory fallback ──────────────────────────────────────

/** Bound total tracked keys so a scan can't grow memory unboundedly. */
const MEMORY_KEY_CAP = 10_000;

class MemorySlidingWindow {
  private readonly hits = new Map<string, number[]>();

  limit(key: string, config: BucketConfig): RateLimitResult {
    const now = Date.now();
    const cutoff = now - config.windowMs;

    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= config.limit) {
      this.hits.set(key, recent);
      return { success: false, retryAfterMs: Math.max(0, recent[0] + config.windowMs - now) };
    }

    recent.push(now);
    if (!this.hits.has(key) && this.hits.size >= MEMORY_KEY_CAP) {
      // Blunt but safe: reset rather than leak. Limits are best-effort here.
      this.hits.clear();
    }
    this.hits.set(key, recent);
    return { success: true };
  }

  reset(): void {
    this.hits.clear();
  }
}

let memoryLimiter = new MemorySlidingWindow();

// ── Upstash (env-gated) ─────────────────────────────────────

function isUpstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

type UpstashLimiter = {
  limit(identifier: string): Promise<{ success: boolean; reset: number }>;
};

const upstashLimiters = new Map<RateLimitBucket, UpstashLimiter>();

async function getUpstashLimiter(bucket: RateLimitBucket): Promise<UpstashLimiter> {
  const cached = upstashLimiters.get(bucket);
  if (cached) return cached;

  // Dynamic import keeps the dependency out of every route's cold path when
  // Upstash isn't configured.
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import('@upstash/ratelimit'),
    import('@upstash/redis'),
  ]);

  const config = BUCKETS[bucket];
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(config.limit, `${Math.round(config.windowMs / 1000)} s`),
    prefix: `ratelimit:${bucket}`,
  });
  upstashLimiters.set(bucket, limiter);
  return limiter;
}

// ── Public API ──────────────────────────────────────────────

/**
 * Check (and consume) one request against a bucket for the given key.
 * Callers typically pass `clientIpFrom(request)` as the key.
 */
export async function rateLimit(
  bucket: RateLimitBucket,
  key: string,
): Promise<RateLimitResult> {
  const config = BUCKETS[bucket];

  if (isUpstashConfigured()) {
    try {
      const limiter = await getUpstashLimiter(bucket);
      const outcome = await limiter.limit(key);
      if (outcome.success) return { success: true };
      return { success: false, retryAfterMs: Math.max(0, outcome.reset - Date.now()) };
    } catch (err) {
      console.error(`rate-limit: Upstash check failed for ${bucket}; failing open`, err);
      return { success: true };
    }
  }

  return memoryLimiter.limit(`${bucket}:${key}`, config);
}

/** Test hook — resets the in-memory window between cases. */
export function __resetRateLimitForTests(): void {
  memoryLimiter = new MemorySlidingWindow();
  upstashLimiters.clear();
}
