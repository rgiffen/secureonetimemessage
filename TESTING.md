# Testing — SecureDrop initial build

This document describes the testing performed on the initial implementation of SecureDrop. It is a record of what was actually exercised, **not** a test plan or QA spec.

## Environment

- macOS (Darwin 24.6.0, arm64)
- podman 5.7.0 with `podman-machine-default` running (applehv VM, 2 CPUs, 4 GiB)
- podman-compose 1.5.0
- Node 22 inside the backend and frontend build images
- Containers launched via `podman compose -f compose.yaml -f compose.dev.yaml up --build`

## What was tested

### 1. Static analysis and builds

| Check | Result |
|-------|--------|
| `backend: npm run typecheck` (`tsc --noEmit`) | pass — zero errors |
| `frontend: tsc -b && vite build` | pass — emits `dist/` with hashed asset filenames |
| Backend image build (`backend/Containerfile`) | pass — two-stage build, production image runs as `node` user |
| Frontend image build (`frontend/Containerfile`) | pass — multistage Vite build → nginx:alpine |

Key frontend build detail: the original `argon2-browser` dependency failed to bundle under Vite because it ships a WASM module with Node-style `fs`/`path` imports and a non-standard ESM loader. Replaced with `hash-wasm`, which supports Argon2id natively, is pure ESM, and ships TypeScript types. Build produced a 291 KB main chunk (gzip 71 KB) plus a lazily loaded 31 KB hash-wasm chunk (gzip 12 KB) that is only fetched when a passphrase is used.

### 2. Container orchestration

All four services started cleanly under `podman compose`:

```
secureonetimemessage_redis_1     Up (healthy)
secureonetimemessage_mailhog_1   Up
secureonetimemessage_backend_1   Up
secureonetimemessage_frontend_1  Up
```

Redis passed its `redis-cli ping` healthcheck before the backend was allowed to start (`depends_on: service_healthy`). MailHog image pulled with an amd64/arm64 platform mismatch warning — functional on arm64 via Rosetta/qemu, noted but not blocking.

### 3. Backend API — happy path

Exercised via `curl` against `http://localhost:8080/api`:

**Create a message (`POST /api/messages`)**

- Body included `ciphertext`, `nonce`, `kServer` (base64 placeholders), `email=test@example.com`, `expirySeconds=3600`, `hasPassphrase=false`, `captchaToken="dummy"`.
- Turnstile verification used the Cloudflare test secret `1x0000…AA` which always returns `success: true`, so any token passes.
- Response: `201` with `{"token": "rN2r36aj11lZRU2tsX5RHCqo2amfVz_vz3QdBt2NHJY"}` — 32 bytes of entropy, base64url-encoded. ✓

**Request OTP (`POST /api/messages/:token/request-otp`)**

- Returned `202 {"status":"sent"}` after the timing jitter (50–200 ms).
- MailHog API (`GET http://localhost:8025/api/v2/messages`) confirmed an email was delivered from `no-reply@securedrop.local` to `test@example.com` containing a 6-digit code. ✓

**Verify (`POST /api/messages/:token/verify`)**

- Extracted the OTP from MailHog's `Content.Body`.
- Request with the correct code and matching email returned `200` with `{ciphertext, nonce, kServer, hasPassphrase}`. ✓
- The returned `kServer` was the base64 of the original bytes, confirming the `LocalKms.wrap`/`unwrap` round-trip (AES-256-GCM with a 32-byte key loaded from `/run/secrets/kms_key`). ✓

### 4. Security-critical properties

**Burn-on-fetch (F-19).** A second `POST /verify` with the same valid OTP returned `400 {"error":"invalid_or_expired"}`. The message record was atomically deleted during the first successful verify via the Lua `GET … DEL` script in `backend/src/storage/redis.ts`. ✓

**Enumeration resistance (F-17b, NF-07a).** Four distinct failure modes all returned byte-identical responses (`400 {"error":"invalid_or_expired"}`) after the jitter delay:

- Non-existent token
- Valid token, wrong OTP
- Valid token, burned message (second verify)
- Malformed request body

No response distinguished "message doesn't exist" from "message already viewed" from "OTP wrong." ✓

**Fragment scrubbing (F-18a).** `curl http://localhost:8081/m/sometoken` returns `index.html`, which contains an inline `<script>` block as its first executing script, before the React bundle is loaded. That script reads `window.location.hash`, stashes it on `window.__SECUREDROP_K_LINK__`, and calls `window.history.replaceState(null, '', pathname + search)`. The React app is the second script in document order. ✓ (not exercised in a real browser — see **Not tested** below.)

**Security headers (NF-02).** `curl -I http://localhost:8081/` returned all of:

- `Content-Security-Policy` with `default-src 'self'`, `script-src 'self' https://challenges.cloudflare.com`, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'self'`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()`
- `Cache-Control: no-store`

A regression was caught and fixed during this work: an earlier nginx config used `location = /index.html { add_header Cache-Control … }`, which silently suppressed the server-level security headers due to nginx's `add_header` inheritance rule. Moved everything to the `server` scope.  ✓

**SPA fallback.** `GET /m/anything` returns `index.html` (Content-Length matches `/`), so the React router can resolve `/m/:token` client-side. ✓

**KMS wrapping.** The `LocalKms` backend wraps `kServer` with AES-256-GCM using a 32-byte key loaded from the podman secret `kms_key`, prefixed by `iv || tag || ciphertext`. Key versioning is keyed by the tag `local-v1` so a future key rotation can add `local-v2` alongside. The `AwsKms` stub throws with a message pointing at the extension instructions.

