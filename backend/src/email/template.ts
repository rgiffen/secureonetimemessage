// OTP email content. Kept in its own module so SMTP and Resend senders emit
// identical multipart (text + html). Designed for robust rendering across
// Gmail / iCloud / Outlook (no web fonts, no images, inline CSS, table layout)
// and for deliverability: personalised (recipient address in body), explicit
// sender hostname, and framing that makes the purpose clear to both humans
// and spam classifiers.

export interface OtpEmailInput {
  code: string;
  to: string;
  publicBaseUrl: string; // e.g. https://securedrop.example.com
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function buildOtpEmail({ code, to, publicBaseUrl }: OtpEmailInput) {
  const subject = "Your SecureDrop verification code";
  const host = hostnameOf(publicBaseUrl);

  const text =
    `SecureDrop verification code for ${to}\n` +
    "\n" +
    `Your code: ${code}\n` +
    "\n" +
    `Someone used SecureDrop at ${host} to send a one-time encrypted\n` +
    "message to this address. To view it, paste this code on the page\n" +
    "where you clicked the link. Don't share this code with anyone.\n" +
    "\n" +
    "The code expires in 10 minutes. The message can only be viewed\n" +
    "once, and is then permanently deleted.\n" +
    "\n" +
    "If you didn't expect this, no action is needed — you won't receive\n" +
    "further emails about it. Unused messages are deleted automatically.\n" +
    "\n" +
    "--\n" +
    `Sent by SecureDrop at ${host}.\n` +
    "The server never sees the message content: it is encrypted in the\n" +
    "sender's browser and destroyed as soon as you read it.\n";

  const preheader = `Your SecureDrop code is ${code}. It expires in 10 minutes.`;

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
              <p style="margin:0 0 8px 0;font-size:13px;color:#757c7d;line-height:1.5;">
                Verification code for <strong style="color:#2d3435;font-weight:600;">${to}</strong>
              </p>
              <h1 style="margin:0 0 20px 0;font-size:20px;font-weight:600;color:#2d3435;line-height:1.3;">
                Your SecureDrop code
              </h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:#5a6061;">
                Someone used SecureDrop at <strong style="color:#2d3435;font-weight:600;">${host}</strong> to send a one-time encrypted message to this address. To view it, paste the code below on the page where you clicked the link. Don't share this code with anyone.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="background-color:#f2f4f4;border-left:3px solid #455f88;padding:28px 16px;">
                    <div style="font-family:'SF Mono','Menlo','Consolas',monospace;font-size:32px;font-weight:700;letter-spacing:0.25em;color:#455f88;">${code}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;color:#5a6061;line-height:1.5;">
                The code expires in 10 minutes. The message can only be viewed once, and is then permanently deleted.
              </p>
              <p style="margin:12px 0 0 0;font-size:13px;color:#5a6061;line-height:1.5;">
                If you didn't expect this, no action is needed &mdash; you won't receive further emails about it. Unused messages are deleted automatically.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 4px 4px 4px;font-size:12px;color:#757c7d;line-height:1.5;">
              Sent by SecureDrop at <strong style="color:#5a6061;font-weight:600;">${host}</strong>. The server never sees the message content &mdash; it is encrypted in the sender's browser and destroyed as soon as you read it.
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
