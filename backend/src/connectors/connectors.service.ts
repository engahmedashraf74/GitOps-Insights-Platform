import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConnectorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ArgocdSyncService } from '../argocd/argocd-sync.service';
import {
  ENROLLMENT_TTL_MS,
  assertCaCertificate,
  assertClusterArgoUrl,
  assertConnectorName,
  assertSnapshotShape,
  connectorImage,
  createCredential,
  displayStatus,
  enrollmentCommand,
  hashCredential,
  publicApiUrl,
  redactText,
  renderInstallCommand,
  renderManifest,
} from './connector-protocol';

const DEFAULT_ARGO_URL = 'https://argocd-server.argocd.svc';
const MAX_CONNECTORS = 10;

@Injectable()
export class ConnectorsService {
  private readonly logger = new Logger(ConnectorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly sync: ArgocdSyncService,
  ) {}

  async list(userId: number) {
    const organization = await this.organizations.ensureForUser(userId);
    const rows = await this.prisma.connector.findMany({
      where: { organizationId: organization.id },
      include: {
        enrollments: { orderBy: { id: 'desc' }, take: 1 },
      },
      orderBy: { id: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async create(
    userId: number,
    name: string | undefined,
    argoUrl: string | undefined,
    caCertificate?: string,
  ) {
    const organization = await this.organizations.ensureForUser(userId);
    const active = await this.prisma.connector.count({
      where: { organizationId: organization.id, revokedAt: null },
    });
    if (active >= MAX_CONNECTORS) {
      throw new BadRequestException('Connector limit reached.');
    }
    const safeName = assertConnectorName(name);
    const safeArgoUrl = assertClusterArgoUrl(argoUrl?.trim() || DEFAULT_ARGO_URL);
    const customCa = Boolean(caCertificate?.trim());
    if (caCertificate?.trim()) assertCaCertificate(caCertificate);
    const apiUrl = publicApiUrl();
    const enrollmentToken = createCredential();
    const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MS);
    const connector = await this.prisma.connector.create({
      data: {
        organizationId: organization.id,
        name: safeName,
        argoUrl: safeArgoUrl,
        customCa,
        status: ConnectorStatus.pending,
        enrollments: {
          create: {
            tokenHash: hashCredential(enrollmentToken),
            expiresAt,
          },
        },
      },
    });
    this.logger.log(
      `[connector] enrollment created org=${organization.id} connector=${connector.id}`,
    );
    return this.enrollmentResponse(
      connector.id,
      safeName,
      safeArgoUrl,
      enrollmentToken,
      expiresAt,
      apiUrl,
      customCa,
    );
  }

  async rotate(userId: number, connectorId: number) {
    const organization = await this.organizations.ensureForUser(userId);
    const existing = await this.prisma.connector.findFirst({
      where: { id: connectorId, organizationId: organization.id },
    });
    if (!existing) throw new NotFoundException('Connector not found.');
    if (existing.revokedAt || existing.status === ConnectorStatus.revoked) {
      throw new BadRequestException('This connector is revoked.');
    }
    const apiUrl = publicApiUrl();
    const now = new Date();
    await this.prisma.connectorEnrollment.updateMany({
      where: { connectorId, usedAt: null },
      data: { usedAt: now },
    });
    const enrollmentToken = createCredential();
    const expiresAt = new Date(now.getTime() + ENROLLMENT_TTL_MS);
    await this.prisma.connector.update({
      where: { id: connectorId },
      data: {
        status: ConnectorStatus.pending,
        credentialHash: null,
        lastSeenAt: null,
        lastError: null,
        enrollments: {
          create: {
            tokenHash: hashCredential(enrollmentToken),
            expiresAt,
          },
        },
      },
    });
    this.logger.log(
      `[connector] credential rotated org=${organization.id} connector=${connectorId}`,
    );
    return this.enrollmentResponse(
      connectorId,
      existing.name,
      existing.argoUrl,
      enrollmentToken,
      expiresAt,
      apiUrl,
      existing.customCa,
    );
  }

  async revoke(userId: number, connectorId: number) {
    const organization = await this.organizations.ensureForUser(userId);
    const now = new Date();
    const result = await this.prisma.connector.updateMany({
      where: {
        id: connectorId,
        organizationId: organization.id,
        revokedAt: null,
      },
      data: {
        status: ConnectorStatus.revoked,
        revokedAt: now,
        credentialHash: null,
        lastError: null,
      },
    });
    if (result.count !== 1) throw new NotFoundException('Connector not found.');
    await this.prisma.connectorEnrollment.updateMany({
      where: { connectorId, usedAt: null },
      data: { usedAt: now },
    });
    this.logger.log(`[connector] revoked org=${organization.id} connector=${connectorId}`);
    return { id: connectorId, status: 'revoked' as const };
  }

  async enroll(enrollmentToken: string) {
    const tokenHash = hashCredential(enrollmentToken);
    const now = new Date();
    const consumed = await this.prisma.connectorEnrollment.updateMany({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
        connector: { revokedAt: null, status: { not: ConnectorStatus.revoked } },
      },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException('Enrollment is invalid, expired, or already used.');
    }
    const enrollment = await this.prisma.connectorEnrollment.findFirst({
      where: { tokenHash },
    });
    if (!enrollment) {
      throw new UnauthorizedException('Enrollment is invalid, expired, or already used.');
    }
    const credential = createCredential();
    await this.prisma.connector.update({
      where: { id: enrollment.connectorId },
      data: {
        credentialHash: hashCredential(credential),
        status: ConnectorStatus.connected,
        lastSeenAt: now,
        lastError: null,
      },
    });
    this.logger.log(`[connector] enrolled connector=${enrollment.connectorId}`);
    return { connectorId: enrollment.connectorId, credential };
  }

  async heartbeat(credential: string) {
    const connector = await this.authenticate(credential);
    const now = new Date();
    await this.prisma.connector.update({
      where: { id: connector.id },
      data: { lastSeenAt: now },
    });
    return {
      connectorId: connector.id,
      status: displayStatus({ ...connector, lastSeenAt: now }, now.getTime()),
    };
  }

  async snapshot(credential: string, body: unknown) {
    const connector = await this.authenticate(credential);
    const snapshot = assertSnapshotShape(body);
    const userId = await this.ownerId(connector.organizationId);
    let saved: { applications: number; projects: number };
    try {
      saved = await this.sync.importDiscovered(
        connector.organizationId,
        userId,
        snapshot.applications,
        snapshot.projects,
      );
    } catch (error) {
      await this.markError(connector.id, 'Discovery could not be saved.');
      this.logger.error(
        `[connector] snapshot failed connector=${connector.id} ${redactText(error instanceof Error ? error.message : 'error')}`,
      );
      throw new BadRequestException('Discovery could not be saved.');
    }
    const emptyInput = snapshot.applications.length === 0 && snapshot.projects.length === 0;
    if (!emptyInput && saved.applications === 0 && saved.projects === 0) {
      await this.markError(
        connector.id,
        'Argo CD data did not include any readable applications or projects.',
      );
      throw new BadRequestException(
        'Argo CD data did not include any readable applications or projects.',
      );
    }
    const now = new Date();
    await this.prisma.connector.update({
      where: { id: connector.id },
      data: {
        status: ConnectorStatus.connected,
        lastSeenAt: now,
        lastError: null,
        applicationsSeen: saved.applications,
        projectsSeen: saved.projects,
      },
    });
    this.logger.log(
      `[connector] snapshot saved connector=${connector.id} applications=${saved.applications} projects=${saved.projects}`,
    );
    return saved;
  }

  async report(credential: string, error: string) {
    const connector = await this.authenticate(credential);
    await this.markError(connector.id, redactText(error));
    return { connectorId: connector.id, status: 'error' as const };
  }

  private async authenticate(credential: string) {
    if (!credential || credential.length < 20 || credential.length > 200) {
      throw new UnauthorizedException();
    }
    const connector = await this.prisma.connector.findFirst({
      where: { credentialHash: hashCredential(credential) },
    });
    if (!connector || connector.revokedAt || connector.status === ConnectorStatus.revoked) {
      throw new UnauthorizedException();
    }
    return connector;
  }

  private async ownerId(organizationId: number): Promise<number> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (organization?.createdById) return organization.createdById;
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId },
      orderBy: { id: 'asc' },
    });
    if (!member) {
      throw new BadRequestException('This organization has no owner for imported applications.');
    }
    return member.userId;
  }

  private async markError(connectorId: number, message: string) {
    await this.prisma.connector.update({
      where: { id: connectorId },
      data: {
        status: ConnectorStatus.error,
        lastSeenAt: new Date(),
        lastError: redactText(message),
      },
    });
  }

  private enrollmentResponse(
    id: number,
    name: string,
    argoUrl: string,
    enrollmentToken: string,
    expiresAt: Date,
    apiUrl: string,
    customCa: boolean,
  ) {
    return {
      id,
      name,
      status: 'pending' as const,
      expiresAt: expiresAt.toISOString(),
      enrollmentToken,
      enrollmentCommand: enrollmentCommand(enrollmentToken),
      manifest: renderManifest({
        apiUrl,
        argoUrl,
        name,
        image: connectorImage(),
        customCa,
      }),
      installCommand: renderInstallCommand({
        apiUrl,
        argoUrl,
        name,
        image: connectorImage(),
        customCa,
        enrollmentToken,
        expiresAt: expiresAt.toISOString(),
      }),
      caSecretCommand: customCa
        ? 'kubectl -n gitops-insights create secret generic argocd-ca --from-file=ca.crt=./ca.crt'
        : null,
      localSecretCommand:
        "kubectl -n gitops-insights create secret generic argocd-readonly --from-literal=token=YOUR_ARGO_CD_TOKEN",
      recoveryCommands:
        'kubectl -n gitops-insights delete secret gitops-insights-enrollment --ignore-not-found\nkubectl -n gitops-insights delete secret gitops-insights-connector-state --ignore-not-found\nkubectl -n gitops-insights rollout restart deployment/gitops-insights-connector',
    };
  }

  private toView(row: {
    id: number;
    name: string;
    argoUrl: string;
    status: string;
    lastSeenAt: Date | null;
    lastError: string | null;
    applicationsSeen: number;
    projectsSeen: number;
    createdAt: Date;
    enrollments: { expiresAt: Date; usedAt: Date | null }[];
  }) {
    const enrollment = row.enrollments[0];
    const enrollmentState = !enrollment
      ? 'none'
      : enrollment.usedAt
        ? 'used'
        : enrollment.expiresAt.getTime() <= Date.now()
          ? 'expired'
          : 'open';
    return {
      id: row.id,
      name: row.name,
      argoUrl: row.argoUrl,
      status: displayStatus(row),
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      lastError: row.lastError,
      applicationsSeen: row.applicationsSeen,
      projectsSeen: row.projectsSeen,
      createdAt: row.createdAt.toISOString(),
      enrollmentState,
      enrollmentExpiresAt: enrollment?.expiresAt.toISOString() ?? null,
    };
  }
}
