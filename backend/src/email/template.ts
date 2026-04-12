// OTP email content. Kept in its own module so SMTP and Resend senders emit
// identical multipart (text + html). Designed for robust rendering across
// Gmail / iCloud / Outlook (no web fonts, no images, inline CSS, table layout).

export function buildOtpEmail(code: string) {
  const subject = "Your SecureDrop verification code";

  const text =
    "Verify your email to view a secure message\n" +
    "\n" +
    "Someone used SecureDrop to send you a one-time encrypted message.\n" +
    "Enter this code on the page where you clicked the link:\n" +
    "\n" +
    `    ${code}\n` +
    "\n" +
    "This code expires in 10 minutes.\n" +
    "\n" +
    "If you didn't expect a secure message, you can safely ignore this\n" +
    "email — your inbox won't receive any further messages about it.\n" +
    "\n" +
    "--\n" +
    "SecureDrop never sees the contents of the message — it's encrypted\n" +
    "in the sender's browser, and deleted as soon as you read it.\n";

  const preheader =
    "Use this code to verify your email and view the secure message someone sent you.";

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#2d3435;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f9f9f9;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9f9f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 4px 24px 4px;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#2d3435;">
              SecureDrop
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e4e9ea;padding:40px 32px;">
              <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#2d3435;line-height:1.3;">
                Verify your email to view a secure message
              </h1>
              <p style="margin:0 0 32px 0;font-size:15px;line-height:1.5;color:#5a6061;">
                Someone used SecureDrop to send you a one-time encrypted message. Enter this code on the page where you clicked the link:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="background-color:#f2f4f4;border-left:3px solid #455f88;padding:28px 16px;">
                    <div style="font-family:'SF Mono','Menlo','Consolas',monospace;font-size:32px;font-weight:700;letter-spacing:0.25em;color:#455f88;">${code}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;color:#5a6061;line-height:1.5;">
                This code expires in 10 minutes.
              </p>
              <p style="margin:8px 0 0 0;font-size:13px;color:#5a6061;line-height:1.5;">
                If you didn't expect a secure message, you can safely ignore this email &mdash; your inbox won't receive any further messages about it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 4px;font-size:12px;color:#757c7d;line-height:1.5;">
              SecureDrop never sees the contents of the message &mdash; it's encrypted in the sender's browser, and deleted as soon as you read it.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
