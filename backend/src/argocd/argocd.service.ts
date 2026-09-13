import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  extractArgoItems,
  mapArgoApplication,
  mapArgoProject,
  type MappedArgoApplication,
  type MappedArgoProject,
} from './argo-application';

process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= '0';

export interface ArgoConnection {
  url: string;
  token: string;
}

const PLACEHOLDER_TOKENS = new Set(['', 'PASTE_TOKEN_HERE', 'changeme', 'replace-me']);

@Injectable()
export class ArgocdService {
  private readonly logger = new Logger(ArgocdService.name);

  fallbackConnection(): ArgoConnection | undefined {
    const url = (process.env.ARGOCD_URL || '').replace(/\/$/, '');
    const token = (process.env.ARGOCD_TOKEN || '').trim();
    if (!url || PLACEHOLDER_TOKENS.has(token) || token.length < 8) {
      return undefined;
    }
    return { url, token };
  }

  resolveConnection(connection?: ArgoConnection): ArgoConnection | undefined {
    if (connection?.url && connection.token && !PLACEHOLDER_TOKENS.has(connection.token)) {
      return {
        url: connection.url.replace(/\/$/, ''),
        token: connection.token,
      };
    }
    return this.fallbackConnection();
  }

  async listApplications(
    connection?: ArgoConnection,
  ): Promise<MappedArgoApplication[]> {
    const payload = await this.request<unknown>(
      '/api/v1/applications',
      connection,
    );
    const items = extractArgoItems(payload);
    const mapped = items
      .map((item) => mapArgoApplication(item))
      .filter((item): item is MappedArgoApplication => item !== null);
    this.logger.log(
      `Argo CD applications fetched=${items.length} mapped=${mapped.length}`,
    );
    return mapped;
  }

  async listProjects(connection?: ArgoConnection): Promise<MappedArgoProject[]> {
    const payload = await this.request<unknown>('/api/v1/projects', connection);
    const items = extractArgoItems(payload);
    const mapped = items
      .map((item) => mapArgoProject(item))
      .filter((item): item is MappedArgoProject => item !== null);
    this.logger.log(
      `Argo CD projects fetched=${items.length} mapped=${mapped.length}`,
    );
    return mapped;
  }

  async getApplication(name: string, connection?: ArgoConnection) {
    return this.request<Record<string, unknown>>(
      `/api/v1/applications/${encodeURIComponent(name)}`,
      connection,
    );
  }

  async testConnection(
    url: string,
    token: string,
  ): Promise<{ ok: boolean; status: number; error?: string }> {
    try {
      const response = await this.rawRequest(
        `${url.replace(/\/$/, '')}/api/v1/applications?limit=1`,
        token,
      );
      if (!response.ok) {
        const body = await response.text();
        return {
          ok: false,
          status: response.status,
          error: body.slice(0, 300),
        };
      }
      return { ok: true, status: response.status };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async request<T>(path: string, connection?: ArgoConnection): Promise<T> {
    const resolved = this.resolveConnection(connection);
    if (!resolved) {
      throw new BadRequestException(
        'No Argo CD credentials available. Connect the integration or set ARGOCD_URL and ARGOCD_TOKEN.',
      );
    }

    const response = await this.rawRequest(`${resolved.url}${path}`, resolved.token);
    this.logger.log(`Argo CD ${path} → ${response.status}`);
    const body = await response.text();
    if (!response.ok) {
      this.logger.error(
        `Argo CD API error ${response.status} ${path}: ${body.slice(0, 500)}`,
      );
      throw new BadRequestException(
        `Argo CD request failed (${response.status}) for ${path}.`,
      );
    }
    if (!body) {
      return {} as T;
    }
    return JSON.parse(body) as T;
  }

  private async rawRequest(url: string, token: string) {
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `argocd.token=${token}`,
      },
    });
  }
}
