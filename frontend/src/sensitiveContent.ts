const PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]+-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bASIA[0-9A-Z]{16}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bghp_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\b/, // JWT
];

function shannonEntropy(s: string): number {
  const freq: Record<string, number> = {};
  for (const c of s) freq[c] = (freq[c] ?? 0) + 1;
  let h = 0;
  for (const k in freq) {
    const p = freq[k]! / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function containsHighEntropyToken(s: string): boolean {
  for (const tok of s.split(/\s+/)) {
    if (tok.length < 12) continue;
    const hasLower = /[a-z]/.test(tok);
    const hasUpper = /[A-Z]/.test(tok);
    const hasDigit = /\d/.test(tok);
    const kinds = Number(hasLower) + Number(hasUpper) + Number(hasDigit);
    if (kinds < 2) continue;
    if (shannonEntropy(tok) >= 3.5) return true;
  }
  return false;
}

export function looksSensitive(content: string): boolean {
  if (!content) return false;
  for (const re of PATTERNS) if (re.test(content)) return true;
  return containsHighEntropyToken(content);
}
