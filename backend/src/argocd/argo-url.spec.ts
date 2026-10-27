import {
  assertSafeArgoUrl,
  createPinnedLookup,
  describeArgoHttpStatus,
  describeArgoTransportError,
  isNonPublicAddress,
  redactSecrets,
} from './argo-url';

const publicLookup = async () => [{ address: '93.184.216.34' }];
const privateLookup = async () => [{ address: '192.168.49.2' }];

describe('Argo CD URL safety', () => {
  it('accepts a public https URL when its address is public', async () => {
    const destination = await assertSafeArgoUrl('https://argocd.example.com/apps', {
      production: true,
      lookupHost: publicLookup,
    });
    expect(destination.url.origin).toBe('https://argocd.example.com');
    expect(destination.addresses).toEqual(['93.184.216.34']);
  });

  it('rejects a malformed URL', async () => {
    await expect(
      assertSafeArgoUrl('not a url', { production: true, lookupHost: publicLookup }),
    ).rejects.toThrow('https://');
  });

  it('rejects http and localhost', async () => {
    await expect(
      assertSafeArgoUrl('http://argocd.example.com', {
        production: false,
        lookupHost: publicLookup,
      }),
    ).rejects.toThrow('HTTPS');
    await expect(
      assertSafeArgoUrl('https://localhost:8080', { production: true, lookupHost: publicLookup }),
    ).rejects.toThrow('localhost');
  });

  it('rejects cluster-local and private addresses in production', async () => {
    await expect(
      assertSafeArgoUrl('https://argocd-server.argocd.svc.cluster.local', {
        production: true,
        lookupHost: publicLookup,
      }),
    ).rejects.toThrow('Kubernetes');
    await expect(
      assertSafeArgoUrl('https://192.168.49.2', { production: true, lookupHost: publicLookup }),
    ).rejects.toThrow('private');
    await expect(
      assertSafeArgoUrl('https://argocd.internal.example', {
        production: true,
        lookupHost: privateLookup,
      }),
    ).rejects.toThrow('private');
  });

  it('blocks cloud metadata addresses', async () => {
    await expect(
      assertSafeArgoUrl('https://169.254.169.254', { production: false, lookupHost: publicLookup }),
    ).rejects.toThrow('private');
    expect(isNonPublicAddress('10.0.0.5')).toBe(true);
    expect(isNonPublicAddress('8.8.8.8')).toBe(false);
  });

  it('describes authentication, permission, timeout, and TLS failures', () => {
    expect(describeArgoHttpStatus(401)).toMatch(/rejected the token/i);
    expect(describeArgoHttpStatus(403)).toMatch(/cannot list applications/i);
    expect(describeArgoHttpStatus(403, 'projects')).toMatch(/cannot list projects/i);
    expect(describeArgoHttpStatus(302)).toMatch(/redirects/i);
    expect(describeArgoTransportError({ code: 'ETIMEDOUT' })).toMatch(/did not respond/i);
    expect(describeArgoTransportError({ code: 'ECONNREFUSED' })).toMatch(/could not open a connection/i);
    expect(describeArgoTransportError({ code: 'CERT_HAS_EXPIRED' })).toMatch(/expired/i);
    expect(describeArgoTransportError({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' })).toMatch(/not trusted/i);
  });

  it('pins the approved addresses when DNS later returns a private address', async () => {
    let calls = 0;
    const destination = await assertSafeArgoUrl('https://argocd.example.com', {
      production: true,
      lookupHost: async () => {
        calls += 1;
        return calls === 1
          ? [{ address: '93.184.216.34' }]
          : [{ address: '169.254.169.254' }];
      },
    });
    const lookup = createPinnedLookup(destination.addresses, { production: true });
    const resolved = await new Promise<string>((resolve, reject) => {
      lookup('argocd.example.com', {}, (error, address) => {
        if (error || typeof address !== 'string') {
          reject(error ?? new Error('missing address'));
          return;
        }
        resolve(address);
      });
    });

    expect(resolved).toBe('93.184.216.34');
    expect(calls).toBe(1);
    await expect(
      assertSafeArgoUrl('https://argocd.example.com', {
        production: true,
        lookupHost: async () => [{ address: '93.184.216.34' }, { address: '10.0.0.5' }],
      }),
    ).rejects.toThrow('private');
    expect(() => createPinnedLookup(['169.254.169.254'], { production: false })).toThrow(
      'private',
    );
    expect(() => createPinnedLookup(['10.0.0.5'], { production: true })).toThrow('private');
  });

  it('redacts bearer tokens and does not treat an empty application list as a transport error', () => {
    expect(redactSecrets('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb')).toBe(
      'Bearer [redacted]',
    );
    expect(describeArgoHttpStatus(200)).toMatch(/HTTP 200/);
  });
});
