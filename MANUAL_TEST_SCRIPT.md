# SecureDrop — Manual Test Script

A hands-on walk-through covering the key scenarios. Each test has **Steps** and **Expected**. Tick each box as you go.

## Setup (do once)

- [ ] Generate local secrets if not already present:
  ```bash
  openssl rand 32 > secrets/kms_key
  openssl rand 32 > secrets/email_hash_salt
  chmod 600 secrets/kms_key secrets/email_hash_salt
  ```
- [ ] Start the stack:
  ```bash
  podman compose -f compose.yaml -f compose.dev.yaml up --build
  ```
- [ ] Open two browser windows side-by-side:
  - **Compose window** (regular): http://localhost:8081
  - **MailHog inbox**: http://localhost:8025
- [ ] Open browser DevTools in the compose window (Network tab + Console). Leave them open throughout.

---

## 1. Happy path — no passphrase

### 1.1 Compose (A1)

- [ ] The page shows "SecureDrop" nav, a large empty textarea with "Paste your secret here…", a recipient email field, an "Options" disclosure, a Turnstile widget, and a "Create Secure Link" button.
- [ ] The submit button is **disabled** until the textarea and email are both filled in.
- [ ] Paste a simple secret like `ordinary note, no credentials` into the textarea. The character counter updates (e.g., `29 / 10,000`).
- [ ] Enter `alice@example.com` in the recipient field.
- [ ] The Turnstile widget self-completes within ~1s (dev test key always passes).
- [ ] Click **Create Secure Link**. Brief status text flickers through "Encrypting…" → "Creating link…".

**Expected**: You land on A2 (Link Created).

### 1.2 Link Created (A2)

- [ ] Heading: "Your secure link is ready."
- [ ] The link is displayed in a monospaced read-only input shaped like `http://localhost:8081/m/{token}#{K_link}`.
- [ ] The token after `/m/` is a long random base64url string.
- [ ] The fragment after `#` is another base64url string.
- [ ] Summary row shows: `Recipient: a●●●●●●@example.com`, `Expires: in 24 hours`, `Passphrase: none`.
- [ ] Click **Copy**. The button text briefly changes to "Copied!" with a check icon, then reverts.
- [ ] Paste into another text field (or `pbpaste`) and confirm the full link with fragment is on the clipboard.

### 1.3 Retrieve (B1 → B2 → B5)

