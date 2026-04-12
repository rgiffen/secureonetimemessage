# SecureDrop — Visual & UX Design Brief

## What This Document Is

This is a design brief for a web application called SecureDrop. It provides everything a designer needs to create the complete visual and interaction design in Sketch. The companion PRD (provided separately) contains the full technical and security requirements — this document focuses on what the user sees and does.

---

## 1. Product Summary

SecureDrop lets someone securely share a secret (a password, API key, or sensitive note) with a specific person. The sender creates an encrypted message, gets a link, and shares that link however they like (Slack, text, email). The recipient opens the link, proves they own the email address the sender specified, and sees the message exactly once. Then it's gone forever.

No accounts. No sign-ups. No apps to install.

## 2. Target Users

**Primary:** developers, IT admins, and technical team leads who need to share credentials with colleagues, contractors, or clients.

**Secondary:** non-technical professionals (HR, finance, legal) who occasionally need to share sensitive information and have been told by IT to stop putting passwords in email.

The design should feel approachable enough for the secondary audience while signaling competence and seriousness to the primary audience.

## 3. Design Principles

**Trust through restraint.** This is a security tool. Every visual choice should reinforce that the product is careful, deliberate, and minimal. No decorative elements, no stock photography, no playful illustrations. Whitespace and typography do the heavy lifting.

**Calm confidence.** The UI should feel like a locked safe, not an alarm system. Avoid anxiety-inducing red warnings or aggressive security language. The tone is "we've got this handled" — not "DANGER: SENSITIVE DATA."

**One thing per screen.** Each step in the flow should present exactly one decision or action. No multi-column layouts, no sidebars, no tabs. The user's eye should never have to search for what to do next.

**Progressive disclosure.** Advanced options (expiry, passphrase) are available but not prominent. The default path should require zero configuration.

## 4. Brand & Visual Direction

### 4.1 Name & Logo

Product name: **SecureDrop** (working title — may change, so the logo should not be overly literal).

The logo should be a simple wordmark or a minimal abstract mark. Avoid lock icons, shield icons, or key icons — these are overused in security products and signal "enterprise software" rather than "modern utility."

### 4.2 Color Palette

Minimal palette. Suggest three tones:

