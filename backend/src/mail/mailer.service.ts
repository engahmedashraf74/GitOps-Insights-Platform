import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

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
    if (!host) {
      this.logger.log(
        `[mail] SMTP not configured. Verification email for ${message.to}: ${message.text}`,
      );
      return;
    }
    this.logger.log(
      `[mail] SMTP_HOST is set but a provider adapter is not wired yet. Queued to ${message.to} subject="${message.subject}"`,
    );
  }
}

function defaultVerifyHtml(): string {
  return `<!DOCTYPE html><html><body style="background:#0b0d0f;color:#f4f4f5;font-family:sans-serif;padding:32px">
  <h1>Verify your email</h1>
  <p>Hi {{email}}, confirm this address to activate GitOps Insights.</p>
  <p><a href="{{verifyUrl}}" style="color:#2dd4bf">Verify email</a></p>
  </body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
