import { Logger, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('verification email flow', () => {
  const original = {
    FRONTEND_URL: process.env.FRONTEND_URL,
    APP_URL: process.env.APP_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
  let logs: string[];

  beforeEach(() => {
    logs = [];
    process.env.FRONTEND_URL = 'https://gitops-insights.com';
    delete process.env.APP_URL;
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
    restore('FRONTEND_URL', original.FRONTEND_URL);
    restore('APP_URL', original.APP_URL);
    restore('NODE_ENV', original.NODE_ENV);
    jest.restoreAllMocks();
  });

  it('registers and waits for SMTP acceptance', async () => {
    const { service, mailer, prisma } = harness();
    const result = await service.register('person@example.com', 'password123', 'ada');

    expect(result.emailDelivery).toBe('accepted');
    expect(result).not.toHaveProperty('access_token');
    expect(mailer.send).toHaveBeenCalledTimes(1);
    const url = String(mailer.renderVerifyEmail.mock.calls[0][1]);
    expect(url).toMatch(
      /^https:\/\/gitops-insights\.com\/verify-email\?token=[a-f0-9]{64}$/,
    );
    expect(prisma.emailVerificationToken.updateMany).toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('token');
    expect(logs.join('\n')).not.toContain(url.split('token=')[1]);
    expect(logs.join('\n')).toContain('category=smtp-accepted');
  });

  it('reports an unavailable send when SMTP rejects the message', async () => {
    const { service, mailer, prisma } = harness();
    mailer.send.mockResolvedValue({ status: 'failed', category: 'smtp-auth' });

    const result = await service.register('person@example.com', 'password123');

    expect(result.emailDelivery).toBe('unavailable');
    expect(prisma.emailVerificationToken.update).toHaveBeenCalled();
    const url = String(mailer.renderVerifyEmail.mock.calls[0][1]);
    const written = logs.join('\n');
    expect(written).toContain('category=smtp-auth');
    expect(written).not.toContain(url.split('token=')[1]);
    expect(written).not.toContain('person@example.com');
  });

  it('does not send when production would build a localhost link', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    const { service, mailer } = harness();

    const result = await service.register('person@example.com', 'password123');

    expect(result.emailDelivery).toBe('unavailable');
    expect(mailer.send).not.toHaveBeenCalled();
    expect(logs.join('\n')).not.toContain('localhost');
    expect(logs.join('\n')).not.toContain('person@example.com');
  });

  it('rejects expired and unknown tokens', async () => {
    const { service, prisma } = harness();
    prisma.emailVerificationToken.findUnique.mockResolvedValueOnce(null);
    await expect(service.verifyEmail('missing')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    prisma.emailVerificationToken.findUnique.mockResolvedValueOnce({
      id: 3,
      token: 'expired',
      userId: 4,
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      user: { email: 'person@example.com' },
    });
    await expect(service.verifyEmail('expired')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.emailVerificationToken.update).not.toHaveBeenCalled();
  });

  it('returns the same resend response for unknown and verified accounts', async () => {
    const { service, users, mailer } = harness();
    users.findByEmail.mockResolvedValueOnce(null);
    const unknown = await service.resendVerification('missing@example.com');

    users.findByEmail.mockResolvedValueOnce({
      id: 4,
      email: 'person@example.com',
      emailVerified: true,
    });
    const verified = await service.resendVerification('person@example.com');

    expect(unknown).toEqual({ ok: true, delivery: 'accepted' });
    expect(verified).toEqual(unknown);
    expect(mailer.send).not.toHaveBeenCalled();
    expect(JSON.stringify(unknown)).not.toContain('token');
  });

  it('rate limits a second verification email inside one minute', async () => {
    const { service, mailer, prisma, users } = harness();
    users.findByEmail.mockResolvedValue({
      id: 4,
      email: 'person@example.com',
      emailVerified: false,
    });
    prisma.emailVerificationToken.findFirst.mockResolvedValue({ id: 9 });

    const result = await service.resendVerification('person@example.com');

    expect(result).toEqual({ ok: true, delivery: 'accepted' });
    expect(mailer.send).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('category=resend-rate-limited');
  });

  it('logs a rejected resend without changing the public response', async () => {
    const { service, mailer, users } = harness();
    users.findByEmail.mockResolvedValue({
      id: 4,
      email: 'person@example.com',
      emailVerified: false,
    });
    mailer.send.mockResolvedValue({ status: 'failed', category: 'smtp-timeout' });

    const result = await service.resendVerification('person@example.com');

    expect(result).toEqual({ ok: true, delivery: 'accepted' });
    expect(logs.join('\n')).toContain('category=smtp-timeout');
    expect(logs.join('\n')).not.toContain('person@example.com');
  });

  it('does not reveal a missing account when SMTP is not configured', async () => {
    const { service, users, mailer } = harness();
    mailer.configured.mockReturnValue(false);
    users.findByEmail.mockResolvedValueOnce(null);
    const unknown = await service.resendVerification('missing@example.com');
    users.findByEmail.mockResolvedValueOnce({
      id: 4,
      email: 'person@example.com',
      emailVerified: false,
    });
    const existing = await service.resendVerification('person@example.com');

    expect(unknown).toEqual({ ok: true, delivery: 'unavailable' });
    expect(existing).toEqual(unknown);
    expect(mailer.send).not.toHaveBeenCalled();
  });
});

function harness() {
  const users = {
    findByEmail: jest.fn(
      async (): Promise<{
        id: number;
        email: string;
        emailVerified: boolean;
      } | null> => null,
    ),
    findByUsername: jest.fn(async () => null),
    create: jest.fn(async () => ({ id: 4, email: 'person@example.com' })),
  };
  const prisma = {
    emailVerificationToken: {
      findFirst: jest.fn(async (): Promise<{ id: number } | null> => null),
      findUnique: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 0 })),
      update: jest.fn(async () => ({})),
      create: jest.fn(async ({ data }: { data: { token: string } }) => ({
        id: 11,
        ...data,
      })),
    },
    user: { update: jest.fn() },
    $transaction: jest.fn(),
  };
  const mailer = {
    configured: jest.fn(() => true),
    renderVerifyEmail: jest.fn((email: string, url: string) => ({
      to: email,
      subject: 'Verify',
      html: '<p></p>',
      text: url,
    })),
    send: jest.fn(
      async (): Promise<
        | { status: 'accepted'; messageId: string }
        | { status: 'failed'; category: string }
      > => ({
        status: 'accepted',
        messageId: '<abc@mail.example>',
      }),
    ),
  };
  const service = new AuthService(
    users as never,
    { sign: jest.fn(() => 'session') } as never,
    { ensureForUser: jest.fn(async () => undefined) } as never,
    prisma as never,
    mailer as never,
  );
  return { service, users, prisma, mailer };
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
