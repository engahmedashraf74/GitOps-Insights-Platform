import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ArgocdService } from '../argocd/argocd.service';
import { encryptSecret, decryptSecret } from '../common/crypto/secret-box';
import type { JwtUser } from '../common/types/jwt-user';
import { IntegrationProvider, IntegrationStatus } from '@prisma/client';

const CATALOG = [
  {
    provider: IntegrationProvider.argocd,
    name: 'Argo CD',
    description:
      'Sync GitOps applications, health, and revision state from your Argo CD instance.',
  },
  {
    provider: IntegrationProvider.github,
    name: 'GitHub',
    description: 'Link repositories and deployment commits to application history.',
  },
  {
    provider: IntegrationProvider.gitlab,
    name: 'GitLab',
    description: 'Track merge activity and GitOps manifests across GitLab projects.',
  },
  {
    provider: IntegrationProvider.bitbucket,
    name: 'Bitbucket',
    description: 'Connect Bitbucket repositories used by your delivery pipelines.',
  },
  {
    provider: IntegrationProvider.slack,
    name: 'Slack',
    description: 'Route deployment failure alerts to the channels your team already uses.',
  },
] as const;

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly argocd: ArgocdService,
  ) {}

  async list(user: JwtUser) {
    const organization = await this.organizations.ensureForUser(user.userId);
    const stored = await this.prisma.integration.findMany({
      where: { organizationId: organization.id },
    });

    return CATALOG.map((item) => {
      const match = stored.find((row) => row.provider === item.provider);
      const comingSoon = item.provider !== IntegrationProvider.argocd;
      return {
        provider: item.provider,
        name: item.name,
        description: item.description,
        status: comingSoon
          ? IntegrationStatus.coming_soon
          : (match?.status ?? IntegrationStatus.disconnected),
        url: match?.url ?? undefined,
        connected: match?.status === IntegrationStatus.connected,
      };
    });
  }

  async test(user: JwtUser, url: string, token: string) {
    await this.organizations.ensureForUser(user.userId);
    const result = await this.argocd.testConnection(url, token);
    if (!result.ok) {
      throw new BadRequestException(
        `Argo CD rejected the credentials (HTTP ${result.status}).`,
      );
    }
    return { ok: true, message: 'Connection succeeded. Token was not stored.' };
  }

  async connect(user: JwtUser, url: string, token: string) {
    const organization = await this.organizations.ensureForUser(user.userId);
    const result = await this.argocd.testConnection(url, token);
    if (!result.ok) {
      throw new BadRequestException(
        `Unable to connect to Argo CD (HTTP ${result.status}).`,
      );
    }

    const record = await this.prisma.integration.upsert({
      where: {
        organizationId_provider: {
          organizationId: organization.id,
          provider: IntegrationProvider.argocd,
        },
      },
      update: {
        url,
        status: IntegrationStatus.connected,
        credentialsEncrypted: encryptSecret(token),
      },
      create: {
        organizationId: organization.id,
        provider: IntegrationProvider.argocd,
        url,
        status: IntegrationStatus.connected,
        credentialsEncrypted: encryptSecret(token),
      },
    });

    return {
      provider: record.provider,
      status: record.status,
      url: record.url,
    };
  }

  async disconnect(user: JwtUser) {
    const organization = await this.organizations.ensureForUser(user.userId);
    await this.prisma.integration.deleteMany({
      where: {
        organizationId: organization.id,
        provider: IntegrationProvider.argocd,
      },
    });
    return { ok: true };
  }

  async getArgoConnection(userId: number) {
    const organization = await this.organizations.ensureForUser(userId);
    const record = await this.prisma.integration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: organization.id,
          provider: IntegrationProvider.argocd,
        },
      },
    });
    if (!record?.credentialsEncrypted || !record.url) {
      return undefined;
    }
    try {
      return {
        url: record.url,
        token: decryptSecret(record.credentialsEncrypted),
      };
    } catch {
      throw new NotFoundException('Stored Argo CD credentials could not be decrypted.');
    }
  }
}
