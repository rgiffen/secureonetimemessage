import { readFileSync } from "node:fs";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  REDIS_URL: z.string().url(),
  SMTP_URL: z.string().min(1),
  SMTP_FROM: z.string().min(1),
  TURNSTILE_SECRET: z.string().min(1),
  PUBLIC_BASE_URL: z.string().url(),
  KMS_BACKEND: z.enum(["local", "aws", "gcp"]).default("local"),
  KMS_KEY_FILE: z.string().min(1),
  EMAIL_HASH_SALT_FILE: z.string().min(1),
});

export type AppConfig = {
  nodeEnv: "development" | "production" | "test";
  port: number;
  logLevel: string;
  redisUrl: string;
  smtpUrl: string;
  smtpFrom: string;
  turnstileSecret: string;
  publicBaseUrl: string;
  kmsBackend: "local" | "aws" | "gcp";
  kmsKey: Buffer;
  emailHashSalt: Buffer;
};

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);
  const kmsKey = readFileSync(parsed.KMS_KEY_FILE);
  if (kmsKey.length !== 32) {
    throw new Error(`KMS_KEY_FILE must contain exactly 32 bytes, got ${kmsKey.length}`);
  }
  const emailHashSalt = readFileSync(parsed.EMAIL_HASH_SALT_FILE);
  if (emailHashSalt.length < 16) {
    throw new Error(`EMAIL_HASH_SALT_FILE must contain at least 16 bytes, got ${emailHashSalt.length}`);
  }
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    redisUrl: parsed.REDIS_URL,
    smtpUrl: parsed.SMTP_URL,
    smtpFrom: parsed.SMTP_FROM,
    turnstileSecret: parsed.TURNSTILE_SECRET,
    publicBaseUrl: parsed.PUBLIC_BASE_URL,
    kmsBackend: parsed.KMS_BACKEND,
    kmsKey,
    emailHashSalt,
  };
}