## What was NOT tested

Documented honestly so nothing is mistaken for validated. These are the pieces that need manual or future automated validation:

- **Browser walk-through.** The UI was not driven by a real browser. I confirmed that `index.html`, the JS bundle, CSS, and fonts load, but did not interactively verify:
  - The compose form (A1) renders correctly, the CAPTCHA widget loads, the sensitive-content amber banner appears for `-----BEGIN` / `AKIA…` / high-entropy tokens, the confirmation dialog fires when sending sensitive content without a passphrase.
  - The link-created screen (A2) — copy, share sheet, mailto.
  - Recipient flow (B1 → B2 → B3/B5) with auto-advance and paste on the code boxes, resend cooldown, shake-on-error.
  - Message reveal (B5) with the 60 s auto-hide timer, pause affordance, and second-reveal counter.
  - Terminal screens B4 (unavailable) and B4a (decrypt failed).
- **Full crypto round-trip.** The backend API test used placeholder base64 strings. I did not yet run: sender browser encrypts a real message with AES-256-GCM → server stores → recipient browser decrypts → plaintext matches. The individual primitives (`aesgcm.ts`, `keysplit.ts`, `passphrase.ts`, `hash-wasm` Argon2id) have no unit tests yet.
- **Passphrase flow.** Argon2id was not exercised. `hash-wasm`'s Argon2id WASM will be fetched on first passphrase use — this network fetch happens from the user's browser and has not been observed.
- **Rate limiting.** The code paths exist and are wired to Redis keys, but the thresholds (10/hr creates per IP, 20/hr per domain, 1/60 s global OTP per email hash, 10/hr global OTP per email hash, 5 OTPs per message, 3 verify attempts per code) were not exercised by actually hitting them. Unit tests for the `ratelimit` module have not been written.
- **Expiry cleanup.** Redis TTLs are set correctly on create (`EX expirySeconds`), but I did not wait out (or fast-forward) an expiry and confirm the message returns B4 afterwards.
- **Disposable-domain blocking.** The blocklist has 15 entries and `isDisposableDomain` is called on create, but no test submitted `@mailinator.com` or similar.
- **Log redaction.** The pino redact config is configured to drop `email`, `ciphertext`, `kServer`, `otp`, headers, bodies. I did not grep container logs after a full flow to confirm nothing sensitive leaked.
- **Real Turnstile.** Only the dev sitekey (`1x00…AA` / secret `1x00…AA`, both of which always pass) was exercised. A production Cloudflare sitekey has not been integrated.
- **Real SMTP.** Only MailHog was used. Real SMTP credentials (Postmark/SES/Resend) have not been tried.
- **Unit tests.** `vitest` is a dev dependency but no tests have been written. Future work should cover: burn-on-fetch atomicity (simulate concurrent verifies), OTP attempt counting, rate-limit window behavior, uniform-error response shape, sensitive-content regex + entropy detection, AES-GCM + XOR key-split + Argon2id round-trips.
- **E2E.** Playwright scaffolding (`tests/e2e/`) exists as an empty directory; no tests have been written.
- **Production deploy.** HTTP-only compose is designed to sit behind an upstream TLS-terminating reverse proxy. That proxy is not in this repo and has not been exercised.

## Fixes made during testing

Three issues were found and fixed before declaring the build green:

1. **Variable shadowing in `messages.ts`.** The route handler destructured `email` from `deps` and again from the request body, so `email.sendOtp(email, code)` tried to call `sendOtp` on a string. Renamed the outer binding to `mailer`.
2. **Pino/Fastify type incompatibility.** Passing a pre-built `pino.Logger` to Fastify 5 via `loggerInstance` triggered a type mismatch (`BaseLogger.msgPrefix` missing). Switched to passing the logger config via `logger: loggerOptions(...)` and letting Fastify construct the logger.
3. **`Uint8Array` vs `BufferSource` under TS 5.6.** Stricter typing of `Uint8Array<ArrayBufferLike>` broke Web Crypto calls. Added a `toBufferSource` helper in `aesgcm.ts` and `passphrase.ts` that copies into a fresh `ArrayBuffer`.
4. **nginx `add_header` inheritance.** A `location = /index.html` block with its own `add_header` was suppressing every server-level security header. Moved all headers to `server` scope.
5. **`argon2-browser` / Vite incompatibility.** Replaced with `hash-wasm` as described above.

## Reproduction

```bash
# one-time local secrets
openssl rand 32 > secrets/kms_key
openssl rand 32 > secrets/email_hash_salt
chmod 600 secrets/kms_key secrets/email_hash_salt

# start
podman compose -f compose.yaml -f compose.dev.yaml up --build

# smoke test the API (replace `test@example.com` as desired)
curl -sS -X POST http://localhost:8080/api/messages \
  -H "Content-Type: application/json" \
  -d '{"ciphertext":"SGVsbG8=","nonce":"MTIzNDU2Nzg5MDEy","kServer":"a3MtdGVzdA==","email":"test@example.com","expirySeconds":3600,"hasPassphrase":false,"captchaToken":"x"}'

# read OTP from MailHog
curl -sS http://localhost:8025/api/v2/messages | python3 -c "import json,sys,re;print(re.search(r'code is:\s*(\d{6})',json.load(sys.stdin)['items'][0]['Content']['Body']).group(1))"

# browse
open http://localhost:8081   # compose form
open http://localhost:8025   # MailHog inbox
```
