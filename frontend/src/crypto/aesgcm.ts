function toBufferSource(u8: Uint8Array): ArrayBuffer {
  // Detach from possible SharedArrayBuffer backing by copying into a fresh ArrayBuffer.
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

export async function importAesKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toBufferSource(keyBytes), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptAesGcm(
  keyBytes: Uint8Array,
  plaintext: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const key = await importAesKey(keyBytes);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: toBufferSource(nonce) }, key, toBufferSource(plaintext))
  );
  return { ciphertext: ct, nonce };
}

export async function decryptAesGcm(
  keyBytes: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array
): Promise<Uint8Array> {
  const key = await importAesKey(keyBytes);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toBufferSource(nonce) },
      key,
      toBufferSource(ciphertext)
    )
  );
}
