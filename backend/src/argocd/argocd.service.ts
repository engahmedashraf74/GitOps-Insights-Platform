import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { mapArgoApplication, type MappedArgoApplication } from './argo-application';

process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= '0';

export interface ArgoConnection {
  url: string;
  token: string;
}

@Injectable()
export class ArgocdService {
  private readonly logger = new Logger(ArgocdService.name);

  private readonly fallbackUrl =
    process.env.ARGOCD_URL ||
    'https://argocd-server.argocd.svc.cluster.local';

  private readonly fallbackToken = process.env.ARGOCD_TOKEN;

  async listApplications(
    connection?: ArgoConnection,
  ): Promise<MappedArgoApplication[]> {
    const payload = await this.request<{ items?: unknown[] }>(
      '/api/v1/applications',
      connection,
    );
    const items = Array.isArray(payload.items) ? payload.items : [];
    return items
      .map((item) => mapArgoApplication(item))
      .filter((item): item is MappedArgoApplication => item !== null);
  }

  async getApplication(name: string, connection?: ArgoConnection) {
    return this.request<Record<string, unknown>>(
      `/api/v1/applications/${encodeURIComponent(name)}`,
      connection,
    );
  }

  async testConnection(url: string, token: string): Promise<{ ok: boolean; status: number }> {
    const normalized = url.replace(/\/$/, '');
    const response = await fetch(`${normalized}/api/v1/applications?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return {
      ok: response.ok,
      status: response.status,
    };
  }

  private resolve(connection?: ArgoConnection) {
    return {
      url: (connection?.url || this.fallbackUrl).replace(/\/$/, ''),
      token: connection?.token || this.fallbackToken,
    };
  }

  private async request<T>(path: string, connection?: ArgoConnection): Promise<T> {
    const { url, token } = this.resolve(connection);
    const response = await fetch(`${url}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    this.logger.log(`Argo CD ${path} → ${response.status}`);
    if (!response.ok) {
      throw new BadRequestException(
        `Argo CD request failed (${response.status}) for ${path}.`,
      );
    }
    return response.json() as Promise<T>;
  }
}
