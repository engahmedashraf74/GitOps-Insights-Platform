import { decryptSecret, encryptSecret, EncryptionConfigError } from './secret-box';

describe('integration encryption', () => {
  const previousKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  const previousJwt = process.env.JWT_SECRET;

  afterEach(() => {
    restore('INTEGRATION_ENCRYPTION_KEY', previousKey);
    restore('JWT_SECRET', previousJwt);
  });

  it('encrypts with the configured key and does not invent one', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    delete process.env.JWT_SECRET;
    expect(() => encryptSecret('token-value')).toThrow(EncryptionConfigError);

    process.env.JWT_SECRET = 'jwt-secret-value-0123456789abcd';
    const stored = encryptSecret('token-value');
    expect(stored).not.toContain('token-value');
    expect(decryptSecret(stored)).toBe('token-value');

    delete process.env.JWT_SECRET;
    process.env.INTEGRATION_ENCRYPTION_KEY = 'jwt-secret-value-0123456789abcd';
    expect(decryptSecret(stored)).toBe('token-value');
  });
});

function restore(name: 'INTEGRATION_ENCRYPTION_KEY' | 'JWT_SECRET', value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
