import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { loggerOptions } from "./log.js";
import { createRedis } from "./storage/redis.js";
import { createKms } from "./kms/index.js";
import { createEmailSender } from "./email/index.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerMessageRoutes } from "./routes/messages.js";

async function main() {
  const cfg = loadConfig();

  const app = Fastify({
    logger: loggerOptions(cfg.logLevel),
    bodyLimit: 256 * 1024,
    disableRequestLogging: false,
    trustProxy: true,
  });

  app.addHook("onSend", async (_req, reply) => {
    // Locked-down CSP: API only ever serves JSON; no inline, no external fetches.
    reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Cache-Control", "no-store");
  });

  const redis = createRedis(cfg.redisUrl);
  const kms = createKms(cfg);
  const email = createEmailSender(cfg);

  app.decorate("appDeps", { cfg, redis, kms, email });

  registerHealthRoute(app);
  await registerMessageRoutes(app, { cfg, redis, kms, email });

  const closeGracefully = async () => {
    app.log.info("shutdown signal received");
    await app.close();
    await redis.quit();
    process.exit(0);
  };
  process.on("SIGINT", closeGracefully);
  process.on("SIGTERM", closeGracefully);

  await app.listen({ host: "0.0.0.0", port: cfg.port });
  app.log.info({ port: cfg.port }, "server listening");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("fatal", err);
  process.exit(1);
});
