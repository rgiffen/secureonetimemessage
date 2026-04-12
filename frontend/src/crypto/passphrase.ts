import { encryptAesGcm, decryptAesGcm } from "./aesgcm";

// Lazy-load hash-wasm so the WASM only loads when a passphrase is actually used.
async function deriveArgon2id(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const { argon2id } = await import("hash-wasm");
  const hex = await argon2id({
    password: passphrase,
    salt,
    parallelism: 1,
    // Spec F-09 minimums: time >= 2, memory >= 64 MB. We use 4 iterations for
    // a margin above the floor at negligible UX cost.
    iterations: 4,
    memorySize: 64 * 1024, // 64 MB, in KiB
    hashLength: 32,
    outputType: "hex",
  });
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// PBKDF2 fallback (natively supported, no WASM) if Argon2 unavailable.
async function derivePbkdf2(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const passBytes = new TextEncoder().encode(passphrase);
  const passBuf = new ArrayBuffer(passBytes.byteLength);
  new Uint8Array(passBuf).set(passBytes);
  const saltBuf = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuf).set(salt);
  const keyMat = await crypto.subtle.importKey("raw", passBuf, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    // NIST SP 800-132 minimum is 600k; we use 800k for margin.
    { name: "PBKDF2", salt: saltBuf, iterations: 800_000, hash: "SHA-256" },
    keyMat,
    256
  );
  return new Uint8Array(bits);
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  try {
    return await deriveArgon2id(passphrase, salt);
  } catch {
    return await derivePbkdf2(passphrase, salt);
  }
}

// Wrap K_server with a passphrase-derived key. Output layout:
// [1 byte version=1][16 byte salt][12 byte nonce][ciphertext+tag]
export async function wrapWithPassphrase(kServer: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const { ciphertext, nonce } = await encryptAesGcm(key, kServer);
  const out = new Uint8Array(1 + 16 + 12 + ciphertext.length);
  out[0] = 1;
  out.set(salt, 1);
  out.set(nonce, 17);
  out.set(ciphertext, 29);
  return out;
}

export async function unwrapWithPassphrase(blob: Uint8Array, passphrase: string): Promise<Uint8Array> {
  if (blob.length < 29 + 16 || blob[0] !== 1) throw new Error("invalid wrapped blob");
  const salt = blob.subarray(1, 17);
  const nonce = blob.subarray(17, 29);
  const ct = blob.subarray(29);
  const key = await deriveKey(passphrase, salt);
  return decryptAesGcm(key, nonce, ct);
}
