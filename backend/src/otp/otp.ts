import { randomInt, timingSafeEqual } from "node:crypto";

export function generateOtp(): string {
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

export function otpEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
