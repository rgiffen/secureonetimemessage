import nodemailer, { type Transporter } from "nodemailer";
import type { AppConfig } from "../config.js";
import type { EmailSender } from "./index.js";

export function createSmtpSender(cfg: AppConfig): EmailSender {
  if (!cfg.smtpUrl) {
    throw new Error("createSmtpSender called without smtpUrl");
  }
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
