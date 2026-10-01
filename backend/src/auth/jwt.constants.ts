const MIN_SECRET_LENGTH = 32;

/**
 * Secrets are read lazily so the process fails during Nest bootstrap with a
 * clear message instead of at import time, and so a missing value can never
 * silently degrade to a shared default.
 */
export function requireSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Generate a random value of at least ${MIN_SECRET_LENGTH} characters (for example: openssl rand -base64 48) and set it before starting the API.`,
    );
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be at least ${MIN_SECRET_LENGTH} characters long.`,
    );
  }
  return value;
}

export function getJwtSecret(): string {
  return requireSecret('JWT_SECRET');
}
