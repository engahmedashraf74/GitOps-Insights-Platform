import { getJwtSecret, requireSecret } from './jwt.constants';

const VALID = 'a'.repeat(32);

describe('secret loading', () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = original;
    }
  });

  it('throws when the secret is missing rather than using a default', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET is not set/);
  });

  it('throws when the secret is blank', () => {
    process.env.JWT_SECRET = '   ';
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET is not set/);
  });

  it('rejects a secret that is too short to resist brute force', () => {
    process.env.JWT_SECRET = 'short-secret';
    expect(() => getJwtSecret()).toThrow(/at least 32 characters/);
  });

  it('accepts a sufficiently long secret', () => {
    process.env.JWT_SECRET = VALID;
    expect(getJwtSecret()).toBe(VALID);
  });

  it('never returns a fallback value for an arbitrary secret name', () => {
    delete process.env.SOME_UNSET_SECRET;
    expect(() => requireSecret('SOME_UNSET_SECRET')).toThrow(
      /SOME_UNSET_SECRET is not set/,
    );
  });
});
