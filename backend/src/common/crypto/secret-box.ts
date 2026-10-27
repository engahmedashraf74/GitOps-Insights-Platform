import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export class EncryptionConfigError extends Error {
  constructor() {
    super(
      'Integration encryption is not configured. Set INTEGRATION_ENCRYPTION_KEY before storing Argo CD tokens.',
    );
    this.name = 'EncryptionConfigError';
  }
}

function encryptionKey(): Buffer {
  const configured = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  if (!configured.trim()) {
    throw new EncryptionConfigError();
  }
  return Buffer.from(configured.padEnd(32, '0').slice(0, 32), 'utf8');
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
