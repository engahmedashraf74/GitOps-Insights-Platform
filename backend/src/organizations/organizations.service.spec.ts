import { NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';

const TENANT_A = 1;
const OWN_PROJECT = 10;
const OWN_APPLICATION = 100;
const FOREIGN_PROJECT = 20;
const FOREIGN_APPLICATION = 200;

interface FindFirstArgs {
  where: { id: number; projectId: { in: number[] } };
}

function buildService() {
  const applicationCalls: FindFirstArgs[] = [];

  const prisma = {
    organizationMember: {
      findFirst: () =>
        Promise.resolve({
          organization: { id: 1, name: 'Workspace', slug: 'workspace' },
        }),
    },
    project: {
      findMany: () => Promise.resolve([{ id: OWN_PROJECT }]),
    },
    application: {
      // Mirrors Prisma: the `projectId: { in: [...] }` filter is what makes a
      // foreign application invisible rather than merely unauthorised.
      findFirst: (args: FindFirstArgs) => {
        applicationCalls.push(args);
        const allowed = args.where.projectId.in;
        if (args.where.id === OWN_APPLICATION && allowed.includes(OWN_PROJECT)) {
          return Promise.resolve({ id: OWN_APPLICATION });
        }
        return Promise.resolve(null);
      },
    },
  };

  return {
    applicationCalls,
    service: new OrganizationsService(prisma as unknown as PrismaService),
  };
}

describe('OrganizationsService tenant isolation', () => {
  it('resolves an application inside the caller organization', async () => {
    const { service } = buildService();
    await expect(
      service.assertApplicationAccess(TENANT_A, OWN_APPLICATION),
    ).resolves.toBe(OWN_APPLICATION);
  });

  it('rejects an application belonging to another tenant', async () => {
    const { service } = buildService();
    await expect(
      service.assertApplicationAccess(TENANT_A, FOREIGN_APPLICATION),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('scopes the application lookup to accessible projects', async () => {
    const { service, applicationCalls } = buildService();
    await service.assertApplicationAccess(TENANT_A, OWN_APPLICATION);
    expect(applicationCalls[0].where.projectId.in).toEqual([OWN_PROJECT]);
  });

  it('resolves a project inside the caller organization', async () => {
    const { service } = buildService();
    await expect(
      service.assertProjectAccess(TENANT_A, OWN_PROJECT),
    ).resolves.toBe(OWN_PROJECT);
  });

  it('rejects a project belonging to another tenant', async () => {
    const { service } = buildService();
    await expect(
      service.assertProjectAccess(TENANT_A, FOREIGN_PROJECT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not leak whether a foreign id exists', async () => {
    const { service } = buildService();
    await expect(
      service.assertApplicationAccess(TENANT_A, FOREIGN_APPLICATION),
    ).rejects.toThrow('Application not found');
  });
});
