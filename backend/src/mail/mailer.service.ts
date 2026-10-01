import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.',
      );
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
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

      this.logger.log(`[mail] Email sent successfully to ${message.to}`);
    } catch (error) {
      // Never log the SMTP credentials; only the failure reason.
      this.logger.error(
        `[mail] Failed to send email to ${message.to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException(
        'The verification email could not be sent. Please try again shortly.',
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
