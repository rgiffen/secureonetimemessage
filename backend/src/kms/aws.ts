import type { Kms, WrappedKey } from "./index.js";

export class AwsKms implements Kms {
  async wrap(_plaintext: Buffer): Promise<WrappedKey> {
    throw new Error(
      "AwsKms not implemented. Install @aws-sdk/client-kms, add AWS_KMS_KEY_ID to config, and call KMS Encrypt/Decrypt here."
    );
  }
  async unwrap(_keyId: string, _blob: Buffer): Promise<Buffer> {
    throw new Error("AwsKms not implemented");
  }
}
