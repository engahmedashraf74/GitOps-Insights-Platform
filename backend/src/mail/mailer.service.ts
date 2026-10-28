import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as nodemailer from 'nodemailer';

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type MailFailureCategory =
  | 'smtp-auth'
  | 'smtp-timeout'
  | 'smtp-rejected'
  | 'smtp-failed';

export type MailSendResult =
  | { status: 'accepted'; messageId: string }
  | { status: 'skipped'; category: 'smtp-config-missing' }
  | { status: 'failed'; category: MailFailureCategory };

type MailTransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
};

const MESSAGE_ID = /^<?[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9.-]{1,80}>?$/;

export const mailTransport = {
  create(options: MailTransportOptions) {
    return nodemailer.createTransport(options);
  },
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  configured(): boolean {
    return Boolean(
      process.env.SMTP_HOST?.trim() &&
        process.env.SMTP_USER?.trim() &&
        process.env.SMTP_PASS?.trim(),
    );
  }

  renderVerifyEmail(email: string, verifyUrl: string): OutboundEmail {
    const templatePath = join(__dirname, 'templates', 'verify-email.html');

    let html: string;
    try {
      html = readFileSync(templatePath, 'utf8');
    } catch {
      html = defaultVerifyHtml();
    }

    html = html
      .replaceAll('{{email}}', escapeHtml(email))
      .replaceAll('{{verifyUrl}}', escapeHtml(verifyUrl));

    return {
      to: email,
      subject: 'Verify your GitOps Insights email',
      html,
      text: `Verify your GitOps Insights account: ${verifyUrl}`,
    };
  }

  async send(message: OutboundEmail): Promise<MailSendResult> {
    if (!this.configured()) {
      this.logger.warn(
        '[mail] Mail provider was not called (category=smtp-config-missing)',
      );
      return { status: 'skipped', category: 'smtp-config-missing' };
    }

    const port = smtpPort(process.env.SMTP_PORT);
    const transporter = mailTransport.create({
      host: process.env.SMTP_HOST!.trim(),
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASS!.trim(),
      },
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 12_000,
    });

    try {
      const info = await transporter.sendMail({
        from:
          process.env.MAIL_FROM ||
          'GitOps Insights <noreply@gitopsinsights.com>',
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      const messageId = safeMessageId(info?.messageId);
      this.logger.log(
        `[mail] SMTP accepted the message (category=smtp-accepted messageId=${messageId})`,
      );
      return { status: 'accepted', messageId };
    } catch (error) {
      const category = classifyMailError(error);
      this.logger.error(
        `[mail] SMTP did not accept the message (category=${category})`,
      );
      return { status: 'failed', category };
    }
  }
}

export function classifyMailError(error: unknown): MailFailureCategory {
  const err = error as { code?: unknown; responseCode?: unknown };
  const code = typeof err?.code === 'string' ? err.code : '';
  const responseCode =
    typeof err?.responseCode === 'number' ? err.responseCode : 0;
  if (code === 'EAUTH' || responseCode === 535 || responseCode === 534) {
    return 'smtp-auth';
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
    return 'smtp-timeout';
  }
  if (code === 'EENVELOPE' || responseCode >= 500) {
    return 'smtp-rejected';
  }
  return 'smtp-failed';
}

export function safeMessageId(value: unknown): string {
  if (typeof value !== 'string') return 'present';
  const trimmed = value.trim();
  return MESSAGE_ID.test(trimmed) ? trimmed : 'present';
}

function smtpPort(value: string | undefined): number {
  const parsed = Number(value || 587);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return 587;
  return parsed;
}

function defaultVerifyHtml(): string {
  return `<!DOCTYPE html>
<html>
<body style="background:#f4f6f8;color:#0f172a;font-family:sans-serif;padding:32px">
<h1>Verify your email</h1>
<p>Hi {{email}}, confirm this address to activate GitOps Insights.</p>
<p>
<a href="{{verifyUrl}}" style="color:#0f766e">
Verify email
</a>
</p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
