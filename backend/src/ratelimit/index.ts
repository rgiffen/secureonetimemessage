import type { Redis } from "ioredis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

// Atomic INCR-and-set-TTL. Two separate round trips (INCR then EXPIRE only
// when count == 1) leaves a window where a process crash between the two
// calls would create a rate-limit key with no TTL — it would then persist
// forever and poison the budget for that key. A single Lua script executes
// both ops atomically on the Redis server.
const INCR_WITH_TTL = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return c
`;

export async function hit(
  redis: Redis,
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const count = (await redis.eval(INCR_WITH_TTL, 1, key, String(windowSec))) as number;
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
