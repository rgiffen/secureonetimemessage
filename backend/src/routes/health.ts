import type { FastifyInstance } from "fastify";
import type { Kms } from "../kms/index.js";
import type { RedisClient } from "../storage/redis.js";

// The health endpoint is what an upstream load balancer and our own operator
// dashboards poll. It must actually exercise the dependencies — a process
// that came up with an unreadable KMS key or a broken Redis link should
// report 503, not a cheerful 200. Checks performed:
//
//   1. KMS wrap + unwrap roundtrip of a fixed probe buffer (detects a key
//      file that's missing, wrong size, or corrupted).
//   2. Redis PING (detects a dropped backend connection).
//
// Both are cheap: local AES on a tiny buffer and a single Redis round trip.
export function registerHealthRoute(
  app: FastifyInstance,
  deps: { kms: Kms; redis: RedisClient },
) {
  const { kms, redis } = deps;
  const probe = Buffer.from("health-check");

  app.get("/api/health", async (_req, reply) => {
    try {
      const wrapped = await kms.wrap(probe);
      const unwrapped = await kms.unwrap(wrapped.keyId, wrapped.ciphertext);
      if (!unwrapped.equals(probe)) throw new Error("kms roundtrip mismatch");
      const pong = await redis.ping();
      if (pong !== "PONG") throw new Error(`redis ping returned ${pong}`);
      return { status: "ok" };
    } catch (err) {
      app.log.warn({ err }, "health check failed");
      return reply.code(503).send({ status: "error" });
    }
  });
}
