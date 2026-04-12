import { createHmac } from "node:crypto";

export function hashEmail(salt: Buffer, email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHmac("sha256", salt).update(normalized).digest("base64url");
}

export function extractDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}
