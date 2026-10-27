import { IntegrationsService } from './integrations.service';

jest.mock('../common/crypto/secret-box', () => ({
  encryptSecret: (value: string) => `enc:${value}`,
  decryptSecret: (value: string) => value.slice(4),
}));

describe('IntegrationsService organization isolation', () => {
  const upsert = jest.fn();
  const deleteMany = jest.fn();
  const findMany = jest.fn();
  const ensureForUser = jest.fn();
  const testConnection = jest.fn();

  const service = new IntegrationsService(
    { integration: { upsert, deleteMany, findMany, findUnique: jest.fn() } } as never,
    { ensureForUser } as never,
    { testConnection, fallbackConnection: () => undefined } as never,
  );

  beforeEach(() => {
    upsert.mockReset();
    deleteMany.mockReset();
    findMany.mockReset();
    ensureForUser.mockReset();
    testConnection.mockReset();
  });

  it('stores an encrypted token for the caller organization and does not return it', async () => {
    ensureForUser.mockResolvedValue({ id: 4 });
    testConnection.mockResolvedValue({ ok: true, status: 200 });
    upsert.mockResolvedValue({
      provider: 'argocd',
      status: 'connected',
      url: 'https://argocd.example.com',
      lastSyncedAt: null,
    });

    const result = await service.connect(
      { userId: 7, email: 'owner@example.com' },
      'https://argocd.example.com',
      'token-value-123',
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_provider: { organizationId: 4, provider: 'argocd' },
        },
        create: expect.objectContaining({
          organizationId: 4,
          credentialsEncrypted: 'enc:token-value-123',
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain('token-value-123');
  });

  it('removes stored credentials only for the caller organization', async () => {
    ensureForUser.mockResolvedValue({ id: 4 });
    deleteMany.mockResolvedValue({ count: 1 });

    await service.disconnect({ userId: 7, email: 'owner@example.com' });

    expect(deleteMany).toHaveBeenCalledWith({
      where: { organizationId: 4, provider: 'argocd' },
    });
  });

  it('does not store or delete credentials when the connection test fails', async () => {
    ensureForUser.mockResolvedValue({ id: 4 });
    testConnection.mockResolvedValue({
      ok: false,
      status: 401,
      error: 'Argo CD rejected the token.',
    });

    await expect(
      service.connect(
        { userId: 7, email: 'owner@example.com' },
        'https://argocd.example.com',
        'token-value-123',
      ),
    ).rejects.toThrow('Argo CD rejected the token.');

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('does not persist a token when only testing a connection', async () => {
    ensureForUser.mockResolvedValue({ id: 9 });
    testConnection.mockResolvedValue({
      ok: false,
      status: 0,
      error: 'The GitOps Insights server could not reach Argo CD.',
    });

    await expect(
      service.test(
        { userId: 8, email: 'other@example.com' },
        'https://argocd.example.com',
        'token-value-123',
      ),
    ).rejects.toThrow('could not reach Argo CD');

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(ensureForUser).toHaveBeenCalledWith(8);
  });
});
