import { Logger } from '@nestjs/common';
import { MailerService, mailTransport } from './mailer.service';

describe('MailerService', () => {
  const original = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
  };
  let logs: string[];

  beforeEach(() => {
    logs = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
  });

  afterEach(() => {
    restore('SMTP_HOST', original.SMTP_HOST);
    restore('SMTP_PORT', original.SMTP_PORT);
    restore('SMTP_USER', original.SMTP_USER);
    restore('SMTP_PASS', original.SMTP_PASS);
    jest.restoreAllMocks();
  });

  it('skips sending when SMTP settings are missing and does not log the recipient', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const create = jest.spyOn(mailTransport, 'create');
    const result = await new MailerService().send(sample('person@example.com'));

    expect(result).toEqual({ status: 'skipped', category: 'smtp-config-missing' });
    expect(create).not.toHaveBeenCalled();
    expect(logs.join('\n')).not.toContain('person@example.com');
  });

  it('reports SMTP acceptance and a safe message id', async () => {
    configureSmtp();
    const sendMail = jest.fn(async () => ({ messageId: '<abc@mail.example>' }));
    const create = jest
      .spyOn(mailTransport, 'create')
      .mockReturnValue({ sendMail } as never);

    const result = await new MailerService().send(sample('person@example.com'));

    expect(result).toEqual({
      status: 'accepted',
      messageId: '<abc@mail.example>',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ secure: false, requireTLS: true, port: 587 }),
    );
    expect(logs.join('\n')).toContain('category=smtp-accepted');
    expect(logs.join('\n')).toContain('messageId=<abc@mail.example>');
    expect(logs.join('\n')).not.toContain('person@example.com');
    expect(logs.join('\n')).not.toContain('secret-pass');
  });

  it('uses implicit TLS on port 465', async () => {
    configureSmtp();
    process.env.SMTP_PORT = '465';
    const sendMail = jest.fn(async () => ({ messageId: 'not a safe id' }));
    jest.spyOn(mailTransport, 'create').mockReturnValue({ sendMail } as never);

    const result = await new MailerService().send(sample('person@example.com'));

    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') expect(result.messageId).toBe('present');
    expect(mailTransport.create).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true, requireTLS: false, port: 465 }),
    );
  });

  it.each([
    ['authentication', { code: 'EAUTH' }, 'smtp-auth'],
    ['timeout', { code: 'ETIMEDOUT' }, 'smtp-timeout'],
    [
      'rejection',
      { responseCode: 550, message: 'rejected person@example.com secret-pass' },
      'smtp-rejected',
    ],
  ])('classifies SMTP %s failures', async (_label, error, category) => {
    configureSmtp();
    const sendMail = jest.fn(async () => {
      throw error;
    });
    jest.spyOn(mailTransport, 'create').mockReturnValue({ sendMail } as never);

    const result = await new MailerService().send(sample('person@example.com'));

    expect(result).toEqual({ status: 'failed', category });
    const written = logs.join('\n');
    expect(written).toContain(`category=${category}`);
    expect(written).not.toContain('person@example.com');
    expect(written).not.toContain('secret-pass');
    expect(written).not.toContain('rejected person');
  });

  it('escapes the address in the verification template', () => {
    const message = new MailerService().renderVerifyEmail(
      'a<b>@example.com',
      'https://gitops-insights.com/verify-email?token=abc',
    );
    expect(message.html).toContain('a&lt;b&gt;@example.com');
    expect(message.html).not.toContain('#0b0d0f');
    expect(message.text).toContain(
      'https://gitops-insights.com/verify-email?token=abc',
    );
  });
});

function sample(to: string) {
  return { to, subject: 'Verify', html: '<p>hi</p>', text: 'hi' };
}

function configureSmtp() {
  process.env.SMTP_HOST = 'smtp.test';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'mailer';
  process.env.SMTP_PASS = 'secret-pass';
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
