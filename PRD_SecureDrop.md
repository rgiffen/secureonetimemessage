# Product Requirements Document: SecureDrop

## One-Time Secure Message Transfer

**Version:** 1.3
**Date:** April 12, 2026
**Status:** Draft

---

## 1. Overview

SecureDrop is a web application that allows users to securely send sensitive information — such as passwords, API keys, or account credentials — to a specific recipient identified by their email address. The sender creates an encrypted message and receives a secure link to share via any channel they choose (Slack, SMS, email, etc.). The recipient must verify ownership of the designated email address before viewing. Messages are viewable only once and automatically destroyed after being read or after a configurable expiry window.

## 2. Problem Statement

People regularly need to share sensitive information such as passwords, account credentials, and API keys with colleagues, clients, or family members. Common methods — email, chat, SMS — leave sensitive data sitting in message histories indefinitely, exposed to breaches, unauthorized access, and compliance violations.

Existing solutions either lack recipient verification (anyone with the link can view the secret) or require both parties to use the same platform. There is a need for a simple, secure tool that combines one-time viewing with verified recipient identity.

## 3. Goals

- Allow a sender to transmit sensitive text to a specific person, identified by email, with confidence that only someone with access to the recipient's email (and optional passphrase) can read it.
- Ensure the message cannot be read more than once and does not persist after viewing.
- Require no account creation for either sender or recipient.
- Minimize the attack surface by ensuring the server never has access to plaintext message content.

## 4. Non-Goals

- File or attachment sharing (text-only in v1).
- Long-term secret storage or vault functionality.
- Sender authentication or identity verification.
- Mobile-native apps (responsive web only in v1).

## 5. User Roles

**Sender** — The person who has sensitive information to share. They initiate the flow by composing a message and specifying the recipient's email address.

**Recipient** — The person who receives the secure link from the sender, verifies their identity via email, and views the message exactly once.

## 6. User Flows

### 6.1 Sender Flow

1. Sender navigates to the SecureDrop home page.
2. Sender enters the secret message into a text field.
3. Sender enters the recipient's email address (used for OTP verification, not for delivery).
4. Sender optionally sets an expiry window (default: 24 hours).
5. Sender optionally sets a passphrase for additional protection.
6. Sender completes a CAPTCHA challenge.
7. Sender clicks "Send Securely."
8. Browser generates encryption key K, splits it into K_link and K_server, encrypts the message, and sends the encrypted blob + K_server + recipient email hash to the server. K_link never leaves the browser.
9. Server stores the encrypted blob and wrapped K_server, and returns a URL token.
10. Browser constructs the full secure link: `https://securedrop.example/m/{token}#{K_link}`.
11. Sender is presented with the complete link and options to copy it, or share it via system share sheet. The sender shares the link with the recipient through any channel they choose (Slack, SMS, email, etc.).

### 6.2 Recipient Flow

1. Recipient receives the secure link from the sender via any channel (Slack, SMS, email, etc.).
2. Recipient clicks the link. The browser extracts K_link from the URL fragment and immediately scrubs the fragment from the address bar using `history.replaceState()`.
3. System prompts the recipient to enter the email address the sender designated.
4. System sends a one-time verification code to that email address.
5. Recipient enters the verification code.
6. If the sender set a passphrase, the recipient is prompted to enter it.
7. Server returns the encrypted blob and K_server in the HTTP 200 response, then immediately and permanently deletes both from storage (burn on fetch).
8. Browser combines K_link + K_server to reconstruct K and decrypts the message client-side.
9. The decrypted message is displayed behind a "Reveal" button.
10. If the recipient revisits the link, they see a generic notice that the message is unavailable.

### 6.3 Expiry Flow

1. If the recipient does not view the message within the configured expiry window, the encrypted message and K_server are permanently deleted from storage.
2. If the recipient clicks the link after expiry, they see a generic notice identical to the one shown for already-viewed or non-existent messages.

## 7. Functional Requirements

### 7.1 Message Creation

