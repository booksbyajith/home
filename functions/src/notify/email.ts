import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage } from './types.js';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

let cached: { key: string; transport: Transporter } | null = null;

export async function sendEmail(cfg: SmtpConfig, msg: EmailMessage): Promise<void> {
  const key = `${cfg.host}|${cfg.port}|${cfg.user}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      transport: nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.port === 465,
        auth: { user: cfg.user, pass: cfg.pass },
      }),
    };
  }
  await cached.transport.sendMail({
    from: cfg.from,
    to: msg.to.join(', '),
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    attachments: msg.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
}
