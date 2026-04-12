# SecureDrop — Manual Test Script (Prod)

A hands-on walk-through covering the key scenarios against the deployed production stack at **https://test-randy.stu.researchatmun.ca**. Each test has **Steps** and **Expected**. Tick each box as you go.

> If you want to run this against the local dev stack (with MailHog) instead, see the git history for the local-targeted version of this script.

## Setup (do once)

- [ ] Confirm the stack is healthy:
  ```bash
  curl -sS https://test-randy.stu.researchatmun.ca/api/health
  # -> {"status":"ok"}
  ```
- [ ] Flush prod Redis so rate-limit keys and any stale messages don't interfere with the test run:
  ```bash
  ssh -p 3322 test-randy@stu.researchatmun.ca \
    "podman exec project_redis_1 redis-cli FLUSHALL"
  ```
- [ ] In a second terminal, tail backend logs so you can correlate behaviour with server output:
  ```bash
  ssh -p 3322 test-randy@stu.researchatmun.ca '~/logs'
  ```
- [ ] Open one browser window pointed at https://test-randy.stu.researchatmun.ca and open DevTools (Network tab + Console). Leave them open throughout.
- [ ] Have a real email inbox you control ready (Gmail/Outlook preferred — iCloud aggressively junks the Resend sends from `mail.barelyintelligentlife.ca` until its reputation builds). If you must use iCloud, add `no-reply@mail.barelyintelligentlife.ca` to your Contacts and mark any early test OTPs "Not Junk" before relying on inbox landing.

### Prod-specific notes

- **The Turnstile widget is real** (not the always-pass dev test key). You will see an actual Cloudflare challenge — usually managed/invisible, sometimes an interactive check. This means you cannot batch CAPTCHA-gated requests quickly.
- **Emails go to your real inbox** via Resend. Watch for both the Inbox and the Spam folder.
- **Container names on prod are `project_*`** (e.g. `project_backend_1`), not `secureonetimemessage_*`.
- Backend is not reachable from the public internet except via the frontend nginx proxy at `/api/*`.

---

## 1. Happy path — no passphrase

### 1.1 Compose (A1)

- [ ] The page shows "SecureDrop" nav, a large empty textarea with "Paste your secret here…", a recipient email field, an "Options" disclosure, a Turnstile widget, and a "Create Secure Link" button.
- [ ] The submit button is **disabled** until the textarea and email are both filled in.
- [ ] Paste a simple secret like `ordinary note, no credentials` into the textarea. The character counter updates (e.g., `29 / 10,000`).
- [ ] Enter your **real** recipient email in the recipient field (an inbox you can check).
- [ ] Wait for the Turnstile widget to complete. If it shows an interactive challenge, solve it.
- [ ] Click **Create Secure Link**. Brief status text flickers through "Encrypting…" → "Creating link…".

**Expected**: You land on A2 (Link Created).

### 1.2 Link Created (A2)

- [ ] Heading: "Your secure link is ready."
- [ ] The link is displayed in a monospaced read-only input shaped like `https://test-randy.stu.researchatmun.ca/m/{token}#{K_link}`.
- [ ] The token after `/m/` is a long random base64url string.
- [ ] The fragment after `#` is another base64url string.
- [ ] Summary row shows: `Recipient: {masked}`, `Expires: in 24 hours`, `Passphrase: none`.
- [ ] Click **Copy**. The button text briefly changes to "Copied!" with a check icon, then reverts.
- [ ] Paste into another text field (or `pbpaste`) and confirm the full link with fragment is on the clipboard.

### 1.3 Retrieve (B1 → B2 → B5)

- [ ] Open the copied link in a **new private/incognito window** (so no cookies/state are shared).
- [ ] **Immediately check the browser URL bar.** The `#...` fragment should be **gone** — URL should show only `https://test-randy.stu.researchatmun.ca/m/{token}`. ← This is the F-18a fragment scrub.
- [ ] The page shows "Someone sent you a secure message." with an email input.
- [ ] Enter the same real recipient email and click **Send Verification Code**.
- [ ] Switch to your real inbox. Within ~10 s, an email arrives from `no-reply@mail.barelyintelligentlife.ca` (subject "Your SecureDrop verification code") with a 6-digit code. Check Spam if it isn't in Inbox.
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

### 1.4a Reveal auto-hide survives tab backgrounding (wall-clock timer)

The 60 s auto-hide is computed from a wall-clock deadline, not a decrementing counter, so it keeps advancing while the tab is hidden (browsers throttle `setTimeout` in background tabs). This test confirms that.

