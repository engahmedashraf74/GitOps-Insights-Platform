import { frontendOrigin, verificationPageUrl } from './verification-link';

const token = 'a'.repeat(64);

describe('verification links', () => {
  const original = {
    FRONTEND_URL: process.env.FRONTEND_URL,
    APP_URL: process.env.APP_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  afterEach(() => {
    restore('FRONTEND_URL', original.FRONTEND_URL);
    restore('APP_URL', original.APP_URL);
    restore('NODE_ENV', original.NODE_ENV);
  });

  it('uses the public frontend origin and the verify-email route', () => {
    process.env.FRONTEND_URL = 'https://gitops-insights.com/';
    process.env.APP_URL = 'http://localhost:3001';
    expect(verificationPageUrl(token)).toBe(
      `https://gitops-insights.com/verify-email?token=${token}`,
    );
  });

  it('falls back to APP_URL when FRONTEND_URL is unset', () => {
    delete process.env.FRONTEND_URL;
    process.env.APP_URL = 'https://gitops-insights.com';
    expect(frontendOrigin()).toBe('https://gitops-insights.com');
  });

  it('uses the frontend dev server only outside production', () => {
    delete process.env.FRONTEND_URL;
    delete process.env.APP_URL;
    process.env.NODE_ENV = 'development';
    expect(verificationPageUrl(token)).toBe(
      `http://localhost:3000/verify-email?token=${token}`,
    );
  });

  it('rejects localhost and missing origins in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    expect(() => verificationPageUrl(token)).toThrow(
      'verification-origin-invalid',
    );

    process.env.FRONTEND_URL = 'https://backend.cluster.local';
    expect(() => frontendOrigin()).toThrow('verification-origin-invalid');

    process.env.FRONTEND_URL = 'https://10.0.0.8';
    expect(() => frontendOrigin()).toThrow('verification-origin-invalid');

    process.env.FRONTEND_URL = 'http://127.0.0.1:3000';
    expect(() => frontendOrigin()).toThrow('verification-origin-invalid');

    delete process.env.FRONTEND_URL;
    delete process.env.APP_URL;
    expect(() => frontendOrigin()).toThrow('verification-origin-missing');
  });

  it('does not put the token in origin errors', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;
    delete process.env.APP_URL;
    expect(() => verificationPageUrl(token)).toThrow(
      'verification-origin-missing',
    );
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
