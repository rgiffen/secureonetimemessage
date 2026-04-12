import type { Redis } from "ioredis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function hit(redis: Redis, key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

export async function hitMany(
  redis: Redis,
  windows: Array<{ key: string; limit: number; windowSec: number }>
): Promise<boolean> {
  for (const w of windows) {
    const r = await hit(redis, w.key, w.limit, w.windowSec);
    if (!r.allowed) return false;
  }
  return true;
}
