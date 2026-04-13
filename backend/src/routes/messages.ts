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
import { generateOtp } from "../otp/otp.js";
import { hit, hitMany } from "../ratelimit/index.js";

type Deps = { cfg: AppConfig; redis: RedisClient; kms: Kms; email: EmailSender };

const UNIFORM_ERROR = { error: "invalid_or_expired" } as const;
const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const MIN_EXPIRY_SECONDS = 60 * 60;
const OTP_TTL_SECONDS = 10 * 60;
const MAX_OTP_ATTEMPTS = 3;
const MAX_OTP_REQUESTS_PER_MSG = 5;

// Approximate worst-case ciphertext size derived from PRD F-01 (up to 10 000
// plaintext chars). At 4-byte UTF-8 per char that's 40 000 bytes plaintext,
// plus a 16-byte GCM tag, base64-encoded ~= 53 400 chars. 54 000 gives a
// small margin without permitting much beyond what a legitimate sender
// could produce.
const MAX_CIPHERTEXT_CHARS = 54_000;

// kServer wrapped format when a passphrase is set:
//   1 byte version + 16 byte salt + 12 byte nonce + 32 byte ciphertext +
//   16 byte GCM tag = 77 bytes. Unwrapped kServer is exactly 32 bytes
//   (XOR share of the AES key). Slack on both to tolerate minor format
//   evolution without re-bounding.
const MIN_KSERVER_BYTES = 32;
const MAX_KSERVER_BYTES_UNWRAPPED = 64;
const MAX_KSERVER_BYTES_WRAPPED = 128;

const createSchema = z.object({
  ciphertext: z.string().min(1).max(MAX_CIPHERTEXT_CHARS),
  // The 16-char length matches base64 of 12 bytes (the AES-GCM nonce), but
  // refine to verify the decoded byte length actually equals 12 so malformed
  // base64 that happens to be 16 chars long is rejected explicitly.
  nonce: z.string().length(16).refine(
    (s) => Buffer.from(s, "base64").length === 12,
    { message: "nonce must decode to exactly 12 bytes" },
  ),
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

// Schemas for objects we store in Redis. Even though we wrote these
// structures ourselves, validating on read guards against a compromised
// Redis, a forgotten schema migration, or a rogue tool mutating keys.
const storedMessageSchema = z.object({
  ciphertext: z.string(),
  nonce: z.string(),
  kServerWrapped: z.string(),
  kmsKeyId: z.string(),
  emailHash: z.string(),
  hasPassphrase: z.boolean(),
});
type StoredMessage = z.infer<typeof storedMessageSchema>;

const storedOtpSchema = z.object({
  codeHash: z.string(),
  attempts: z.number().int().nonnegative(),
  emailHash: z.string(),
});
type StoredOtp = z.infer<typeof storedOtpSchema>;

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function makeToken(): string {
  return randomBytes(32).toString("base64url");
}

function parseStoredMessage(raw: string | null): StoredMessage | null {
  if (!raw) return null;
  try {
    const parsed = storedMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Atomic verify-OTP-attempt: reads the OTP record, checks whether the
// supplied code+email hash match, and updates or deletes in one Redis
// round trip. Closes the read/modify/write race that existed when the
// attempt counter was incremented across two separate commands.
//
// Returns one of: 'not_found' | 'exhausted' | 'matched' | 'wrong'.
// TTL is preserved across misses by reading and re-applying the current
// TTL inside the script.
const VERIFY_OTP_SCRIPT = `
local rec = redis.call('GET', KEYS[1])
if not rec then return 'not_found' end
local ok, data = pcall(cjson.decode, rec)
if not ok or type(data) ~= 'table' then
  redis.call('DEL', KEYS[1])
  return 'not_found'
end

local attempts = tonumber(data.attempts) or 0
local max = tonumber(ARGV[3])
if attempts >= max then
  redis.call('DEL', KEYS[1])
  return 'exhausted'
end

if data.emailHash == ARGV[2] and data.codeHash == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 'matched'
end

attempts = attempts + 1
data.attempts = attempts
if attempts >= max then
  redis.call('DEL', KEYS[1])
  return 'exhausted'
end

local ttl = redis.call('TTL', KEYS[1])
local newTtl = (ttl and ttl > 0) and ttl or tonumber(ARGV[4])
redis.call('SET', KEYS[1], cjson.encode(data), 'EX', newTtl)
return 'wrong'
`;

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
    const maxKServer = body.hasPassphrase ? MAX_KSERVER_BYTES_WRAPPED : MAX_KSERVER_BYTES_UNWRAPPED;
    if (kServerRaw.length < MIN_KSERVER_BYTES || kServerRaw.length > maxKServer) {
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

    const msg = parseStoredMessage(await redis.get(`msg:${token}`));
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

    // Two rate-limit gates before we touch the OTP record:
    //
    //   rl:verify:msg:{token}:ip:{ip}     — per-(message, IP) cap. Parallel
    //     tabs/refreshes share the budget so the 3-attempt OTP cap can't
    //     be escalated from a single IP (F-17a).
    //
    //   rl:verify:hash:{emailHash}:hour   — global per-recipient cap. Guards
    //     against distributed brute force where an attacker rotates across
    //     many IPs (each of which still costs one attempt here). 20/hour
    //     leaves plenty of room for a legitimate user's typos and resends
    //     while pinning the overall attack bandwidth into the 6-digit space.
    const PER_IP_VERIFY_CAP = MAX_OTP_ATTEMPTS + 2;
    const gates = await hitMany(redis, [
      { key: `rl:verify:msg:${token}:ip:${req.ip}`, limit: PER_IP_VERIFY_CAP, windowSec: OTP_TTL_SECONDS },
      { key: `rl:verify:hash:${emailHashValue}:hour`, limit: 20, windowSec: 3600 },
    ]);
    if (!gates) {
      await jitter();
      return reply.code(400).send(UNIFORM_ERROR);
    }

    // Atomic check-and-mutate of the OTP record. Closes the previous
    // GET-compare-INCR-SET race: concurrent wrong-code submissions used
    // to be able to both read the same `attempts` value and each write
    // attempts+1, effectively dropping one increment and inflating the
    // real per-code budget beyond MAX_OTP_ATTEMPTS.
    const verdict = (await redis.eval(
      VERIFY_OTP_SCRIPT,
      1,
      `otp:${token}`,
      sha256Hex(otp),
      emailHashValue,
      String(MAX_OTP_ATTEMPTS),
      String(OTP_TTL_SECONDS),
    )) as string | null;

    if (verdict !== "matched") {
      await jitter();
      return reply.code(400).send(UNIFORM_ERROR);
    }

    const msg = parseStoredMessage(await burnOnFetch(redis, `msg:${token}`));
    if (!msg) {
      await jitter();
      return reply.code(400).send(UNIFORM_ERROR);
    }

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
