import type { AppConfig } from "../config.js";
import { LocalKms } from "./local.js";
import { AwsKms } from "./aws.js";

export interface WrappedKey {
  keyId: string;
  ciphertext: Buffer;
}

export interface Kms {
  wrap(plaintext: Buffer): Promise<WrappedKey>;
  unwrap(keyId: string, ciphertext: Buffer): Promise<Buffer>;
}

export function createKms(cfg: AppConfig): Kms {
  switch (cfg.kmsBackend) {
    case "local":
      return new LocalKms(cfg.kmsKey);
    case "aws":
      return new AwsKms();
    case "gcp":
      throw new Error("gcp KMS backend not implemented");
  }
}
