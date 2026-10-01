import { BadRequestException } from '@nestjs/common';
import { assertSafeArgoUrl } from './argo-url';

describe('assertSafeArgoUrl', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('accepts a public https endpoint and normalises it', () => {
    expect(assertSafeArgoUrl('https://argocd.example.com/')).toBe(
      'https://argocd.example.com',
    );
  });

  it('rejects an empty url', () => {
    expect(() => assertSafeArgoUrl('  ')).toThrow(BadRequestException);
  });

  it('rejects a malformed url', () => {
    expect(() => assertSafeArgoUrl('argocd.example.com')).toThrow(
      /not a valid URL/,
    );
  });

  it('rejects non-http schemes used to reach local resources', () => {
    expect(() => assertSafeArgoUrl('file:///etc/passwd')).toThrow(
      /must use http or https/,
    );
  });

  it('rejects credentials embedded in the url', () => {
    expect(() => assertSafeArgoUrl('https://user:pass@argocd.example.com')).toThrow(
      /must not embed credentials/,
    );
  });

  it('blocks localhost', () => {
    expect(() => assertSafeArgoUrl('http://localhost:8080')).toThrow(
      /loopback or cloud metadata/,
    );
  });

  it('blocks loopback IPv4', () => {
    expect(() => assertSafeArgoUrl('http://127.0.0.1:8080')).toThrow(
      /loopback, link-local, or cloud metadata/,
    );
  });

  it('blocks loopback IPv6', () => {
    expect(() => assertSafeArgoUrl('http://[::1]:8080')).toThrow(
      /loopback, link-local, or cloud metadata/,
    );
  });

  it('blocks the cloud metadata address', () => {
    expect(() => assertSafeArgoUrl('http://169.254.169.254/latest/meta-data')).toThrow(
      /loopback, link-local, or cloud metadata/,
    );
  });

  it('blocks the metadata hostname', () => {
    expect(() => assertSafeArgoUrl('http://metadata.google.internal')).toThrow(
      /loopback or cloud metadata/,
    );
  });

  it('blocks private addresses in production by default', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ARGOCD_ALLOW_PRIVATE_NETWORK;
    expect(() => assertSafeArgoUrl('https://10.0.0.5')).toThrow(
      /private network address/,
    );
  });

  it('allows private addresses in production when explicitly opted in', () => {
    process.env.NODE_ENV = 'production';
    process.env.ARGOCD_ALLOW_PRIVATE_NETWORK = 'true';
    expect(assertSafeArgoUrl('https://10.0.0.5')).toBe('https://10.0.0.5');
  });

  it('still blocks loopback even when private networks are allowed', () => {
    process.env.ARGOCD_ALLOW_PRIVATE_NETWORK = 'true';
    expect(() => assertSafeArgoUrl('http://127.0.0.1')).toThrow(
      /loopback, link-local, or cloud metadata/,
    );
  });

  it('requires https in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertSafeArgoUrl('http://argocd.example.com')).toThrow(
      /must use https in production/,
    );
  });

  it('allows an in-cluster service name', () => {
    process.env.NODE_ENV = 'production';
    expect(
      assertSafeArgoUrl('https://argocd-server.argocd.svc.cluster.local'),
    ).toBe('https://argocd-server.argocd.svc.cluster.local');
  });
});
