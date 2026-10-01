import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  extractArgoItems,
  mapArgoApplication,
  mapArgoProject,
  type MappedArgoApplication,
  type MappedArgoProject,
} from './argo-application';
import { assertSafeArgoUrl } from './argo-url';

const REQUEST_TIMEOUT_MS = Number(process.env.ARGOCD_TIMEOUT_MS || 15000);

export interface ArgoConnection {
  url: string;
  token: string;
}

const PLACEHOLDER_TOKENS = new Set(['', 'PASTE_TOKEN_HERE', 'changeme', 'replace-me']);

@Injectable()
export class ArgocdService {
  private readonly logger = new Logger(ArgocdService.name);

  fallbackConnection(): ArgoConnection | undefined {
    if (!this.devFallbackEnabled()) {
      return undefined;
    }
    const url = (process.env.ARGOCD_URL || '').replace(/\/$/, '');
    const token = (process.env.ARGOCD_TOKEN || '').trim();
    if (!url || PLACEHOLDER_TOKENS.has(token) || token.length < 8) {
      return undefined;
    }
    this.logger.log('[argocd] using development env fallback credentials');
    return { url: assertSafeArgoUrl(url), token };
  }

  private devFallbackEnabled(): boolean {
    // Fail closed in production: a shared env-level Argo CD would otherwise be
    // imported into every organization.
    if (process.env.NODE_ENV === 'production') {
      return process.env.ARGOCD_ENV_FALLBACK === 'true';
    }
    return process.env.ARGOCD_ENV_FALLBACK !== 'false';
  }

  resolveConnection(connection?: ArgoConnection): ArgoConnection | undefined {
    if (connection?.url && connection.token && !PLACEHOLDER_TOKENS.has(connection.token)) {
      return {
        url: assertSafeArgoUrl(connection.url),
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
    let safeUrl: string;
    try {
      safeUrl = assertSafeArgoUrl(url);
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    try {
      const response = await this.rawRequest(
        `${safeUrl}/api/v1/applications?limit=1`,
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
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new BadRequestException(
        `Argo CD returned a response for ${path} that is not valid JSON.`,
      );
    }
  }

  private async rawRequest(url: string, token: string) {
    try {
      return await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `argocd.token=${token}`,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new BadRequestException(
          `Argo CD did not respond within ${REQUEST_TIMEOUT_MS}ms.`,
        );
      }
      throw error;
    }
  }
}
