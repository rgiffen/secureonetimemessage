import type { AppConfig } from "../config.js";
import type { EmailSender } from "./index.js";
import { buildOtpEmail } from "./template.js";

const RESEND_URL = "https://api.resend.com/emails";

export function createResendSender(cfg: AppConfig): EmailSender {
  if (!cfg.resendApiKey) {
    throw new Error("createResendSender called without resendApiKey");
  }
  const apiKey = cfg.resendApiKey;
  const from = cfg.smtpFrom;

  return {
    async sendOtp(to, code) {
      const { subject, text, html } = buildOtpEmail(code);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      let res: Response;
      try {
        res = await fetch(RESEND_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to, subject, text, html }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        const err = new Error(`resend http ${res.status}`) as Error & { code: string };
        err.code = `HTTP_${res.status}`;
        throw err;
      }
    },
  };
}
