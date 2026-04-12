# SecureDrop

One-time secure message transfer. Sender encrypts a secret in the browser, shares the resulting link through any channel, and the recipient proves ownership of the designated email via OTP before the server hands back the encrypted blob and destroys it (burn-on-fetch).

See `PRD_SecureDrop.md` and `SecureDrop_Design_Brief.md` for the full spec, and `MANUAL_TEST_SCRIPT.md` for the end-to-end walk-through.

## Architecture

- **Frontend** (`frontend/`) — React 18 + Vite + Tailwind. All encryption/decryption runs in-browser via Web Crypto. Argon2id (via `hash-wasm`) is used for the optional passphrase; PBKDF2 is wired as a fallback.
- **Backend** (`backend/`) — Fastify 5 + TypeScript on Node 22. Stateless API: stores encrypted blobs, manages OTP verification, dispatches OTP emails. Never sees plaintext or the full decryption key.
- **Storage** — Redis 7, no persistence. All records TTL-bound.
- **Email** — Resend HTTP API (preferred) or SMTP via `nodemailer` (MailHog in dev, any SMTP in prod). Backend picks automatically based on which env var is set.
- **KMS** — Pluggable interface. `LocalKms` reads a 32-byte wrapping key from a read-only bind mount (`./secrets/kms_key`). `AwsKms`/`GcpKms` ship as stubs for future cloud deploys.
- **Serving** — Frontend nginx serves the SPA and proxies `/api/*` to the backend over the internal podman network. Backend is never exposed to the host. TLS is expected to be terminated by an upstream reverse proxy.

## Running locally (podman)

1. Generate local secrets:

   ```bash
   openssl rand 32 > secrets/kms_key
   openssl rand 32 > secrets/email_hash_salt
   chmod 644 secrets/kms_key secrets/email_hash_salt
   ```

   `0644` (not `0600`) is intentional — the non-root `node` user inside the container needs read access. The containing `secrets/` directory inherits `~/`'s `0700` on a shared host so external users still can't traverse in.

2. Start the stack (includes MailHog):

   ```bash
   podman compose -f compose.yaml -f compose.dev.yaml up --build
   ```

3. Open the app:
   - Compose page: http://localhost:8081
   - MailHog (view OTP emails): http://localhost:8025

## Production deploy

1. Copy `.env.example` to `.env`. Fill in `PUBLIC_BASE_URL`, your Turnstile keys (https://dash.cloudflare.com/?to=/:account/turnstile), and **either**:
   - `RESEND_API_KEY=re_...` plus a `SMTP_FROM` on a Resend-verified domain — **recommended**, especially on hosts where outbound SMTP ports are filtered.
   - `SMTP_URL=smtp(s)://...` for any SMTP provider (the `RESEND_API_KEY` path takes precedence when both are set).
2. Generate `secrets/kms_key` and `secrets/email_hash_salt` as above.
3. Add your production hostname to the Turnstile widget's **Hostname management** list in the Cloudflare dashboard, otherwise the CAPTCHA widget won't render.
4. Terminate TLS at an upstream reverse proxy (Caddy, nginx, Traefik, cloud LB) pointing at the `frontend` service's host port (frontend listens on `3000` inside the container). The backend is only reachable on the internal podman network.
5. `podman compose up --build -d`.

## Repo layout

```
backend/       Fastify API server
frontend/      React SPA + nginx container (compose + retrieval flows)
design/stitch/ Stitch mockup HTML files (reference only)
secrets/       Local bind-mounted secrets (gitignored)
tests/         Placeholder dirs for vitest + Playwright suites
```

## Key docs

- `PRD_SecureDrop.md` — full product + security requirements
- `SecureDrop_Design_Brief.md` — UX / visual spec
- `MANUAL_TEST_SCRIPT.md` — a hands-on test walk-through covering all key scenarios
