import nodemailer, { type Transporter } from "nodemailer";
import type { AppConfig } from "../config.js";
import type { EmailSender } from "./index.js";
import { buildOtpEmail } from "./template.js";

export function createSmtpSender(cfg: AppConfig): EmailSender {
  if (!cfg.smtpUrl) {
    throw new Error("createSmtpSender called without smtpUrl");
  }
  const transport: Transporter = nodemailer.createTransport(cfg.smtpUrl);

  return {
    async sendOtp(to, code) {
      const { subject, text, html } = buildOtpEmail({ code, to, publicBaseUrl: cfg.publicBaseUrl });
      await transport.sendMail({ from: cfg.smtpFrom, to, subject, text, html });
    },
  };
}