- [ ] Create and retrieve a fresh message. Click **Reveal Message**. The timer shows "Auto-hiding in 60 s".
- [ ] Immediately switch to a different browser tab (don't minimize the window — just switch tabs). Set a stopwatch or wall-clock timer for **75 seconds**.
- [ ] After 75 s, switch back to the SecureDrop tab.
- [ ] **Expected**: the message is already hidden and the "Reveal again (1 remaining)" button is showing. You should not see "Auto-hiding in 55 s" or similar residual countdown.
- [ ] Click **Reveal again**. Timer starts at 60 again. Switch tabs for ~20 s then return.
- [ ] **Expected**: the displayed count reflects the real elapsed time (roughly "Auto-hiding in 40 s"), not ~55 s.
- [ ] Reveal once more, click **Pause**, switch tabs for 2 minutes, come back, click **Resume**.
- [ ] **Expected**: the full paused duration is preserved — counter picks up where it left off, not reset and not advanced.

### 1.5 Burn-on-fetch (F-19)

- [ ] Open the same link in **another new private window**.
- [ ] Enter your email → click **Send Verification Code**. **No new email arrives** (the message is gone, so the server silently declines to send an OTP — uniform response).
- [ ] Wait ~60 seconds. Nothing shows up in your inbox for this second attempt.
- [ ] Instead, try a random 6-digit code anyway. Result should be "That code is invalid or expired."

**Alternative quicker check**: Send a **third** retrieve attempt by reloading and entering a wrong code — you will always see `invalid_or_expired`. The key property: the message is gone, but the UI never reveals that distinctly.

### 1.6 Silent OTP suppression on dead links (F-17b, F-21, F-23)

This confirms the intended behavior for **any** dead link — used, expired, or never-existed. The server must silently decline to send an OTP, both on the initial request AND on "Send a new code," without disclosing the link's state to the caller.

- [ ] Note the timestamp — you're about to confirm *no* emails arrive for a dead-link flow.
- [ ] Take the link you burned in §1.5 (or any other expired/invalid link) and open it in a new private window.
- [ ] On B1, enter your real recipient email and click **Send Verification Code**. Page advances to B2 showing "Check your email."
- [ ] Wait ~60 seconds. **Your inbox must not receive a new OTP email during this window.** (Check Inbox and Spam.)
- [ ] On B2, click **Didn't receive it? Send a new code.** The 30 s cooldown starts.
- [ ] After cooldown, click **Resend** again. Wait another ~60 s.
- [ ] **No OTP email still** — dead links never trigger an OTP, even on resend.
- [ ] Cross-check with backend logs (the `~/logs` tail you started): you should see two `request-otp` incoming requests but no `otp send failed` and no successful send log for this token.
- [ ] Type any 6-digit code (`000000`) and submit. Result: "That code is invalid or expired."

This is the same UX as if the code were simply wrong. The recipient won't learn the link is dead from server behavior — only from the cumulative experience of no email arriving.

---

## 2. Passphrase flow (B3, F-09)

### 2.1 Create with passphrase

- [ ] Back on the compose page, paste a new secret: `second test message`.
- [ ] Recipient: your real email.
- [ ] Click **Options** to expand. Choose `1 hour` expiry. Type a passphrase: `correct horse battery staple`.
- [ ] Submit. You get a link. Summary shows `Passphrase: required`.

### 2.2 Retrieve with correct passphrase

- [ ] Open the link in a private window.
- [ ] Enter your real email, wait for the OTP email, enter the code.
- [ ] Page goes to B3 with "One more step. This message is protected with a passphrase."
- [ ] Enter `correct horse battery staple` and click **Decrypt Message**.
- [ ] **Expected**: ~1–3 seconds of delay (Argon2id WASM downloading + hashing on first use), then the message reveals (B5) with the correct plaintext.

### 2.3 Retrieve with WRONG passphrase (B4a)

- [ ] Repeat step 2.1: create a new link with passphrase `open-sesame` and your real recipient email.
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
- [ ] Recipient: your real email. Leave passphrase empty (no Options expansion).
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
- [ ] Short-expiry check: compose with **1 hour** expiry. **Don't view it.** Copy the token from the link, then fast-forward the Redis TTL on prod:
  ```bash
  TOKEN=...   # the token segment from the link
  ssh -p 3322 test-randy@stu.researchatmun.ca \
    "podman exec project_redis_1 redis-cli PEXPIRE msg:$TOKEN 1"
  ```
- [ ] Open the link in a private window → B1. Enter email. Inbox stays empty — backend silently drops the OTP because the message is gone. Click **Send a new code** on B2: still no email. Enter any code → `invalid_or_expired`. ✓ Expired messages look identical to burned ones, including on resend. (See §1.6 for the full silent-OTP test.)

---

## 5. Share and mailto

On the A2 screen after creating a message:

- [ ] Click **Share…**. On Chrome/Safari desktop this may open a native share sheet; on Firefox it will fall back to copying. Either is acceptable.
- [ ] Click **Email it**. The system's mail client opens a draft with:
  - To: pre-filled with the recipient email you entered on compose
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
- [ ] **Expected**: The link is disabled for 30 seconds and shows `Resend in 29s`, counting down. A new OTP email arrives in your inbox. Old codes stop working once the new one is issued.

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

This exercises the rate limit but **requires a valid Turnstile token** on prod (no always-pass test key). The easy path is to drive it through the UI: click Submit 11+ times in rapid succession (each requires a fresh Turnstile challenge). The cleaner curl path below will fail because we can't mint a real Turnstile token from the command line — use the UI approach, or temporarily skip this test.

- [ ] (UI path) Submit 11 messages in rapid succession. **Expected**: the 11th shows "Too many messages from this address recently. Try again later." (429 from the API).
- [ ] (Alternative) To verify the limit is in place, check the Redis counter mid-run:
  ```bash
  ssh -p 3322 test-randy@stu.researchatmun.ca \
    "podman exec project_redis_1 redis-cli KEYS 'rl:create:ip:*'"
  ```
  After a few real creates you should see the `rl:create:ip:{your-ip}` key with a value counting up.

To reset for further testing:
```bash
ssh -p 3322 test-randy@stu.researchatmun.ca \
  "podman exec project_redis_1 redis-cli FLUSHALL"
```

### 7.4 Global OTP flood protection (F-17-global)

- [ ] Create two messages targeting the **same** real recipient email (yours).
- [ ] On each, click through to the OTP-request step within the same minute.
- [ ] **Expected**: Only the first OTP request actually delivers an email. The second is silently rate-limited (the UI still shows "sent" — enumeration-resistant). Your inbox gets exactly one OTP email in that minute.

---

## 8. Terminal & error states

### 8.1 Invalid token (B4)

- [ ] Visit `https://test-randy.stu.researchatmun.ca/m/notarealtoken12345` in a private window.
- [ ] Enter any email. Enter any 6-digit code.
- [ ] **Expected**: After jitter delay, "That code is invalid or expired" on B2. There's no way to tell from the UI that the token never existed. ✓ Enumeration resistance.

### 8.2 No fragment in URL

- [ ] Visit `https://test-randy.stu.researchatmun.ca/m/{any-token}` **without** the `#...` suffix.
- [ ] **Expected**: The Retrieve page silently falls through to B4 (Message Unavailable) because there's no K_link to decrypt with.

### 8.3 Network error banner

- [ ] On B1, stop the backend container on prod:
  ```bash
  ssh -p 3322 test-randy@stu.researchatmun.ca "podman stop project_backend_1"
  ```
- [ ] Enter email and click **Send Verification Code**.
- [ ] **Expected**: Red banner "Network error — Something went wrong. Please try again."
- [ ] Restart:
  ```bash
  ssh -p 3322 test-randy@stu.researchatmun.ca "podman start project_backend_1"
  ```
  Remember that nginx may have cached the previous backend's IP. If the frontend now returns 502s, also restart it:
  ```bash
  ssh -p 3322 test-randy@stu.researchatmun.ca "podman restart project_frontend_1"
  ```
- [ ] Retry succeeds.

---

## 9. Security properties

### 9.1 No cookies are set

- [ ] DevTools → Application → Cookies → `test-randy.stu.researchatmun.ca`. Should be **empty** throughout the whole flow (sender and recipient). ✓ NF-05.

### 9.2 Security headers

- [ ] DevTools → Network → click the `index.html` (or `/`) request → Headers tab. Confirm presence of:
  - `Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; …`
  - `Referrer-Policy: no-referrer`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Cache-Control: no-store`
  - Plus MUN's outer nginx may add `Strict-Transport-Security` — that's expected.

### 9.3 No third-party scripts on retrieval page (NF-02)

- [ ] On the Retrieve page (`/m/{token}`), DevTools → Network → filter `JS`.
- [ ] **Expected**: Only requests to `test-randy.stu.researchatmun.ca` (app bundles) and `fonts.googleapis.com` / `fonts.gstatic.com` (fonts). No analytics, no Turnstile (Turnstile is only loaded on the compose page).

### 9.4 Fragment never sent to server

- [ ] DevTools → Network → clear → paste a secure link into a fresh tab → watch the initial `GET /m/{token}` request.
- [ ] **Expected**: The Request URL in DevTools shows only `/m/{token}`, not `#K_link`. (Browsers strip the fragment before sending.) Confirm by inspecting backend logs for the request:
  ```bash
  ssh -p 3322 test-randy@stu.researchatmun.ca \
    "podman logs project_backend_1 2>&1 | tail -5"
  ```

### 9.5 Log redaction (NF-06)

- [ ] After running the full happy path, dump backend logs and grep for anything sensitive:
  ```bash
  ssh -p 3322 test-randy@stu.researchatmun.ca \
    "podman logs project_backend_1 2>&1 | tail -200" \
    | grep -iE "your-email|ciphertext|otp code|kserver|[0-9]{6}" || echo "clean"
  ```
  (Replace `your-email` with the local part of the address you used in the test run.)
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

## 12. Dark mode

### 12.1 Toggle, persistence, and no-flash

- [ ] Start in a private/incognito window (so localStorage is empty). Make sure your OS is in **light** mode.
- [ ] Load the compose page. It should render in the light ("Light Sentinel") palette — warm near-white background `#f9f9f9`, deep blue primary `#455f88`.
- [ ] Click the sun/moon icon in the top-right of the nav. The UI flips to the dark ("Obsidian Vault") palette — deep charcoal background `#10141a`, light-blue primary `#b2c5ff`, light on-surface text.
- [ ] DevTools → Application → Local Storage → `securedrop.theme` should be `"dark"`.
- [ ] Reload the page. **Expected**: no flash of light content before dark applies. The page is dark from the first paint.
- [ ] Click the toggle again to return to light. Reload. No flash of dark content. Local storage is `"light"`.

### 12.2 System preference respected on first visit

- [ ] Clear localStorage (DevTools → Application → Storage → Clear site data).
- [ ] Switch your OS to **dark** mode (System Settings → Appearance).
- [ ] Reload in a private window. **Expected**: site starts in dark mode (no `securedrop.theme` key yet; `prefers-color-scheme: dark` wins).
- [ ] Switch OS to **light** mode and reload without touching the toggle. Site starts in light mode.
- [ ] Click the toggle to explicitly pick dark. Now switch OS to light mode and reload. Site stays dark — explicit preference beats system preference.

### 12.3 Full flow in dark mode

- [ ] With dark mode active, walk through §1 end to end (compose → link → retrieval → reveal → burn). Watch for any element that looks wrong: unreadable text, thin strokes, hidden borders, white rectangles, button labels invisible, form field backgrounds indistinguishable from the page.
- [ ] Specifically check:
  - [ ] Compose textarea — placeholder visible, typed text visible, character counter visible.
  - [ ] Monospaced link field on A2 — link text visible against the container background, Copy button readable.
  - [ ] B2 code entry boxes — digits readable, focused box has a clear indicator.
  - [ ] B5 reveal container — the payload code block has enough contrast against the card, the countdown and Pause affordance are legible.
  - [ ] B4 / B4a terminal screens — headings readable, not washed out.

### 12.4 Turnstile theme swap

- [ ] On the compose page in **light** mode, let the Turnstile widget render. It should be the light theme (white box, dark text).
- [ ] Click the theme toggle to switch to dark. The Turnstile widget should re-render in its dark theme (dark box, light text) within a second.
- [ ] Toggle back to light. Widget flips back to the light theme.
- [ ] **Regression check**: now solve the Turnstile challenge. Once the widget shows a green check / success state, click the theme toggle. The widget should **not** re-render / reset itself — the earned token must survive the theme change. If it re-renders (goes back to the challenge state), that's a regression.

### 12.5 Dark-mode banners

- [ ] Trigger the sensitive-content amber banner in dark (paste `AKIAIOSFODNN7EXAMPLE` into the compose textarea). Banner text should be clearly legible against its amber-900 background.
- [ ] Trigger the error banner (stop the backend per §8.3 and attempt to send a verification code on B1). Red banner must be readable.
- [ ] Accessibility spot-check: use DevTools "Inspect accessibility" or a contrast extension on the banner text. All three banner tones should show ≥ 4.5:1 contrast ratio on dark backgrounds.

### 12.6 Fonts legibility bump

- [ ] In dark mode, small text (helper text under form fields, the §A2 metadata grid, footer copy, uppercase labels) should read clearly without feeling spindly. If any small text feels distractingly thin, note it.
- [ ] Italic text (if any appears — some helper lines use italic) should not look too bold compared to surrounding body text.

---

## Reset between scenarios

Flush prod Redis to clear rate limiters and stuck messages:

```bash
ssh -p 3322 test-randy@stu.researchatmun.ca \
  "podman exec project_redis_1 redis-cli FLUSHALL"
```

(Your real inbox is its own reality — you'll need to empty it manually if old OTP emails are cluttering the view.)

---

## Summary checklist

- [ ] §1 Happy path (compose → share → retrieve → reveal → wall-clock timer → burn → silent OTP suppression on dead links)
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
- [ ] §12 Dark mode (toggle, persistence, no-flash, full flow in dark, Turnstile theme swap, banner contrast, font legibility)

Any failure — capture a screenshot and the DevTools Network entry, then file an issue or ping me to fix it.
