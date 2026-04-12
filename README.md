# SecureDrop

One-time secure message transfer. Sender encrypts a secret in the browser, shares the resulting link through any channel, and the recipient proves ownership of the designated email via OTP before the server hands back the encrypted blob and destroys it (burn-on-fetch).

See `PRD_SecureDrop.md` and `SecureDrop_Design_Brief.md` for the full spec.

## Architecture

- **Frontend** (`frontend/`) — React + Vite + Tailwind. All encryption/decryption runs in-browser via Web Crypto + Argon2id WASM.
- **Backend** (`backend/`) — Fastify + TypeScript. Stateless API: stores encrypted blobs, manages OTP verification, sends OTP emails. Never sees plaintext or the full decryption key.
- **Storage** — Redis 7, no persistence. All records TTL-bound.
- **Email** — SMTP (MailHog in dev, real SMTP in prod).
- **KMS** — Pluggable interface; local backend (podman secret) in v1; AWS/GCP adapters stubbed for later.

## Running locally (podman)

1. Generate local secrets:

   ```bash
   openssl rand 32 > secrets/kms_key
   openssl rand 32 > secrets/email_hash_salt
   chmod 600 secrets/kms_key secrets/email_hash_salt
   ```

2. Start the stack (includes MailHog):

   ```bash
   podman compose -f compose.yaml -f compose.dev.yaml up --build
   ```

3. Open the app:
   - Compose page: http://localhost:8081
   - MailHog (view OTP emails): http://localhost:8025

## Production deploy

1. Copy `.env.example` to `.env`, fill in SMTP credentials, `PUBLIC_BASE_URL`, and real Turnstile keys from https://dash.cloudflare.com/?to=/:account/turnstile.
2. Generate `secrets/kms_key` and `secrets/email_hash_salt` as above.
3. Terminate TLS at an upstream reverse proxy (Caddy, nginx, Traefik, ALB). Point it at the `frontend` service on port 8081 for static assets and at `backend` on 8080 for `/api/*`.
4. `podman compose up --build -d`.

## Repo layout

```
backend/       Fastify API server
frontend/      React SPA (compose + retrieval flows)
design/stitch/ Stitch mockup HTML files (reference only)
secrets/       Local podman secrets (gitignored)
tests/         Backend unit tests + Playwright e2e
```