- [ ] Open the copied link in a **new private/incognito window** (so no cookies/state are shared).
- [ ] **Immediately check the browser URL bar.** The `#...` fragment should be **gone** — URL should show only `http://localhost:8081/m/{token}`. ← This is the F-18a fragment scrub.
- [ ] The page shows "Someone sent you a secure message." with an email input.
- [ ] Enter `alice@example.com` and click **Send Verification Code**.
- [ ] Switch to MailHog (http://localhost:8025). A new email appears from `no-reply@securedrop.local` to `alice@example.com` with a 6-digit code in the body.
- [ ] Type the code into the six digit boxes. Each digit auto-advances focus.
- [ ] When the 6th digit is entered, the form auto-submits.

**Expected**: Page transitions to B5 (Message Revealed).

### 1.4 Reveal (B5)

- [ ] Heading: "Your secure message." with a big **Reveal Message** button.
- [ ] Click **Reveal Message**. The secret appears in a bordered monospaced container. A small timer shows "Auto-hiding in 60s" with a **Pause** link next to it.
- [ ] Content matches exactly what you sent. ✓ End-to-end crypto round-trip confirmed.
- [ ] Click **Copy**. The secret is on the clipboard.
- [ ] Click **Pause**. The countdown stops. Click **Resume**. It continues.
- [ ] Let the countdown expire. The message hides and a "Reveal again (1 remaining)" button appears.
- [ ] Click it. Message re-appears and counter starts again.
- [ ] After the second timer expires, the Reveal button is disabled and text reads "This message has been viewed and deleted."

### 1.5 Burn-on-fetch (F-19)

- [ ] Open the same link in **another new private window**.
- [ ] Go through the email + OTP flow again (check MailHog for the new code — but there won't be one because the message is gone). Actually: enter email → OTP will never arrive (uniform response silently skips sending for dead messages).
- [ ] Wait ~30 seconds. **No email arrives in MailHog** for this second attempt.
- [ ] Instead, try a random 6-digit code anyway. Result should be "That code is invalid or expired."

**Alternative quicker check**: Send a **third** retrieve attempt by reloading and entering a wrong code — you will always see `invalid_or_expired`. The key property: the message is gone, but the UI never reveals that distinctly.

---

## 2. Passphrase flow (B3, F-09)

### 2.1 Create with passphrase

- [ ] Back on the compose page, paste a new secret: `second test message`.
- [ ] Recipient: `bob@example.com`.
- [ ] Click **Options** to expand. Choose `1 hour` expiry. Type a passphrase: `correct horse battery staple`.
- [ ] Submit. You get a link. Summary shows `Passphrase: required`.

### 2.2 Retrieve with correct passphrase

- [ ] Open the link in a private window.
- [ ] Enter `bob@example.com`, get the OTP from MailHog, enter it.
- [ ] Page goes to B3 with "One more step. This message is protected with a passphrase."
- [ ] Enter `correct horse battery staple` and click **Decrypt Message**.
- [ ] **Expected**: ~1–3 seconds of delay (Argon2id WASM downloading + hashing on first use), then the message reveals (B5) with the correct plaintext.

### 2.3 Retrieve with WRONG passphrase (B4a)

- [ ] Repeat step 2.1: create a new link with passphrase `open-sesame` and recipient `carol@example.com`.
- [ ] Open in a private window, verify email, enter OTP.
- [ ] On B3, enter the **wrong** passphrase: `nottheone`. Click **Decrypt Message**.
- [ ] **Expected**: After ~1–3s of Argon2 work, the page transitions to **B4a — Unable to decrypt this message**.
- [ ] Copy that link again and try to open it in yet another window. The message is **gone** — you get B4 (message unavailable) after entering email + OTP. This confirms burn-on-fetch fires even when passphrase decryption fails.

---

## 3. Sensitive-content detection (F-04a)

### 3.1 Amber banner appears

- [ ] Go back to compose (/).
- [ ] Paste this into the textarea (an actual-looking AWS access key):
  ```
  AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
  AWS_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
  ```
- [ ] **Expected**: An amber (warning-tone) banner appears below the textarea: "This looks like highly sensitive data. We recommend adding a passphrase…"
- [ ] Also try a PEM private key header:
  ```
  -----BEGIN RSA PRIVATE KEY-----
  ```
  Banner should also appear.
- [ ] Now type a plain sentence like "My favorite color is blue." The banner disappears.

### 3.2 Confirmation dialog when proceeding without passphrase

- [ ] Paste the AWS key pair again. Banner reappears.
- [ ] Recipient: `alice@example.com`. Leave passphrase empty (no Options expansion).
- [ ] Click **Create Secure Link**.
- [ ] **Expected**: A modal dialog appears: "Send without passphrase? — This message appears to contain sensitive credentials…" with two buttons:
  - **Go back and add one** (primary)
  - **Send without passphrase** (secondary/ghost)
- [ ] Click **Go back and add one**. Dialog closes, Options section auto-expands so you can see the passphrase field. Dialog does NOT fire again until you re-trigger submission.
- [ ] Type a passphrase, click **Create Secure Link** again. This time it submits directly (no dialog) because a passphrase is present.
- [ ] Repeat once more, but click **Send without passphrase** this time. The message creates without a passphrase — friction, not a blocker. ✓

---

## 4. Configurable expiry (F-03)

- [ ] Compose a message, expand Options, pick **1 hour**. Submit.
- [ ] A2 summary says "Expires: in 1 hours" (note the minor plural bug — acceptable).
- [ ] Repeat with **7 days** — summary should show "Expires: in 7 days".
- [ ] Short-expiry check: compose with **1 hour** expiry. **Don't view it.** Fast-forward the Redis TTL:
  ```bash
  TOKEN=... # copy the token segment from the link
  podman exec secureonetimemessage_redis_1 redis-cli PEXPIRE msg:$TOKEN 1
  ```
- [ ] Open the link in a private window → B1. Enter email, get... no email (backend silently drops the OTP because the message is gone). Enter any code → `invalid_or_expired`. ✓ Expired messages look identical to burned ones.

---

## 5. Share and mailto

On the A2 screen after creating a message:

- [ ] Click **Share…**. On Chrome/Safari desktop this may open a native share sheet; on Firefox it will fall back to copying. Either is acceptable.
- [ ] Click **Email it**. The system's mail client opens a draft with:
  - Subject: `Secure message for you`
  - Body: `I've sent you a secure message. Open this link and verify your email to view it: {link}\n\nDo not forward this link — it's intended only for you.`
- [ ] Close without sending.

---

## 6. Code entry edge cases (B2)

### 6.1 Wrong code shakes and clears

- [ ] Create a new message. Open the link in a private window. Get to B2.
- [ ] Type six wrong digits (e.g., `000000`).
- [ ] **Expected**: Boxes shake (~400 ms animation), error text "That code is invalid or expired. Please try again.", and boxes clear.

### 6.2 Paste support

- [ ] On B2, copy the string `123456` into the clipboard.
- [ ] Click into the first box, press `⌘V` (Mac) or `Ctrl+V`.
- [ ] **Expected**: All six digits populate across the boxes. Form auto-submits (wrong code, shakes).

### 6.3 Three strikes

- [ ] On B2, submit three consecutive **wrong** 6-digit codes.
- [ ] **Expected**: After the third failure, the OTP is invalidated. Request a new code (Resend) and try the correct one — it should work.

### 6.4 Resend cooldown

- [ ] On B2, click **Didn't receive it? Send a new code.**
- [ ] **Expected**: The link is disabled for 30 seconds and shows `Resend in 29s`, counting down. A new OTP email arrives in MailHog. Old codes stop working once the new one is issued.

### 6.5 Backspace navigation

- [ ] Type three digits. Press **Backspace**. Focus moves back one box and the digit clears.

---

## 7. Abuse prevention

### 7.1 Disposable email blocking (F-25)

- [ ] On compose, enter recipient `someone@mailinator.com`.
- [ ] Submit.
- [ ] **Expected**: Error banner "This recipient email domain isn't supported."

### 7.2 Invalid email

- [ ] Try `not-an-email`. HTML5 validation should reject before submit.
- [ ] Try `foo@bar` (no TLD). Server returns `invalid_request` → friendly banner "Something in your submission was rejected."

### 7.3 Per-IP rate limit (10 creates/hour, F-26)

Easiest to exercise via curl so you don't have to click 11 times:

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/messages \
    -H "Content-Type: application/json" \
    -d '{"ciphertext":"YQ==","nonce":"MTIzNDU2Nzg5MDEy","kServer":"YWFhYWFhYWFhYWFhYWFhYQ==","email":"rate@example.com","expirySeconds":3600,"hasPassphrase":false,"captchaToken":"x"}'
done
```

- [ ] **Expected**: First 10 requests return `201`. Requests 11 and 12 return `429`.

To reset for further testing: `podman exec secureonetimemessage_redis_1 redis-cli FLUSHALL`.

### 7.4 Global OTP flood protection (F-17-global)

- [ ] Create two messages targeting the **same** recipient email.
- [ ] On each, click through to the OTP-request step within the same minute.
- [ ] **Expected**: Only the first OTP request actually triggers a MailHog email. The second is silently rate-limited (the UI still shows "sent" — enumeration-resistant).

---

## 8. Terminal & error states

### 8.1 Invalid token (B4)

- [ ] Visit `http://localhost:8081/m/notarealtoken12345` in a private window.
- [ ] Enter any email. Enter any 6-digit code.
- [ ] **Expected**: After jitter delay, "That code is invalid or expired" on B2. There's no way to tell from the UI that the token never existed. ✓ Enumeration resistance.

### 8.2 No fragment in URL

- [ ] Visit `http://localhost:8081/m/{any-token}` **without** the `#...` suffix.
- [ ] **Expected**: The Retrieve page silently falls through to B4 (Message Unavailable) because there's no K_link to decrypt with.

### 8.3 Network error banner

- [ ] On B1, stop the backend container: `podman stop secureonetimemessage_backend_1`.
- [ ] Enter email and click **Send Verification Code**.
- [ ] **Expected**: Red banner "Network error — Something went wrong. Please try again."
- [ ] Restart: `podman start secureonetimemessage_backend_1`. Retry succeeds.

---

## 9. Security properties

### 9.1 No cookies are set

- [ ] DevTools → Application → Cookies → `localhost:8081`. Should be **empty** throughout the whole flow (sender and recipient). ✓ NF-05.

### 9.2 Security headers

- [ ] DevTools → Network → click the `index.html` request → Headers tab. Confirm presence of:
  - `Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; …`
  - `Referrer-Policy: no-referrer`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Cache-Control: no-store`

### 9.3 No third-party scripts on retrieval page (NF-02)

- [ ] On the Retrieve page (`/m/{token}`), DevTools → Network → filter `JS`.
- [ ] **Expected**: Only requests to `localhost:8081` (app bundles) and `fonts.googleapis.com` / `fonts.gstatic.com` (fonts). No analytics, no Turnstile (Turnstile is only loaded on the compose page).

### 9.4 Fragment never sent to server

- [ ] DevTools → Network → clear → paste a secure link into a fresh tab → watch the initial `GET /m/{token}` request.
- [ ] **Expected**: The Request URL in DevTools shows only `/m/{token}`, not `#K_link`. (Browsers strip the fragment before sending, and you can confirm by looking at the `X-Forwarded-For` / request line in the backend/nginx logs: `podman logs secureonetimemessage_backend_1 | tail -5`.)

### 9.5 Log redaction (NF-06)

- [ ] After running the full happy path, dump backend logs:
  ```bash
  podman logs secureonetimemessage_backend_1 2>&1 | tail -200 | grep -iE "alice|ciphertext|otp|ksrv|kserver" || echo "clean"
  ```
- [ ] **Expected**: Prints `clean`. No email addresses, no ciphertext, no OTP codes, no key material in logs.

---

## 10. Accessibility spot-checks (§7 of design brief)

- [ ] **Keyboard only**: `/` page — can you Tab through textarea → email → Options button → expiry buttons → passphrase → Turnstile → submit? All focus outlines visible?
- [ ] **Screen-reader labels**: DevTools → Elements → hover the OTP digit boxes. Each should have `aria-label="Digit 1 of 6"` through `"Digit 6 of 6"`.
- [ ] **Reveal button**: on B5 the big Reveal button responds to Enter/Space when focused.
- [ ] **Auto-hide timer pause**: the "Pause" link after reveal works via keyboard (Tab to it, Enter). This is required because the brief says the timer must be pausable or dismissable for users who need more time.

---

## 11. Responsive (mobile viewport)

- [ ] DevTools → device toolbar → choose iPhone 13 (390×844).
- [ ] Compose page column goes full-width with ~16–20 px horizontal padding.
- [ ] OTP digit boxes are each ≥ 48×48 px (tap target).
- [ ] Textarea is comfortable to type in, no tiny text.
- [ ] **Share…** button on A2 triggers the OS share sheet (on a real device/emulator) — desktop Chrome falls back to copy.

---

## Reset between scenarios

Flush Redis to clear rate limiters and stuck messages:

```bash
podman exec secureonetimemessage_redis_1 redis-cli FLUSHALL
```

Clear MailHog inbox:

```bash
curl -X DELETE http://localhost:8025/api/v1/messages
```

## Teardown

```bash
podman compose -f compose.yaml -f compose.dev.yaml down
```

---

## Summary checklist

- [ ] §1 Happy path (compose → share → retrieve → burn)
- [ ] §2 Passphrase — correct and incorrect
- [ ] §3 Sensitive content detection + confirmation dialog
- [ ] §4 Configurable expiry + TTL-based deletion
- [ ] §5 Share and mailto buttons
- [ ] §6 Code entry (shake, paste, three strikes, resend, backspace)
- [ ] §7 Abuse prevention (disposable domains, rate limits)
- [ ] §8 Terminal states (B4, B4a, network error)
- [ ] §9 Security properties (no cookies, headers, no 3rd-party scripts, fragment not sent, log redaction)
- [ ] §10 Accessibility spot-checks
- [ ] §11 Responsive on mobile viewport

Any failure — capture a screenshot and the DevTools Network entry, then file an issue or ping me to fix it.
