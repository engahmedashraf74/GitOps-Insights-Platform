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

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

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
      .replaceAll('{{verifyUrl}}', verifyUrl);

    return {
      to: email,
      subject: 'Verify your GitOps Insights email',
      html,
      text: `Verify your GitOps Insights account: ${verifyUrl}`,
    };
  }

  async send(message: OutboundEmail): Promise<void> {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from =
      process.env.MAIL_FROM || 'GitOps Insights <noreply@gitopsinsights.com>';

    if (!host || !user || !pass) {
      this.logger.warn(
        `[mail] SMTP configuration missing. Email not sent to ${message.to}`,
      );
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        auth: {
          user,
          pass,
        },
      });

      await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      this.logger.log(
        `[mail] Email sent successfully to ${message.to}`,
      );
    } catch (error) {
      this.logger.error(
        `[mail] Failed to send email to ${message.to}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

function defaultVerifyHtml(): string {
  return `<!DOCTYPE html>
<html>
<body style="background:#0b0d0f;color:#f4f4f5;font-family:sans-serif;padding:32px">
<h1>Verify your email</h1>
<p>Hi {{email}}, confirm this address to activate GitOps Insights.</p>
<p>
<a href="{{verifyUrl}}" style="color:#2dd4bf">
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
