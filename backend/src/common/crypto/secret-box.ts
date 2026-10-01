import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { requireSecret } from '../../auth/jwt.constants';

const ALGORITHM = 'aes-256-gcm';

/**
 * Derives a 32-byte key from a dedicated secret. There is deliberately no
 * fallback to JWT_SECRET or a literal default: a predictable key would make
 * stored Argo CD tokens trivially decryptable.
 */
function encryptionKey(): Buffer {
  const secret = requireSecret('INTEGRATION_ENCRYPTION_KEY');
  return createHash('sha256').update(secret, 'utf8').digest();
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
