import { Injectable, Logger } from '@nestjs/common';

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

  async getApplication(name: string, connection?: ArgoConnection) {
    const url = (connection?.url || this.fallbackUrl).replace(/\/$/, '');
    const token = connection?.token || this.fallbackToken;

    const response = await fetch(`${url}/api/v1/applications/${name}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    this.logger.log(`Argo CD application lookup status ${response.status}`);
    return response.json() as Promise<Record<string, unknown>>;
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
}
