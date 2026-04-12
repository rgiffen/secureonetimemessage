import { randomInt } from "node:crypto";

export async function jitter(minMs = 50, maxMs = 200): Promise<void> {
  const ms = randomInt(minMs, maxMs + 1);
  await new Promise((r) => setTimeout(r, ms));
}
