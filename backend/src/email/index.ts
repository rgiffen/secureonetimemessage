import type { AppConfig } from "../config.js";
import { createSmtpSender } from "./smtp.js";
import { createResendSender } from "./resend.js";

export interface EmailSender {
  sendOtp(to: string, code: string): Promise<void>;
}

// Chooses the outbound email backend based on config.
// - If RESEND_API_KEY is set, use the Resend HTTP API (preferred in hosted
//   environments where outbound SMTP ports are filtered).
// - Otherwise use SMTP via nodemailer (MailHog in dev, any SMTP in prod).
export function createEmailSender(cfg: AppConfig): EmailSender {
  if (cfg.resendApiKey) {
    return createResendSender(cfg);
  }
  return createSmtpSender(cfg);
}
