import { randomBytes, createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { Kms } from "../kms/index.js";
import type { EmailSender } from "../email/index.js";
import { burnOnFetch, type RedisClient } from "../storage/redis.js";
import { hashEmail, extractDomain } from "../hashing.js";
import { jitter } from "../sanitize.js";
import { verifyTurnstile } from "../captcha.js";
import { isDisposableDomain } from "../disposable.js";
import { generateOtp, otpEquals } from "../otp/otp.js";
import { hit, hitMany } from "../ratelimit/index.js";

type Deps = { cfg: AppConfig; redis: RedisClient; kms: Kms; email: EmailSender };

const UNIFORM_ERROR = { error: "invalid_or_expired" } as const;
const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const MIN_EXPIRY_SECONDS = 60 * 60;
const OTP_TTL_SECONDS = 10 * 60;
const MAX_OTP_ATTEMPTS = 3;
const MAX_OTP_REQUESTS_PER_MSG = 5;

const createSchema = z.object({
  ciphertext: z.string().min(1).max(32_000),
  nonce: z.string().length(16),
  kServer: z.string().min(1).max(512),
  email: z.string().email().max(254),
  expirySeconds: z.number().int().min(MIN_EXPIRY_SECONDS).max(MAX_EXPIRY_SECONDS),
  hasPassphrase: z.boolean(),
  captchaToken: z.string().min(1).max(4096),
});

const requestOtpSchema = z.object({ email: z.string().email().max(254) });
const verifySchema = z.object({
  email: z.string().email().max(254),
  otp: z.string().regex(/^\d{6}$/),
});

type StoredMessage = {
  ciphertext: string;
  nonce: string;
  kServerWrapped: string;
  kmsKeyId: string;
  emailHash: string;
  hasPassphrase: boolean;
};

type StoredOtp = {
  codeHash: string;
  attempts: number;
  emailHash: string;
};

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function makeToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function registerMessageRoutes(app: FastifyInstance, deps: Deps) {
  const { cfg, redis, kms, email: mailer } = deps;

  app.post("/api/messages", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      await jitter();
      return reply.code(400).send({ error: "invalid_request" });
    }
    const body = parsed.data;

    const domain = extractDomain(body.email);
    if (!domain || isDisposableDomain(domain)) {
      return reply.code(400).send({ error: "disposable_email" });
    }

    const captchaOk = await verifyTurnstile(cfg.turnstileSecret, body.captchaToken, req.ip);
    if (!captchaOk) {
      return reply.code(400).send({ error: "captcha_failed" });
    }

    const ipOk = await hitMany(redis, [
      { key: `rl:create:ip:${req.ip}`, limit: 10, windowSec: 3600 },
      { key: `rl:create:domain:${domain}`, limit: 20, windowSec: 3600 },
    ]);
    if (!ipOk) {
      return reply.code(429).send({ error: "rate_limited" });
    }

    const kServerRaw = Buffer.from(body.kServer, "base64");
    if (kServerRaw.length < 16 || kServerRaw.length > 256) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    const wrapped = await kms.wrap(kServerRaw);

    const token = makeToken();
    const emailHashValue = hashEmail(cfg.emailHashSalt, body.email);

    const record: StoredMessage = {
      ciphertext: body.ciphertext,
      nonce: body.nonce,
      kServerWrapped: wrapped.ciphertext.toString("base64"),
      kmsKeyId: wrapped.keyId,
      emailHash: emailHashValue,
      hasPassphrase: body.hasPassphrase,
    };

    await redis.set(`msg:${token}`, JSON.stringify(record), "EX", body.expirySeconds);

    return reply.code(201).send({ token });
  });

  app.post<{ Params: { token: string } }>("/api/messages/:token/request-otp", async (req, reply) => {
    const parsed = requestOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      await jitter();
      return reply.code(202).send({ status: "sent" });
    }
    const { email } = parsed.data;
    const token = req.params.token;
    const emailHashValue = hashEmail(cfg.emailHashSalt, email);

    const globalOk = await hitMany(redis, [
      { key: `rl:otp:hash:${emailHashValue}:min`, limit: 1, windowSec: 60 },
      { key: `rl:otp:hash:${emailHashValue}:hour`, limit: 10, windowSec: 3600 },
    ]);
    const perMsgOk = (await hit(redis, `rl:otp:msg:${token}`, MAX_OTP_REQUESTS_PER_MSG, MAX_EXPIRY_SECONDS)).allowed;

    const msgRaw = await redis.get(`msg:${token}`);
    const msg = msgRaw ? (JSON.parse(msgRaw) as StoredMessage) : null;

    const shouldSend = globalOk && perMsgOk && msg !== null && msg.emailHash === emailHashValue;

    if (shouldSend) {
      const code = generateOtp();
      const otpRecord: StoredOtp = {
        codeHash: sha256Hex(code),
        attempts: 0,
        emailHash: emailHashValue,
      };
      await redis.set(`otp:${token}`, JSON.stringify(otpRecord), "EX", OTP_TTL_SECONDS);
      try {
        await mailer.sendOtp(email, code);
      } catch (err) {
        // Log only a bounded code (never the SMTP transcript) so that log
        // greps cannot be used to enumerate which recipient addresses were
        // seen by the server.
        const errCode =
          typeof err === "object" && err !== null && "code" in err
            ? String((err as { code: unknown }).code)
            : "unknown";
        req.log.warn({ smtpErrCode: errCode }, "otp send failed");
      }
    }

    await jitter();
    return reply.code(202).send({ status: "sent" });
  });

  app.post<{ Params: { token: string } }>("/api/messages/:token/verify", async (req, reply) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      await jitter();
      return reply.code(400).send(UNIFORM_ERROR);
    }
    const { email, otp } = parsed.data;
    const token = req.params.token;
    const emailHashValue = hashEmail(cfg.emailHashSalt, email);

    // Per F-17a: verification attempts are bound to (message, IP) and parallel
    // sessions share the budget — opening multiple tabs or refreshing does NOT
    // grant a fresh 3-attempt window. Capped just above MAX_OTP_ATTEMPTS so one
    // honest typo followed by a resend still leaves the user with working retries.
    const PER_IP_VERIFY_CAP = MAX_OTP_ATTEMPTS + 2;
    const verifyOk = (await hit(redis, `rl:verify:msg:${token}:ip:${req.ip}`, PER_IP_VERIFY_CAP, OTP_TTL_SECONDS)).allowed;
    if (!verifyOk) {
      await jitter();
      return reply.code(400).send(UNIFORM_ERROR);
    }

    const otpRaw = await redis.get(`otp:${token}`);
    if (!otpRaw) {
      await jitter();
      return reply.code(400).send(UNIFORM_ERROR);
    }
    const otpRecord = JSON.parse(otpRaw) as StoredOtp;

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await redis.del(`otp:${token}`);
      await jitter();
      return reply.code(400).send(UNIFORM_ERROR);
    }

    const matches = otpRecord.emailHash === emailHashValue && otpEquals(sha256Hex(otp), otpRecord.codeHash);

    if (!matches) {
      otpRecord.attempts += 1;
      if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
        await redis.del(`otp:${token}`);
      } else {
        const ttl = await redis.ttl(`otp:${token}`);
        await redis.set(`otp:${token}`, JSON.stringify(otpRecord), "EX", ttl > 0 ? ttl : OTP_TTL_SECONDS);
      }
      await jitter();
      return reply.code(400).send(UNIFORM_ERROR);
    }

    await redis.del(`otp:${token}`);

    const msgRaw = await burnOnFetch(redis, `msg:${token}`);
    if (!msgRaw) {
      await jitter();
      return reply.code(400).send(UNIFORM_ERROR);
    }
    const msg = JSON.parse(msgRaw) as StoredMessage;

    let kServerPlain: Buffer;
    try {
      kServerPlain = await kms.unwrap(msg.kmsKeyId, Buffer.from(msg.kServerWrapped, "base64"));
    } catch (err) {
      req.log.error({ err }, "kms unwrap failed");
      await jitter();
      return reply.code(400).send(UNIFORM_ERROR);
    }

    return reply.code(200).send({
      ciphertext: msg.ciphertext,
      nonce: msg.nonce,
      kServer: kServerPlain.toString("base64"),
      hasPassphrase: msg.hasPassphrase,
    });
  });
}
