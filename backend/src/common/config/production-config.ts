import { Logger } from '@nestjs/common';

/**
 * Values that must never reach production. Each is a development convenience
 * that silently produces a broken or insecure deployment.
 */
const LOCAL_URL_PATTERN = /localhost|127\.0\.0\.1|0\.0\.0\.0|::1|192\.168\./i;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function frontendOrigins(): string[] {
  const configured = [process.env.FRONTEND_URL, process.env.APP_URL]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\/$/, ''));

  if (configured.length > 0) {
    return Array.from(new Set(configured));
  }

  if (isProduction()) {
    return [];
  }

  return ['http://localhost:3001', 'http://127.0.0.1:3001'];
}

/**
 * Public base URL of the frontend, used for verification links and Stripe
 * redirects. Falls back to localhost only outside production.
 */
export function appBaseUrl(): string {
  const configured = (process.env.APP_URL || process.env.FRONTEND_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (configured) {
    return configured;
  }
  if (isProduction()) {
    throw new Error(
      'APP_URL (or FRONTEND_URL) must be configured in production.',
    );
  }
  return 'http://localhost:3001';
}

/**
 * Fails fast on misconfiguration that would otherwise surface as a silent
 * security or availability problem in production.
 */
export function validateProductionConfig(logger: Logger): void {
  if (!isProduction()) {
    logger.warn(
      'NODE_ENV is not "production". Development fallbacks for CORS and Argo CD are active.',
    );
    return;
  }

  const errors: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) {
    errors.push('DATABASE_URL is required.');
  }

  const origins = frontendOrigins();
  if (origins.length === 0) {
    errors.push(
      'FRONTEND_URL (or APP_URL) is required in production so CORS and email links resolve correctly.',
    );
  }
  for (const origin of origins) {
    if (LOCAL_URL_PATTERN.test(origin)) {
      errors.push(
        `FRONTEND_URL/APP_URL must not point at a local address in production (got "${origin}").`,
      );
    }
    if (!origin.startsWith('https://')) {
      errors.push(
        `FRONTEND_URL/APP_URL must use https in production (got "${origin}").`,
      );
    }
  }

  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    errors.push(
      'NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS verification and must not be set in production.',
    );
  }

  const jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY?.trim() ?? '';
  if (jwtSecret.length < 32) {
    errors.push(
      'JWT_SECRET is required in production and must be at least 32 characters. Generate one with: openssl rand -base64 48',
    );
  }
  if (encryptionKey.length < 32) {
    errors.push(
      'INTEGRATION_ENCRYPTION_KEY is required in production and must be at least 32 characters. Generate a different value with: openssl rand -base64 48',
    );
  }
  if (jwtSecret && encryptionKey && jwtSecret === encryptionKey) {
    errors.push(
      'INTEGRATION_ENCRYPTION_KEY must be a different secret from JWT_SECRET.',
    );
  }

  if (process.env.ARGOCD_ENV_FALLBACK === 'true') {
    errors.push(
      'ARGOCD_ENV_FALLBACK=true is not allowed in production. It would import one shared Argo CD into every organization. Each customer connects Argo CD from the Integrations page.',
    );
  }

  for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] as const) {
    if (!process.env[name]?.trim()) {
      errors.push(
        `${name} is required in production. Login stays locked until the verification email can be sent.`,
      );
    }
  }

  if (process.env.STRIPE_SECRET_KEY?.trim()) {
    if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
      errors.push(
        'STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set. Checkout must not grant Pro without a verified webhook.',
      );
    }
    if (!process.env.STRIPE_PRICE_ID_PRO?.trim()) {
      errors.push(
        'STRIPE_PRICE_ID_PRO is required when STRIPE_SECRET_KEY is set.',
      );
    }
  }
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    logger.warn(
      'STRIPE_SECRET_KEY is not set. Checkout and the billing portal will be unavailable; existing plan state is unchanged.',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid production configuration:\n- ${errors.join('\n- ')}`,
    );
  }
}
