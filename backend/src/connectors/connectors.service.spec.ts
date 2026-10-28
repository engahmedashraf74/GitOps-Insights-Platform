import { BadRequestException, Logger } from '@nestjs/common';
import { ConnectorsService } from './connectors.service';
import { hashCredential } from './connector-protocol';

type ConnectorRow = {
  id: number;
  organizationId: number;
  name: string;
  argoUrl: string;
  customCa: boolean;
  status: string;
  credentialHash: string | null;
  lastSeenAt: Date | null;
  lastError: string | null;
  applicationsSeen: number;
  projectsSeen: number;
  revokedAt: Date | null;
  createdAt: Date;
};

type EnrollmentRow = {
  id: number;
  connectorId: number;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

function createDb() {
  let connectorId = 1;
  let enrollmentId = 1;
  const connectors: ConnectorRow[] = [];
  const enrollments: EnrollmentRow[] = [];

  const prisma = {
    connector: {
      count: async ({ where }: { where: { organizationId: number; revokedAt: null } }) =>
        connectors.filter(
          (row) => row.organizationId === where.organizationId && row.revokedAt === null,
        ).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const nested = data.enrollments as { create: { tokenHash: string; expiresAt: Date } };
        const row: ConnectorRow = {
          id: connectorId++,
          organizationId: data.organizationId as number,
          name: data.name as string,
          argoUrl: data.argoUrl as string,
          customCa: data.customCa === true,
          status: data.status as string,
          credentialHash: null,
          lastSeenAt: null,
          lastError: null,
          applicationsSeen: 0,
          projectsSeen: 0,
          revokedAt: null,
          createdAt: new Date(),
        };
        connectors.push(row);
        enrollments.push({
          id: enrollmentId++,
          connectorId: row.id,
          tokenHash: nested.create.tokenHash,
          expiresAt: nested.create.expiresAt,
          usedAt: null,
        });
        return row;
      },
      findMany: async ({ where }: { where: { organizationId: number } }) =>
        connectors
          .filter((row) => row.organizationId === where.organizationId)
          .sort((left, right) => right.id - left.id)
          .map((row) => ({
            ...row,
            enrollments: enrollments
              .filter((item) => item.connectorId === row.id)
              .sort((left, right) => right.id - left.id)
              .slice(0, 1),
          })),
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        connectors.find((row) => {
          if (where.id !== undefined && row.id !== where.id) return false;
          if (where.organizationId !== undefined && row.organizationId !== where.organizationId) {
            return false;
          }
          if (where.credentialHash !== undefined && row.credentialHash !== where.credentialHash) {
            return false;
          }
          return true;
        }) ?? null,
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const row = connectors.find((item) => item.id === where.id);
        if (!row) throw new Error('connector missing');
        const nested = data.enrollments as { create?: { tokenHash: string; expiresAt: Date } } | undefined;
        const rest = { ...data };
        delete rest.enrollments;
        Object.assign(row, rest);
        if (nested?.create) {
          enrollments.push({
            id: enrollmentId++,
            connectorId: row.id,
            tokenHash: nested.create.tokenHash,
            expiresAt: nested.create.expiresAt,
            usedAt: null,
          });
        }
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: number; organizationId: number; revokedAt: null };
        data: Partial<ConnectorRow>;
      }) => {
        let count = 0;
        for (const row of connectors) {
          if (row.id !== where.id || row.organizationId !== where.organizationId) continue;
          if (where.revokedAt === null && row.revokedAt !== null) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
    },
    connectorEnrollment: {
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          tokenHash?: string;
          connectorId?: number;
          usedAt?: null;
          expiresAt?: { gt: Date };
          connector?: { revokedAt: null; status: { not: string } };
        };
        data: { usedAt: Date };
      }) => {
        let count = 0;
        for (const row of enrollments) {
          if (where.tokenHash !== undefined && row.tokenHash !== where.tokenHash) continue;
          if (where.connectorId !== undefined && row.connectorId !== where.connectorId) continue;
          if (where.usedAt === null && row.usedAt !== null) continue;
          if (where.expiresAt?.gt && row.expiresAt <= where.expiresAt.gt) continue;
          if (where.connector) {
            const parent = connectors.find((item) => item.id === row.connectorId);
            if (!parent || parent.revokedAt !== null) continue;
            if (parent.status === where.connector.status.not) continue;
          }
          row.usedAt = data.usedAt;
          count += 1;
        }
        return { count };
      },
      findFirst: async ({ where }: { where: { tokenHash: string } }) =>
        enrollments.find((row) => row.tokenHash === where.tokenHash) ?? null,
    },
    organization: {
      findUnique: async ({ where }: { where: { id: number } }) => {
        if (where.id === 4) return { id: 4, createdById: 11 };
        if (where.id === 9) return { id: 9, createdById: 22 };
        return null;
      },
    },
    organizationMember: {
      findFirst: async () => null,
    },
  };

  const organizations = {
    ensureForUser: async (userId: number) =>
      userId === 2 ? { id: 9, createdById: 22 } : { id: 4, createdById: 11 },
  };

  return { prisma, organizations, connectors, enrollments };
}

