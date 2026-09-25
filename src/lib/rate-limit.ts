/**
 * Fixed-window in-memory rate limiter.
 * Suitable for a single serverless instance; swap the store for Redis/Upstash
 * when running multiple concurrent regions (see .env.example).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodic cleanup so the map cannot grow unbounded.
let lastSweep = Date.now();
function sweep() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(
  key: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): RateLimitResult {
  sweep();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { success: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { success: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/** Returns a stable key for the current request (IP + optional scope). */
export function rateLimitKey(scope: string, identifier?: string | null) {
  return `${scope}:${identifier ?? "anon"}`;
}