| ID | Requirement |
|----|-------------|
| F-01 | The sender must be able to enter a plaintext secret message up to 10,000 characters. |
| F-02 | The sender must provide exactly one recipient email address. |
| F-03 | The sender may set a message expiry from the following options: 1 hour, 12 hours, 24 hours (default), 48 hours, 7 days. |
| F-04 | The sender may set an optional passphrase that the recipient must enter to view the message. |
| F-04a | If the message content matches patterns associated with high-sensitivity data (e.g., private keys beginning with `-----BEGIN`, cloud credentials matching `AKIA...`, strings resembling passwords), the UI must apply progressive friction: (1) Display an amber warning banner recommending a passphrase. (2) If the sender dismisses the warning and clicks "Create Secure Link" without adding a passphrase, show a confirmation dialog: "This message appears to contain sensitive credentials. Are you sure you want to send it without a passphrase?" with "Go back and add one" (primary) and "Send without passphrase" (secondary/muted) actions. This is friction, not a blocker — the sender can always proceed. |
| F-05 | On submission, the server generates a unique, unguessable URL token (minimum 256 bits of entropy) and returns it to the sender's browser. |

### 7.2 Encryption

| ID | Requirement |
|----|-------------|
| F-06 | Messages must be encrypted client-side in the sender's browser before transmission to the server. |
| F-07 | Encryption must use AES-256-GCM with a unique, randomly generated 256-bit key and 96-bit nonce per message. |
| F-08 | The encryption key (K) must be split into two shares: K_link (placed in the URL fragment by the sender's browser, never sent to the server) and K_server (encrypted with a server-held wrapping key and stored alongside the message). After the recipient completes email verification, the server returns K_server to the browser, which combines both shares to reconstruct K. This ensures that neither the link delivery channel alone nor server compromise alone is sufficient to decrypt the message. |
| F-09 | If the sender provides a passphrase, the reconstructed key must be further unwrapped using a key derived from the passphrase via Argon2id with the following minimum parameters: memory cost ≥ 64 MB, time cost ≥ 2 iterations, parallelism = 1. |
| F-10 | The server must never receive, log, or store the plaintext message or the full encryption key. The server may store K_server in wrapped form only for the lifetime of the message. |

### 7.3 Link Generation and Delivery

| ID | Requirement |
|----|-------------|
| F-11 | On message creation, the browser must construct the full secure link locally, including the URL token (from the server response) and K_link in the URL fragment. The server never sees or handles K_link. |
| F-12 | The UI must present the sender with the complete link and provide: (a) a "Copy Link" button, (b) an OS-level share sheet integration, and (c) an optional `mailto:` button that opens the sender's email client with a pre-composed message containing the link and a warning not to forward it. |
| F-13 | The server must not send any notification email to the recipient. The sender is solely responsible for delivering the link through the channel of their choice. |

### 7.4 Recipient Verification

| ID | Requirement |
|----|-------------|
| F-14 | Before displaying the message, the system must verify the recipient's email address by sending a one-time 6-digit verification code. |
| F-15 | The verification code must expire after 10 minutes. |
| F-16 | The system must allow a maximum of 3 verification attempts per code before invalidating it and requiring a new one. |
| F-17 | The system must allow a maximum of 5 verification code requests per message to prevent abuse. |
| F-17-global | The system must enforce a global rate limit on OTP emails per recipient email hash: maximum 1 OTP per 60 seconds and 10 OTPs per hour per email address, across all messages. This prevents attackers from creating many messages targeting the same recipient to flood their inbox. |
| F-17a | Verification attempts must be bound to the tuple of (message ID, IP address, session). Parallel sessions must not receive independent attempt budgets. |
| F-17b | All verification failures must return a uniform error response ("Invalid or expired code") regardless of whether the message exists, has been viewed, or has expired. Response timing must include random jitter (50–200ms) to prevent timing-based enumeration. |

### 7.5 Message Viewing and Destruction

| ID | Requirement |
|----|-------------|
| F-18 | Once the recipient successfully verifies their email (and enters the passphrase if required), the server returns the encrypted message payload and K_server in the HTTP 200 response. |
| F-18a | The very first JavaScript to execute on the retrieval page must extract K_link from the URL fragment, store it in a local variable, and immediately call `window.history.replaceState()` to scrub the `#` and all fragment content from the URL bar. This must occur before any other scripts, analytics, or extensions can read the URL. |
| F-19 | Message destruction must follow a burn-on-fetch model: the server must permanently delete the encrypted blob and K_server from storage immediately upon successfully transmitting the 200 response containing the payload. Deletion must occur regardless of whether the client successfully receives or decrypts the payload. If the recipient's browser crashes during delivery, the message is lost — this is the accepted trade-off to guarantee that a secret can never be fetched twice. |
| F-20 | The message must be displayed behind a "Reveal" button. Once revealed, the message auto-hides after 60 seconds with the option to re-reveal once. A "Copy to clipboard" button is provided. These are UX nudges, not security controls. |
| F-21 | Subsequent visits to the same URL must return a "This message has already been viewed or does not exist" notice. The response must not distinguish between viewed, expired, and non-existent messages. |

### 7.6 Abuse Prevention

| ID | Requirement |
|----|-------------|
| F-24 | Message creation must require a CAPTCHA challenge (e.g., Cloudflare Turnstile, hCaptcha). |
| F-25 | The system should reject recipient email addresses from known disposable email domains on a best-effort basis, using a maintained blocklist. This is a supplementary control, not a primary defense — disposable domain lists are inherently incomplete and attackers rotate domains constantly. The primary abuse controls are CAPTCHA (F-24), rate limiting (F-26), and global OTP rate limiting (F-17-global). |
| F-26 | Rate limiting on message creation must be enforced per IP (10/hour) and per recipient email domain (20/hour) to prevent targeted spam. |

### 7.7 Expiry and Cleanup

| ID | Requirement |
|----|-------------|
| F-22 | A background process must permanently delete expired messages from storage. |
| F-23 | Expired message URLs must return a generic "This message has already been viewed or does not exist" notice, identical to the response for viewed or non-existent messages. |

## 8. Non-Functional Requirements

### 8.1 Security

| ID | Requirement |
|----|-------------|
| NF-01 | All traffic must be served over HTTPS with TLS 1.3. |
| NF-02 | The server must enforce strict Content-Security-Policy (no third-party scripts permitted), X-Frame-Options, `Referrer-Policy: no-referrer`, and other security headers. The retrieval page must load zero third-party JavaScript — no analytics, no tracking, no external dependencies — to minimize the window in which the URL fragment is exposed. |
| NF-03 | Rate limiting must be applied to all endpoints: message creation (10/hour per IP), verification code requests (5 per message), and verification attempts (3 per code). |
| NF-04 | URL tokens must be generated using a cryptographically secure random number generator. |
| NF-05 | The application must not use cookies or tracking of any kind for recipients. |
| NF-06 | Server logs must never contain message content, encryption keys, URL fragments, or recipient email addresses in plaintext. Recipient email addresses must be stored as salted hashes at rest. |
| NF-07 | The system must undergo a third-party security audit before public launch. |
| NF-07a | All error responses on retrieval and verification endpoints must be uniform and must not reveal whether a message exists, has been viewed, or has expired. |
| NF-08a | The wrapping key used to encrypt K_server at rest must be managed via a cloud KMS (e.g., AWS KMS, GCP Cloud KMS) or a hardware security module (HSM). The wrapping key must never be stored in application code, environment variables, or on disk in plaintext. A key rotation policy must be defined: new messages use the current wrapping key; existing messages remain decryptable via prior key versions until they expire. Rotation interval: at least every 90 days, or immediately upon suspected compromise. |

### 8.2 Performance

| ID | Requirement |
|----|-------------|
| NF-08 | Message creation must complete in under 2 seconds. |
| NF-09 | Message retrieval and decryption must complete in under 3 seconds. |
| NF-10 | The system must support at least 1,000 concurrent active messages. |

### 8.3 Reliability

| ID | Requirement |
|----|-------------|
| NF-11 | The system must have 99.9% uptime. |
| NF-12 | Message deletion (after viewing or expiry) must be guaranteed — if deletion fails, the system must retry and alert. |

### 8.4 Compliance

| ID | Requirement |
|----|-------------|
| NF-13 | The system must not store any personal data beyond what is required for active message delivery. |
| NF-14 | All stored data (encrypted messages, email addresses, verification codes) must be purged within 1 hour of message viewing or expiry. |

## 9. Technical Architecture (Recommended)

**Frontend:** Single-page application (React or similar). All encryption and decryption happens in-browser using the Web Crypto API. Argon2id is not natively supported by Web Crypto; the implementation must bundle an Argon2id WebAssembly (WASM) module. If passphrase-based key derivation performance exceeds the NF-09 budget on low-end devices, PBKDF2 with ≥600,000 iterations (natively supported) may be offered as a fallback.

**Backend:** Stateless API server (Node.js, Go, or similar). Responsible for storing encrypted blobs, managing OTP verification codes, and sending OTP emails. The server never handles or sends the secure link — link construction happens entirely in the frontend.

**Storage:** Ephemeral key-value store (Redis with TTL or similar). No relational database needed — all records are short-lived by design.

**Email:** Transactional email provider (e.g., Postmark, SES, Resend) for OTP verification code delivery only. The server does not send notification emails to recipients.

**Infrastructure:** Containerized deployment behind a reverse proxy with TLS termination. No persistent disk storage required.

## 10. Security Model Summary

```
Sender's Browser                    Server                    Recipient's Browser
──────────────────                  ──────                    ───────────────────
                                                              
1. Generate AES-256 key (K)                                   
2. Split K → K_link + K_server                                
3. Encrypt message with K                                     
4. Send encrypted blob         ──▶ 5. Store encrypted blob   
   + K_server (wrapped)              + wrapped K_server       
   + recipient email hash            + email hash             
   (K_link NEVER sent)          6. Return URL token           
                             ◀─────────┘                      
7. Construct full link:                                       
   /m/{token}#{K_link}                                        
8. Share link with recipient                                  
   via Slack, SMS, email,     ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─▶  9. Click link
   etc. (out-of-band)                                        10. Extract K_link,
                                                                  scrub fragment
                                                              11. Enter email address
                                   12. Send OTP to email  ──▶ 13. Enter OTP
                                   14. Verify OTP              
                                   15. Return encrypted    ──▶ 16. Combine K_link
                                       blob + K_server             + K_server → K
                                   16. DELETE blob +           17. Decrypt message
                                       K_server               18. Display behind
                                       (burn on fetch)            "Reveal" button
```

**Key design properties:**

**Server never has access to the full decryption key or plaintext.** The server stores only the encrypted blob and a wrapped K_server share. K_link never touches the server. Link construction happens entirely in the sender's browser. Note: the server does hold a wrapping key used to encrypt K_server at rest — this is a centralized secret and a high-value target. See NF-08a for wrapping key management requirements.

**True multi-channel security.** The link (containing K_link) travels through whatever channel the sender chooses. The OTP travels through the recipient's email. An attacker must compromise both the link delivery channel and the recipient's email to access the message. This is genuine two-factor access, unlike the v1.0/v1.1 design where both the link and the OTP traveled through the same email channel.

**Burn on fetch.** The server permanently deletes the encrypted blob and K_server the moment it transmits the 200 response. There is no grace window, no retry, and no ACK. If the recipient's browser crashes at the exact moment of delivery, the message is lost forever. This is the accepted trade-off: a message can never be fetched twice under any circumstances, including by an attacker who blocks client-side acknowledgments.

**Remaining caveat:** If an attacker intercepts the link from the delivery channel and also has access to the recipient's email (for the OTP), they can access the message. The optional passphrase adds a third factor shared through yet another channel to mitigate this.

## 11. Open Questions

1. **Sender notifications:** Should the sender be notified when the recipient views the message? This would require collecting the sender's email, which adds data retention considerations.
2. **Multiple recipients:** Should v1 support sending the same message to multiple email addresses, each with independent verification and one-time viewing?
3. **Audit logging:** Should the system log metadata (timestamps, IP hashes) for security investigations, and if so, for how long? This trades privacy for incident response capability.
4. **Self-hosting:** Should the architecture prioritize easy self-hosting for organizations with strict data residency requirements?

## 11a. Resolved Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Passphrase encouragement | Yes — progressive friction. Amber warning on detection of high-sensitivity patterns, plus a confirmation dialog if the sender proceeds without a passphrase. Not a blocker. | Balances adoption with stronger defaults for the highest-risk messages. Most users ignore passive nudges under time pressure; the confirmation dialog adds just enough friction to trigger a conscious decision. |
| Browser extension exposure | Yes — mitigate. The first JavaScript to execute on the retrieval page must extract the fragment and call `window.history.replaceState()` to scrub the `#` and everything after it from the URL bar. Retrieval page must load zero third-party scripts. Server must set `Referrer-Policy: no-referrer`. | Prevents fragment from persisting in browser history, being read by extensions, or leaking via referrer headers. A theoretical race condition remains (malicious extension reads URL before JS runs) but is mitigated to the extent possible without browser-level changes. |
| Disposable email blocking | Best-effort only — not a primary control. Blocklists are inherently incomplete. Primary abuse prevention relies on CAPTCHA, per-IP rate limiting, and global per-email OTP rate limiting. | Avoids false sense of security from an unreliable control. Keeps it in place as a supplementary layer without over-investing. |
| "Zero-knowledge" terminology | Replaced with "server never has access to the full decryption key or plaintext." Wrapping key management requirements added (NF-08a). | The server does hold a wrapping key for K_server, which means strict zero-knowledge is not accurate. Precise language prevents overpromising to security-conscious users. |

## 12. Success Metrics

- **Delivery rate:** Percentage of created messages that are successfully viewed before expiry (target: >80%).
- **Time to view:** Median time between message creation and recipient viewing (target: <4 hours).
- **Verification success rate:** Percentage of recipients who complete email verification on first attempt (target: >90%).
- **Zero data incidents:** No plaintext message exposure in server logs, storage, or backups.

## 13. Milestones

| Phase | Scope | Timeline |
|-------|-------|----------|
| Alpha | Core flow: create, share link, verify OTP, view, destroy. Split-key encryption. Burn-on-fetch deletion. CAPTCHA on creation. Fragment scrubbing. Single expiry option (24h). No passphrase. | 4 weeks |
| Beta | Configurable expiry, optional passphrase with Argon2id (WASM), sensitive-content detection nudge, disposable email blocking, rate limiting, enumeration resistance, security hardening. | +3 weeks |
| Launch | Security audit, monitoring and alerting, documentation, landing page. | +3 weeks |

## 14. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | April 12, 2026 | Initial draft. |
| 1.1 | April 12, 2026 | Incorporated security review #1. Key changes: split-key encryption model (F-08), two-phase delete with ACK (F-19), abuse prevention requirements (F-24–F-26), OTP enumeration resistance (F-17a–F-17b), uniform error responses (NF-07a), salted email hashing (NF-06), Argon2id parameter minimums (F-09), GCM nonce requirements (F-07). Softened "only that person" claim in goals. Moved abuse prevention from open question to requirement. |
| 1.2 | April 12, 2026 | Incorporated security review #2. Critical fix: resolved logical impossibility where server was required to email K_link without ever receiving it. Switched to sender-shared link model (Path A) — server is now a pure storage + OTP engine and never sends the secure link. Replaced two-phase ACK delete with burn-on-fetch (F-19) to eliminate the block-ACK attack vector. Simplified F-07 nonce language. Added Argon2id WASM implementation note with PBKDF2 fallback guidance. Added `history.replaceState()` fragment scrubbing requirement. Resolved open questions on passphrase encouragement and browser extension exposure. Added sensitive-content detection UX nudge. Moved passphrase to Beta phase. Alpha timeline reduced back to 4 weeks (simpler link flow offsets split-key complexity). |
| 1.3 | April 12, 2026 | Incorporated security review #3 (minor hardening). Replaced "zero-knowledge server" with precise language acknowledging wrapping key (review item 1). Added wrapping key management requirement NF-08a (KMS/HSM, 90-day rotation). Added global per-email OTP rate limiting F-17-global to prevent inbox flooding harassment (review item 2). Softened disposable email blocking F-25 to best-effort supplementary control (review item 3). Added `Referrer-Policy: no-referrer` and zero third-party scripts to NF-02 (review item 4). Upgraded passphrase nudge F-04a to progressive friction with confirmation dialog for high-entropy secrets (review item 5). |
