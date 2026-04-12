import { Redis } from "ioredis";

export type RedisClient = Redis;

export function createRedis(url: string): Redis {
  const client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
  });
  return client;
}

const BURN_SCRIPT = `
local v = redis.call('GET', KEYS[1])
if v then redis.call('DEL', KEYS[1]) end
return v
`;

export async function burnOnFetch(redis: Redis, key: string): Promise<string | null> {
  const res = await redis.eval(BURN_SCRIPT, 1, key);
  return (res as string | null) ?? null;
}
