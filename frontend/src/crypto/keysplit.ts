export function randomKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) throw new Error("xor length mismatch");
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i]! ^ b[i]!;
  return out;
}

// Split K into (K_link, K_server) such that K_link XOR K_server === K.
// K_link is chosen randomly; K_server = K XOR K_link.
export function splitKey(k: Uint8Array): { kLink: Uint8Array; kServer: Uint8Array } {
  const kLink = randomKey();
  const kServer = xor(k, kLink);
  return { kLink, kServer };
}

export function combineKey(kLink: Uint8Array, kServer: Uint8Array): Uint8Array {
  return xor(kLink, kServer);
}
