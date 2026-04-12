import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Kms, WrappedKey } from "./index.js";

const KEY_ID = "local-v1";

export class LocalKms implements Kms {
  #key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== 32) throw new Error("LocalKms requires a 32-byte key");
    this.#key = key;
  }

  async wrap(plaintext: Buffer): Promise<WrappedKey> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.#key, iv);
    const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { keyId: KEY_ID, ciphertext: Buffer.concat([iv, tag, enc]) };
  }

  async unwrap(keyId: string, blob: Buffer): Promise<Buffer> {
    if (keyId !== KEY_ID) throw new Error(`unknown keyId ${keyId}`);
    if (blob.length < 12 + 16 + 1) throw new Error("wrapped blob too short");
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const ct = blob.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.#key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }
}
