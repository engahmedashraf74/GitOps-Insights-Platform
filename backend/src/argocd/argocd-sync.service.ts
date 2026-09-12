import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ArgocdService } from './argocd.service';
import { decryptSecret } from '../common/crypto/secret-box';
import { IntegrationProvider, IntegrationStatus } from '@prisma/client';
import type { ArgoConnection } from './argocd.service';
import type { MappedArgoApplication } from './argo-application';

export interface ArgoSyncResult {
  connected: boolean;
  imported: number;
  updated: number;
  removed: number;
  lastSyncedAt: Date | null;
}

@Injectable()
export class ArgocdSyncService {
  private readonly logger = new Logger(ArgocdSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly argocd: ArgocdService,
  ) {}

  async syncForUser(userId: number): Promise<ArgoSyncResult> {
    const organization = await this.organizations.ensureForUser(userId);
    const connection = await this.connectionForOrganization(organization.id);
    if (!connection) {
      throw new BadRequestException(
        'Connect Argo CD before syncing applications.',
      );
    }
    return this.syncOrganization(organization.id, userId, connection);
  }

  async syncAllConnected(): Promise<void> {
    const rows = await this.prisma.integration.findMany({
      where: {
        provider: IntegrationProvider.argocd,
        status: IntegrationStatus.connected,
      },
      include: { organization: { include: { members: true } } },
    });

    for (const row of rows) {
      if (!row.url || !row.credentialsEncrypted) continue;
      const ownerId =
        row.organization.createdById ?? row.organization.members[0]?.userId;
      if (!ownerId) continue;
      try {
        await this.syncOrganization(row.organizationId, ownerId, {
          url: row.url,
          token: decryptSecret(row.credentialsEncrypted),
        });
      } catch (error) {
        this.logger.warn(
          `Scheduled Argo CD sync failed for org ${row.organizationId}: ${String(error)}`,
        );
      }
    }
  }

  async syncOrganization(
    organizationId: number,
    userId: number,
    connection: ArgoConnection,
  ): Promise<ArgoSyncResult> {
    const discovered = await this.argocd.listApplications(connection);
    const seen = new Set<number>();
    let imported = 0;
    let updated = 0;

    for (const item of discovered) {
      const { created, applicationId } = await this.upsertApplication(
        organizationId,
        userId,
        item,
      );
      seen.add(applicationId);
      if (created) imported += 1;
      else updated += 1;
    }

    const stale = await this.prisma.application.findMany({
      where: {
        argoUid: { not: null },
        project: { organizationId },
      },
      select: { id: true },
    });
    const staleIds = stale
      .map((row) => row.id)
      .filter((id) => !seen.has(id));

    if (staleIds.length) {
      await this.prisma.deployment.deleteMany({
        where: { applicationId: { in: staleIds } },
      });
      await this.prisma.environment.deleteMany({
        where: { applicationId: { in: staleIds } },
      });
      await this.prisma.applicationEvent.deleteMany({
        where: { applicationId: { in: staleIds } },
      });
      await this.prisma.application.deleteMany({
        where: { id: { in: staleIds } },
      });
    }

    const lastSyncedAt = new Date();
    await this.prisma.integration.updateMany({
      where: {
        organizationId,
        provider: IntegrationProvider.argocd,
      },
      data: { lastSyncedAt },
    });

    return {
      connected: true,
      imported,
      updated,
      removed: staleIds.length,
      lastSyncedAt,
    };
  }

  private async connectionForOrganization(
    organizationId: number,
  ): Promise<ArgoConnection | undefined> {
    const record = await this.prisma.integration.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider: IntegrationProvider.argocd,
        },
      },
    });
    if (!record?.url || !record.credentialsEncrypted) return undefined;
    return {
      url: record.url,
      token: decryptSecret(record.credentialsEncrypted),
    };
  }

  private async upsertApplication(
    organizationId: number,
    userId: number,
    item: MappedArgoApplication,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { organizationId, name: item.argoProject },
    });
    const projectId = project
      ? project.id
      : (
          await this.prisma.project.create({
            data: {
              name: item.argoProject,
              description: 'Imported from Argo CD',
              userId,
              organizationId,
            },
          })
        ).id;

    const existing =
      (await this.prisma.application.findFirst({
        where: {
          argoUid: item.uid,
          project: { organizationId },
        },
      })) ??
      (await this.prisma.application.findFirst({
        where: { name: item.name, projectId },
      }));

    const data = {
      name: item.name,
      description: `Argo CD application in ${item.argoProject}`,
      repoUrl: item.repoUrl,
      branch: item.branch,
      path: item.path,
      projectId,
      argoUid: item.uid,
      namespace: item.namespace,
      cluster: item.cluster,
      syncStatus: item.syncStatus,
      healthStatus: item.healthStatus,
      revision: item.revision,
      lastObservedAt: item.lastObservedAt,
    };

    const application = existing
      ? await this.prisma.application.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.application.create({ data });

    await this.replaceHistory(application.id, item);
    await this.ensureEnvironment(application.id, item.namespace);
    return { created: !existing, applicationId: application.id };
  }

  private async replaceHistory(
    applicationId: number,
    item: MappedArgoApplication,
  ) {
    const history =
      item.history.length > 0
        ? item.history
        : item.revision
          ? [
              {
                revision: item.revision,
                deployedAt: item.lastObservedAt ?? new Date(),
                startedAt: null,
                status:
                  item.healthStatus.toLowerCase() === 'degraded'
                    ? 'Failed'
                    : 'Succeeded',
                syncStatus: item.syncStatus,
                healthStatus: item.healthStatus,
                environment: item.namespace || 'default',
              },
            ]
          : [];

    await this.prisma.deployment.deleteMany({ where: { applicationId } });
    if (!history.length) return;

    await this.prisma.deployment.createMany({
      data: history.map((entry) => ({
        applicationId,
        revision: entry.revision,
        status: entry.status,
        syncStatus: entry.syncStatus,
        healthStatus: entry.healthStatus,
        environment: entry.environment,
        deployedAt: entry.deployedAt,
        startedAt: entry.startedAt,
        finishedAt: entry.deployedAt,
        commitSha: entry.revision,
      })),
    });
  }

  private async ensureEnvironment(applicationId: number, name: string | null) {
    if (!name) return;
    const existing = await this.prisma.environment.findFirst({
      where: { applicationId, name },
    });
    if (existing) return;
    await this.prisma.environment.create({
      data: { applicationId, name },
    });
  }
}
