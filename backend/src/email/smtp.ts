import nodemailer, { type Transporter } from "nodemailer";
import type { AppConfig } from "../config.js";

export interface EmailSender {
  sendOtp(to: string, code: string): Promise<void>;
}

export function createEmailSender(cfg: AppConfig): EmailSender {
  const transport: Transporter = nodemailer.createTransport(cfg.smtpUrl);

  return {
    async sendOtp(to, code) {
      await transport.sendMail({
        from: cfg.smtpFrom,
        to,
        subject: "Your SecureDrop verification code",
        text: `Your SecureDrop verification code is: ${code}\n\nThis code expires in 10 minutes. If you did not request this, you can ignore it.\n`,
      });
    },
  };
}