function setup() {
  const logs: string[] = [];
  jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
    logs.push(String(message));
  });
  jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
    logs.push(String(message));
  });
  const db = createDb();
  const imported: number[] = [];
  const sync = {
    importDiscovered: jest.fn(
      async (organizationId: number, _userId: number, applications: unknown[]) => {
        imported.push(organizationId);
        if (applications.length === 0) return { applications: 0, projects: 0 };
        const first = applications[0] as { metadata?: { name?: string } };
        if (!first?.metadata?.name) return { applications: 0, projects: 0 };
        return { applications: 1, projects: 1 };
      },
    ),
  };
  const service = new ConnectorsService(
    db.prisma as never,
    db.organizations as never,
    sync as never,
  );
  return { service, db, logs, imported, sync };
}

const app = {
  metadata: { name: 'payments', uid: 'uid-1' },
  spec: { project: 'default', destination: { namespace: 'payments' } },
  status: { sync: { status: 'Synced', revision: 'abc' }, health: { status: 'Healthy' } },
};

describe('ConnectorsService', () => {
  const previous = process.env.CONNECTOR_API_URL;
  const previousImage = process.env.CONNECTOR_IMAGE;

  beforeEach(() => {
    process.env.CONNECTOR_API_URL = 'https://api.gitops-insights.com';
    process.env.CONNECTOR_IMAGE = 'gitops-insights-connector:0.1.0';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (previous === undefined) delete process.env.CONNECTOR_API_URL;
    else process.env.CONNECTOR_API_URL = previous;
    if (previousImage === undefined) delete process.env.CONNECTOR_IMAGE;
    else process.env.CONNECTOR_IMAGE = previousImage;
  });

  it('enrolls once, reconnects, and does not log the secrets', async () => {
    const { service, logs } = setup();
    const created = await service.create(1, 'Minikube', 'https://argocd-server.argocd.svc');
    const enrolled = await service.enroll(created.enrollmentToken);
    await expect(service.enroll(created.enrollmentToken)).rejects.toThrow(
      'Enrollment is invalid, expired, or already used.',
    );
    await service.heartbeat(enrolled.credential);
    await service.heartbeat(enrolled.credential);
    const saved = await service.snapshot(enrolled.credential, {
      applications: [app],
      projects: [{ metadata: { name: 'default' } }],
    });
    expect(saved).toEqual({ applications: 1, projects: 1 });
    const listed = JSON.stringify(await service.list(1));
    expect(listed).not.toContain(created.enrollmentToken);
    expect(listed).not.toContain(enrolled.credential);
    expect(listed).not.toContain(hashCredential(created.enrollmentToken));
    expect(logs.join('\n')).not.toContain(created.enrollmentToken);
    expect(logs.join('\n')).not.toContain(enrolled.credential);
    expect(created.enrollmentCommand).toContain(created.enrollmentToken);
    expect(created.installCommand).toContain(`ENROLLMENT_TOKEN='${created.enrollmentToken}'`);
    expect(created.installCommand).not.toContain('YOUR_ARGO_CD_TOKEN');
    expect(created.installCommand).not.toContain('--from-literal');
    expect(created.installCommand).not.toContain('set -x');
    expect(created.installCommand).not.toContain('NODE_TLS_REJECT_UNAUTHORIZED');
    expect(created.installCommand.split(created.enrollmentToken)).toHaveLength(2);
    expect(created.manifest).not.toContain(created.enrollmentToken);
    expect(created.manifest).toContain('gitops-insights-connector:0.1.0');
    expect(created.manifest).toContain('gitops-insights-connector-state');
    expect(created.manifest).not.toContain('credential.json');
    expect(created.manifest).not.toContain('ARGOCD_CA_FILE');
    expect(created.caSecretCommand).toBeNull();
    expect(created.manifest).not.toContain('rejectUnauthorized');
    expect(created.manifest).not.toContain('NODE_TLS_REJECT_UNAUTHORIZED');
  });

  it('rejects an expired enrollment', async () => {
    const { service, db } = setup();
    const created = await service.create(1, 'Minikube', undefined);
    db.enrollments[0].expiresAt = new Date(Date.now() - 1000);
    await expect(service.enroll(created.enrollmentToken)).rejects.toThrow(
      'Enrollment is invalid, expired, or already used.',
    );
  });

  it('stores a snapshot only for the connector organization', async () => {
    const { service, imported, sync } = setup();
    const created = await service.create(1, 'Minikube', undefined);
    const enrolled = await service.enroll(created.enrollmentToken);
    await expect(
      service.snapshot(enrolled.credential, {
        applications: [app],
        projects: [],
        organizationId: 9,
      }),
    ).rejects.toThrow('Snapshot has an unsupported field.');
    expect(sync.importDiscovered).not.toHaveBeenCalled();
    await service.snapshot(enrolled.credential, { applications: [app], projects: [] });
    expect(imported).toEqual([4]);
  });

  it('does not let another organization revoke the connector', async () => {
    const { service, db } = setup();
    const created = await service.create(1, 'Minikube', undefined);
    const enrolled = await service.enroll(created.enrollmentToken);
    await expect(service.revoke(2, created.id)).rejects.toThrow('Connector not found.');
    await service.heartbeat(enrolled.credential);
    expect(db.connectors[0].revokedAt).toBeNull();
  });

  it('revokes the credential and clears it', async () => {
    const { service, sync } = setup();
    const created = await service.create(1, 'Minikube', undefined);
    const enrolled = await service.enroll(created.enrollmentToken);
    await service.revoke(1, created.id);
    await expect(service.heartbeat(enrolled.credential)).rejects.toThrow();
    await expect(
      service.snapshot(enrolled.credential, { applications: [app], projects: [] }),
    ).rejects.toThrow();
    expect(sync.importDiscovered).not.toHaveBeenCalled();
    const [row] = await service.list(1);
    expect(row.status).toBe('revoked');
  });

  it('rotation invalidates the old credential and the old enrollment', async () => {
    const { service } = setup();
    const created = await service.create(1, 'Minikube', undefined);
    const enrolled = await service.enroll(created.enrollmentToken);
    const rotated = await service.rotate(1, created.id);
    await expect(service.heartbeat(enrolled.credential)).rejects.toThrow();
    await expect(service.enroll(created.enrollmentToken)).rejects.toThrow(
      'Enrollment is invalid, expired, or already used.',
    );
    const next = await service.enroll(rotated.enrollmentToken);
    await service.heartbeat(next.credential);
    const [row] = await service.list(1);
    expect(row.status).toBe('connected');
  });

  it('shows disconnected after the agent stops checking in', async () => {
    const { service, db } = setup();
    const created = await service.create(1, 'Minikube', undefined);
    const enrolled = await service.enroll(created.enrollmentToken);
    await service.heartbeat(enrolled.credential);
    db.connectors[0].lastSeenAt = new Date(Date.now() - 5 * 60 * 1000);
    const [row] = await service.list(1);
    expect(row.status).toBe('disconnected');
  });

  it('records an error without saving unreadable data or a secret', async () => {
    const { service } = setup();
    const created = await service.create(1, 'Minikube', undefined);
    const enrolled = await service.enroll(created.enrollmentToken);
    await service.report(enrolled.credential, `Bearer ${enrolled.credential} failed`);
    const [row] = await service.list(1);
    expect(row.status).toBe('error');
    expect(row.lastError).not.toContain(enrolled.credential);
    expect(row.applicationsSeen).toBe(0);
  });

  it('rejects a private key or invalid CA and does not store it', async () => {
    const { service, db, logs } = setup();
    const privateKey = '-----BEGIN PRIVATE KEY-----\nMIIBtest\n-----END PRIVATE KEY-----';
    await expect(
      service.create(1, 'Production', 'https://argocd.example.com', privateKey),
    ).rejects.toThrow('private key');
    await expect(
      service.create(1, 'Production', 'https://argocd.example.com', 'not a certificate'),
    ).rejects.toThrow('PEM');
    expect(db.connectors).toHaveLength(0);
    expect(logs.join('\n')).not.toContain('BEGIN PRIVATE KEY');
  });

  it('rejects an http connector API URL', async () => {
    process.env.CONNECTOR_API_URL = 'http://api.gitops-insights.com';
    const { service } = setup();
    await expect(service.create(1, 'Minikube', undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
