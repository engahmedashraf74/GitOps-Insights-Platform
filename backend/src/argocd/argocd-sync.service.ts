import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ArgocdService } from './argocd.service';
import { decryptSecret } from '../common/crypto/secret-box';
import { IntegrationProvider, IntegrationStatus } from '@prisma/client';
import type { ArgoConnection } from './argocd.service';
import type { MappedArgoApplication, MappedArgoProject } from './argo-application';
import { maxApplications } from '../billing/plan';

export interface ArgoSyncResult {
  connected: boolean;
  imported: number;
  updated: number;
  removed: number;
  projectsImported: number;
  applicationsFetched: number;
  projectsFetched: number;
  lastSyncedAt: Date | null;
  source: 'integration' | 'env';
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
    const resolved = await this.connectionForOrganization(organization.id);
    if (!resolved) {
      this.logger.warn(`No Argo CD credentials for org ${organization.id}`);
      throw new BadRequestException(
        'Connect Argo CD before syncing applications.',
      );
    }
    return this.syncOrganization(
      organization.id,
      userId,
      resolved.connection,
      resolved.source,
    );
  }

  async syncAllConnected(): Promise<void> {
    const rows = await this.prisma.integration.findMany({
      where: {
        provider: IntegrationProvider.argocd,
        status: IntegrationStatus.connected,
      },
      include: { organization: { include: { members: true } } },
    });

    this.logger.log(
      `[argocd-sync] integrations found=${rows.length} envFallbackConfigured=${Boolean(this.argocd.fallbackConnection())}`,
    );
    if (rows.length === 0) {
      this.logger.log('[argocd-sync] env fallback used=true (no Integration records)');
      await this.syncAllOrganizationsFromEnv();
      return;
    }

    this.logger.log('[argocd-sync] env fallback used=false (using stored Integration records)');

    for (const row of rows) {
      const ownerId =
        row.organization.createdById ?? row.organization.members[0]?.userId;
      if (!ownerId) {
        this.logger.warn(
          `Skipping org ${row.organizationId}: no owner/member to attribute imports`,
        );
        continue;
      }

      let connection: ArgoConnection | undefined;
      try {
        connection = this.connectionFromRow(row);
      } catch (error) {
        this.logger.error(
          `Could not decrypt Argo CD token for org ${row.organizationId}: ${String(error)}`,
        );
        continue;
      }

      if (!connection) {
        this.logger.warn(
          `Integration for org ${row.organizationId} is missing url or token; trying env fallback`,
        );
        const fallback = this.argocd.fallbackConnection();
        if (!fallback) continue;
        connection = fallback;
      }

      try {
        await this.syncOrganization(
          row.organizationId,
          ownerId,
          connection,
          row.url ? 'integration' : 'env',
        );
      } catch (error) {
        this.logger.error(
          `Scheduled Argo CD sync failed for org ${row.organizationId}: ${String(error)}`,
        );
      }
    }
  }

  async debugForUser(userId: number) {
    const organization = await this.organizations.ensureForUser(userId);
    const stored = await this.prisma.integration.findMany({
      where: {
        organizationId: organization.id,
        provider: IntegrationProvider.argocd,
      },
    });
    const resolved = await this.connectionForOrganization(organization.id);
    const env = this.argocd.fallbackConnection();

    const [databaseApplications, databaseProjects] = await Promise.all([
      this.prisma.application.count({
        where: { project: { organizationId: organization.id } },
      }),
      this.prisma.project.count({ where: { organizationId: organization.id } }),
    ]);

    let connected = false;
    let fetchedApplications = 0;
    let fetchedProjects = 0;

    if (resolved) {
      const probe = await this.argocd.testConnection(
        resolved.connection.url,
        resolved.connection.token,
      );
      connected = probe.ok;
      if (!probe.ok) {
        this.logger.error(
          `[argocd-sync] debug connection failed status=${probe.status} error=${probe.error}`,
        );
      } else {
        try {
          const [apps, projects] = await Promise.all([
            this.argocd.listApplications(resolved.connection),
            this.argocd.listProjects(resolved.connection),
          ]);
          fetchedApplications = apps.length;
          fetchedProjects = projects.length;
        } catch (error) {
          connected = false;
          this.logger.error(
            `[argocd-sync] debug list failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return {
      envFallbackConfigured: Boolean(env),
      storedIntegrationCount: stored.length,
      connected,
      fetchedProjects,
      fetchedApplications,
      databaseProjects,
      databaseApplications,
      lastSyncAt: stored[0]?.lastSyncedAt ?? null,
    };
  }

  private async syncAllOrganizationsFromEnv() {
    const fallback = this.argocd.fallbackConnection();
    if (!fallback) {
      this.logger.warn(
        '[argocd-sync] ARGOCD_URL / ARGOCD_TOKEN missing or placeholder. Sync skipped.',
      );
      return;
    }

    const organizations = await this.prisma.organization.findMany({
      include: { members: { orderBy: { id: 'asc' }, take: 1 } },
    });
    this.logger.log(
      `[argocd-sync] env fallback used=true organizationCount=${organizations.length} url=${fallback.url}`,
    );
    if (organizations.length === 0) {
      this.logger.warn('[argocd-sync] no organizations exist yet; nothing to import into');
      return;
    }

    for (const organization of organizations) {
      const ownerId = organization.createdById ?? organization.members[0]?.userId;
      if (!ownerId) {
        this.logger.warn(`Skipping org ${organization.id}: no members`);
        continue;
      }
      try {
        await this.syncOrganization(organization.id, ownerId, fallback, 'env');
      } catch (error) {
        this.logger.error(
          `Env fallback sync failed for org ${organization.id}: ${String(error)}`,
        );
      }
    }
  }

  async syncOrganization(
    organizationId: number,
    userId: number,
    connection: ArgoConnection,
    source: 'integration' | 'env' = 'integration',
  ): Promise<ArgoSyncResult> {
    const started = Date.now();
    this.logger.log(
      `[argocd-sync] start org=${organizationId} source=${source} url=${connection.url}`,
    );

    const probe = await this.argocd.testConnection(connection.url, connection.token);
    if (!probe.ok) {
      this.logger.error(
        `[argocd-sync] connection failed org=${organizationId} status=${probe.status} error=${probe.error}`,
      );
      throw new BadRequestException(
        `Argo CD connection failed (HTTP ${probe.status}).`,
      );
    }
    this.logger.log(
      `[argocd-sync] connection ok org=${organizationId} status=${probe.status}`,
    );

    const [projects, discovered] = await Promise.all([
      this.argocd.listProjects(connection),
      this.argocd.listApplications(connection),
    ]);

    this.logger.log(
      `[argocd-sync] fetched org=${organizationId} projects=${projects.length} applications=${discovered.length}`,
    );

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    const cap = maxApplications(organization);
    const toImport = cap < 0 ? discovered : discovered.slice(0, cap);
    if (toImport.length < discovered.length) {
      this.logger.log(
        `[argocd-sync] free plan cap org=${organizationId} importing=${toImport.length} skipped=${discovered.length - toImport.length}`,
      );
    }

    let projectsInserted = 0;
    let projectsUpdated = 0;
    for (const project of projects) {
      const created = await this.upsertProject(organizationId, userId, project);
      if (created) projectsInserted += 1;
      else projectsUpdated += 1;
    }

    const seen = new Set<number>();
    let applicationsInserted = 0;
    let applicationsUpdated = 0;

    for (const item of toImport) {
      try {
        const result = await this.upsertApplication(organizationId, userId, item);
        seen.add(result.applicationId);
        if (result.created) applicationsInserted += 1;
        else applicationsUpdated += 1;
      } catch (error) {
        this.logger.error(
          `[argocd-sync] persist failed app=${item.name} ${error instanceof Error ? error.message : String(error)}`,
        );
      }
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
    await this.prisma.integration.upsert({
      where: {
        organizationId_provider: {
          organizationId,
          provider: IntegrationProvider.argocd,
        },
      },
      update: {
        status: IntegrationStatus.connected,
        url: connection.url,
        lastSyncedAt,
      },
      create: {
        organizationId,
        provider: IntegrationProvider.argocd,
        status: IntegrationStatus.connected,
        url: connection.url,
        lastSyncedAt,
      },
    });

    const durationMs = Date.now() - started;
    this.logger.log(
      `[argocd-sync] complete org=${organizationId} projects inserted=${projectsInserted} updated=${projectsUpdated} applications inserted=${applicationsInserted} updated=${applicationsUpdated} removed=${staleIds.length} durationMs=${durationMs}`,
    );

    return {
      connected: true,
      imported: applicationsInserted,
      updated: applicationsUpdated,
      removed: staleIds.length,
      projectsImported: projectsInserted,
      applicationsFetched: discovered.length,
      projectsFetched: projects.length,
      lastSyncedAt,
      source,
    };
  }

  private async connectionForOrganization(
    organizationId: number,
  ): Promise<{ connection: ArgoConnection; source: 'integration' | 'env' } | undefined> {
    const record = await this.prisma.integration.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider: IntegrationProvider.argocd,
        },
      },
    });
    try {
      const fromRow = this.connectionFromRow(record);
      if (fromRow) return { connection: fromRow, source: 'integration' };
    } catch (error) {
      this.logger.error(
        `Stored Argo CD token could not be decrypted for org ${organizationId}: ${String(error)}`,
      );
    }
    const fallback = this.argocd.fallbackConnection();
    if (fallback) return { connection: fallback, source: 'env' };
    return undefined;
  }

  private connectionFromRow(record?: {
    url: string | null;
    credentialsEncrypted: string | null;
  } | null): ArgoConnection | undefined {
    if (!record?.url || !record.credentialsEncrypted) return undefined;
    return {
      url: record.url,
      token: decryptSecret(record.credentialsEncrypted),
    };
  }

  private async upsertProject(
    organizationId: number,
    userId: number,
    item: MappedArgoProject,
  ) {
    const existing = await this.prisma.project.findUnique({
      where: {
        organizationId_name: { organizationId, name: item.name },
      },
    });
    await this.prisma.project.upsert({
      where: {
        organizationId_name: { organizationId, name: item.name },
      },
      update: { description: item.description },
      create: {
        name: item.name,
        description: item.description,
        userId,
        organizationId,
      },
    });
    return !existing;
  }

  private async upsertApplication(
    organizationId: number,
    userId: number,
    item: MappedArgoApplication,
  ) {
    const project = await this.prisma.project.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: item.argoProject,
        },
      },
      update: {},
      create: {
        name: item.argoProject,
        description: 'Imported from Argo CD',
        userId,
        organizationId,
      },
    });

    const byUid = await this.prisma.application.findFirst({
      where: {
        argoUid: item.uid,
        project: { organizationId },
      },
    });

    const data = {
      name: item.name,
      description: `Argo CD application in ${item.argoProject}`,
      repoUrl: item.repoUrl,
      branch: item.branch,
      path: item.path,
      projectId: project.id,
      argoUid: item.uid,
      namespace: item.namespace,
      cluster: item.cluster,
      syncStatus: item.syncStatus,
      healthStatus: item.healthStatus,
      revision: item.revision,
      lastObservedAt: item.lastObservedAt,
    };

    if (byUid) {
      const application = await this.prisma.application.update({
        where: { id: byUid.id },
        data,
      });
      await this.replaceHistory(application.id, item);
      await this.ensureEnvironment(application.id, item.namespace);
      return { created: false, applicationId: application.id };
    }

    const existing = await this.prisma.application.findUnique({
      where: {
        projectId_name: { projectId: project.id, name: item.name },
      },
    });
    const application = await this.prisma.application.upsert({
      where: {
        projectId_name: { projectId: project.id, name: item.name },
      },
      update: data,
      create: data,
    });
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
    await this.prisma.environment.upsert({
      where: {
        applicationId_name: { applicationId, name },
      },
      update: {},
      create: { applicationId, name },
    });
  }
}