- **Primary action color:** A single accent color for buttons and interactive elements. Consider a muted teal, deep blue, or similar — something that conveys trust without being corporate. Avoid bright greens (too "success"), reds (too "danger"), or purples (too "creative tool").
- **Neutral base:** Near-white background with dark charcoal text. Not pure white (#fff) — slightly warm or cool.
- **Status colors:** Subtle, desaturated tones for success (message sent), warning (passphrase recommended), and error (invalid code) states. These should feel informational, not alarming.

### 4.3 Typography

One typeface family, two weights maximum (regular and medium or semibold). A clean, modern sans-serif — Inter, Söhne, or similar. Monospaced secondary font for displaying secrets, verification codes, and the generated link.

### 4.4 Tone of Voice

UI copy should be:

- **Direct.** "Your message was created." Not "Awesome! Your super-secure message has been generated successfully!"
- **Concise.** Labels and instructions in as few words as possible.
- **Human but not casual.** "Share this link with your recipient" — not "Shoot this link over to your buddy."
- **Reassuring without over-explaining.** "Encrypted end-to-end. The server never sees your message." — not a paragraph about AES-256-GCM.

---

## 5. Screens & Flows

The application has two main flows (Sender and Recipient) plus a small number of terminal/status screens. Each is described below with layout guidance, content, and interaction notes.

---

### FLOW A: SENDER

#### Screen A1 — Home / Compose

This is the landing page and the message creation screen. They are the same screen — the user lands directly on the tool, not on a marketing page.

**Layout:**

- Centered single column, max-width ~560px.
- Top: Logo/wordmark, very small. No navigation.
- Main content area with the compose form.
- Footer: Minimal — link to "How it works" and "GitHub" or similar.

**Form elements (in order):**

1. **Message field.** Large, tall textarea (minimum 4 visible rows, expandable). Placeholder: "Paste your secret here..." Monospaced font inside the textarea. Character counter near bottom-right, subtle (e.g., "0 / 10,000").

2. **Recipient email field.** Standard text input. Label: "Recipient's email." Helper text below: "They'll need to verify this address before viewing."

3. **Advanced options** — collapsed by default behind a subtle toggle or disclosure link ("Options" or a chevron). When expanded, reveals:
   - **Expiry selector.** Small segmented control or dropdown. Options: 1 hour, 12 hours, 24 hours (selected by default), 48 hours, 7 days. Label: "Link expires after."
   - **Passphrase field.** Text input. Label: "Passphrase (optional)." Helper text: "Share this with the recipient separately — by phone or a different channel."

4. **Sensitive content warning (conditional).** If the message content matches patterns for private keys, cloud credentials, or password-like strings, a subtle inline banner appears below the message field. Warm/amber tone, not red. Icon: small info or shield icon. Text: "This looks like highly sensitive data. We recommend adding a passphrase." The banner should feel like a helpful suggestion, not a scolding. If the sender dismisses this and clicks "Create Secure Link" without adding a passphrase, a confirmation dialog must appear: heading "Send without passphrase?", body "This message appears to contain sensitive credentials. A passphrase adds an extra layer of protection.", with two actions: "Go back and add one" (primary button) and "Send without passphrase" (secondary/muted text link). The sender can always proceed — this is friction, not a blocker.

5. **CAPTCHA widget.** Inline CAPTCHA (e.g., Cloudflare Turnstile — the invisible or managed challenge type is preferred so it doesn't disrupt the flow).

6. **Submit button.** Full-width within the column. Label: "Create Secure Link." Primary action color. Should feel solid and confident — generous padding, medium font weight.

**Interaction notes:**

- The submit button should be disabled until the message field and email field are both populated.
- On submit, the button shows a loading state (spinner or progress indicator within the button). No full-page loading screen.
- All encryption happens client-side before anything is sent to the server. Consider a very brief, subtle status line during processing: "Encrypting..." → "Creating link..." — but keep it fast and minimal.

---

#### Screen A2 — Link Created (Success)

Replaces the compose form after successful creation. Same page layout (centered column), but the form is replaced with the result.

**Content:**

1. **Confirmation heading.** "Your secure link is ready." — check icon in the accent color, not green.

2. **The link.** Displayed in a monospaced, read-only input field with a prominent "Copy Link" button adjacent (icon + text). The link should be fully visible (no truncation) or wrap gracefully. The entire field should be click-to-select.

3. **Share options row.** Below the link field, a row of secondary action buttons:
   - "Share..." (triggers OS share sheet / Web Share API where supported)
   - "Email it" (opens a `mailto:` with the link pre-composed in the body, and a subject line like "Secure message for you")

4. **Informational summary.** A quiet block below with the details:
   - "Recipient: j●●●@example.com" (partially masked)
   - "Expires: in 24 hours"
   - "Passphrase: required" or "Passphrase: none"

5. **Reminder text.** Small, muted: "This link works once. After it's viewed, the message is permanently deleted."

6. **"Send another" link.** Small text link below everything to reset the form.

**Interaction notes:**

- After copying, the "Copy Link" button should briefly change to "Copied!" with a check icon, then revert after 2 seconds.
- The `mailto:` option should pre-populate: Subject: "Secure message for you" / Body: "I've sent you a secure message. Open this link and verify your email to view it: [link]\n\nDo not forward this link — it's intended only for you."

---

### FLOW B: RECIPIENT

#### Screen B1 — Email Verification Prompt

The recipient clicks the link and arrives here. The page should feel secure and official without being intimidating.

**Layout:**

- Same centered single column as the sender flow.
- Top: Logo/wordmark.

**Content:**

1. **Heading.** "Someone sent you a secure message."

2. **Subheading.** "To view it, verify your email address."

3. **Email input field.** Label: "Your email address." The recipient types in their email (they are not told what email the sender specified — this is intentional, to prevent enumeration).

4. **Submit button.** "Send Verification Code." Primary action color.

**Interaction notes:**

- On submit, the button shows a loading state, then transitions to Screen B2.
- The fragment (#K_link) has already been extracted and scrubbed from the URL bar before this screen renders. The URL bar should show only `securedrop.example/m/{token}` with no fragment.
- If the message has already been viewed, has expired, or doesn't exist, the server will still accept the email and pretend to send a code (uniform response). The recipient won't discover the message is gone until after entering the code — this is by design (enumeration resistance). Design Screen B4 for this case.

---

#### Screen B2 — Code Entry

**Content:**

1. **Heading.** "Check your email."

2. **Subheading.** "We sent a 6-digit code to j●●●@example.com" (partially masked version of what they entered).

3. **Code input.** Six individual digit boxes (like a PIN entry), auto-advancing focus. Large, easy to tap on mobile. Monospaced font.

4. **Submit button.** "Verify." Primary action color. Activates when all 6 digits are entered.

5. **Resend option.** Small text link below: "Didn't receive it? Send a new code." Include a subtle cooldown (disable for 30 seconds after sending, show countdown).

**Interaction notes:**

- Auto-submit when the 6th digit is entered (no need to click the button).
- On failure, shake the code boxes and show inline error: "That code is invalid or expired. Please try again." Clear the boxes. Do not indicate whether the message exists.
- Support paste — if the user pastes a 6-digit string, distribute it across the boxes.

---

#### Screen B3 — Passphrase Entry (Conditional)

Only shown if the sender set a passphrase. If no passphrase was set, skip directly to Screen B5.

**Content:**

1. **Heading.** "One more step."

2. **Subheading.** "This message is protected with a passphrase. The sender should have shared it with you separately."

3. **Passphrase input.** Standard password field with a show/hide toggle. Label: "Passphrase."

4. **Submit button.** "Decrypt Message." Primary action color.

**Interaction notes:**

- On incorrect passphrase, show inline error: "Incorrect passphrase." The message has already been burned on fetch at this point, so if the passphrase is wrong, the message is unrecoverable. This is a critical UX moment — see Screen B4a below.

---

#### Screen B4 — Message Unavailable (Terminal)

Shown when the message has already been viewed, has expired, doesn't exist, or the OTP was exhausted. The same screen for all cases (uniform response).

**Content:**

1. **Heading.** "This message is no longer available."

2. **Subheading.** "It may have already been viewed, or it may have expired."

3. **Suggestion.** "If you expected to find a message here, ask the sender to create a new one."

4. **"Create your own" link.** Links to the home page.

**Design notes:**

- Neutral tone. No error styling (no red). This is informational, not an error.
- Simple, centered, minimal. Small illustration or icon is acceptable here (e.g., an empty state icon) but not required.

---

#### Screen B4a — Passphrase Failed After Burn (Terminal)

This is a critical edge case. The message has already been deleted from the server (burn on fetch), but the recipient entered the wrong passphrase client-side. The message is now unrecoverable.

**Content:**

1. **Heading.** "Unable to decrypt this message."

2. **Subheading.** "The passphrase you entered didn't work, and this message can only be viewed once. It has been permanently deleted."

3. **Suggestion.** "Contact the sender and ask them to resend the message with the correct passphrase."

**Design notes:**

- This is a genuinely bad outcome for the user. The tone should be empathetic but clear. No blame language ("you entered the wrong passphrase" → instead "the passphrase didn't work").
- Consider offering a brief explanation: "For your security, messages are deleted immediately after delivery — even if decryption fails."

---

#### Screen B5 — Message Revealed

The secret is displayed. This is the payoff screen.

**Content:**

1. **Heading.** "Your secure message."

2. **The message itself.** Initially hidden behind a "Reveal Message" button (large, centered, primary action color). After clicking:
   - The message appears in a monospaced, bordered container with a subtle background tint (very light grey or a faint tinted wash). Generous padding.
   - A countdown timer appears at the top of the message container: "Auto-hiding in 58s..." — ticking down from 60. Muted text, small.
   - When the timer reaches zero, the message content is replaced with "Message hidden." and a "Reveal again (1 remaining)" button.
   - After the second reveal + auto-hide, the message is gone from the DOM entirely (client-side only — server already deleted it).

3. **"Copy to clipboard" button.** Positioned at the top-right of the message container. Changes to "Copied!" briefly after clicking.

4. **Post-message notice.** Below the message container, muted text: "This message has been permanently deleted from our servers."

**Design notes:**

- The message container should feel distinct from the rest of the UI — it's the "payload area." A very subtle border or shadow to set it apart.
- The auto-hide timer should not feel stressful. Small, muted, positioned unobtrusively. The user has a copy button if they need the content.

---

## 6. Responsive Behavior

The application must work well on mobile. Since the layout is a single centered column, the responsive adaptation is minimal:

- On viewports below 600px, the column should go full-width with horizontal padding (16–20px).
- The code entry boxes (Screen B2) should be large enough to tap comfortably — minimum 48px square.
- The share sheet button (Screen A2) should use the native Web Share API on mobile, which triggers the OS share drawer.
- The message textarea (Screen A1) should be comfortable to type in on mobile — avoid tiny text or cramped fields.

## 7. Accessibility Requirements

- All form inputs must have visible labels (not placeholder-only).
- Color contrast must meet WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text and UI components).
- The code entry boxes must work with screen readers — each box should be labeled (e.g., "Digit 1 of 6").
- Focus states must be clearly visible on all interactive elements.
- The "Reveal Message" interaction must be keyboard-accessible.
- Auto-hide timer must be pausable or dismissable for users who need more time.

## 8. States & Edge Cases to Design

| State | Screen | What to show |
|-------|--------|--------------|
| Empty form | A1 | Default state with placeholders |
| Sensitive content detected | A1 | Amber inline banner recommending passphrase |
| Passphrase skip confirmation | A1 (dialog) | Confirmation dialog when sending high-sensitivity content without passphrase |
| Creating link (loading) | A1 → A2 | Button loading state, brief status text |
| Link created | A2 | Full success state with link and share options |
| Link copied | A2 | "Copied!" confirmation on button |
| Entering email | B1 | Default state |
| Waiting for code | B2 | Default state with countdown on resend |
| Code resent | B2 | Brief inline confirmation "New code sent" |
| Wrong code | B2 | Shake + inline error |
| Too many attempts | B2 | Transition to B4 (message unavailable) |
| Passphrase prompt | B3 | Default state |
| Wrong passphrase (unrecoverable) | B3 → B4a | Empathetic error state |
| Message hidden (pre-reveal) | B5 | "Reveal Message" button |
| Message visible | B5 | Message + countdown + copy button |
| Message auto-hidden | B5 | "Reveal again (1 remaining)" |
| Message fully consumed | B5 | "This message has been viewed and deleted" |
| Message unavailable | B4 | Neutral informational state |
| Network error (any screen) | All | Inline banner: "Something went wrong. Please try again." |

## 9. What NOT to Design

- No marketing landing page, pricing page, or feature comparison (out of scope for v1).
- No account creation, login, or dashboard.
- No settings or preferences.
- No dark mode (defer to v2, unless trivial with CSS variables).
- No animations beyond subtle transitions (button states, screen changes). No parallax, no particle effects, no animated backgrounds.

## 10. Deliverables Requested

1. **High-fidelity mockups** for all screens listed above (A1, A2, B1, B2, B3, B4, B4a, B5) at desktop (1280px) and mobile (375px) widths.
2. **Component library** in Sketch: buttons (primary, secondary, disabled, loading), text inputs, the code entry component, the message display container, inline banners (warning, error, info), the link display + copy component.
3. **Color and type specification** — the final palette and type scale, documented.
4. **Interaction annotations** on each screen noting transitions, loading states, and conditional display logic.
