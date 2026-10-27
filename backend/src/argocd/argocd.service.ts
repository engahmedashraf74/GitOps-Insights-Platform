import { readFileSync } from 'node:fs';
import https from 'node:https';
import { isIP } from 'node:net';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  extractArgoItems,
  mapArgoApplication,
  mapArgoProject,
  type MappedArgoApplication,
  type MappedArgoProject,
} from './argo-application';
import {
  ArgoUrlError,
  assertSafeArgoUrl,
  createPinnedLookup,
  describeArgoHttpStatus,
  describeArgoTransportError,
  redactSecrets,
  type SafeArgoDestination,
} from './argo-url';

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
    return { url, token };
  }

  private devFallbackEnabled(): boolean {
    if (process.env.ARGOCD_ENV_FALLBACK === 'true') return true;
    if (process.env.ARGOCD_ENV_FALLBACK === 'false') return false;
    return process.env.NODE_ENV !== 'production';
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
      const target = await this.safeDestination(url);
      const applications = await this.rawRequest(
        `${target.url.origin}/api/v1/applications?limit=1`,
        token,
        target.addresses,
      );
      if (!applications.ok) {
        return {
          ok: false,
          status: applications.status,
          error: describeArgoHttpStatus(applications.status, 'applications'),
        };
      }
      const projects = await this.rawRequest(
        `${target.url.origin}/api/v1/projects`,
        token,
        target.addresses,
      );
      if (!projects.ok) {
        return {
          ok: false,
          status: projects.status,
          error: describeArgoHttpStatus(projects.status, 'projects'),
        };
      }
      return { ok: true, status: projects.status };
    } catch (error) {
      if (error instanceof BadRequestException) {
        const response = error.getResponse();
        const message =
          typeof response === 'string'
            ? response
            : (response as { message?: string | string[] }).message;
        return {
          ok: false,
          status: 0,
          error: Array.isArray(message) ? message.join(', ') : message || 'Argo CD could not be reached.',
        };
      }
      return {
        ok: false,
        status: 0,
        error:
          error instanceof ArgoUrlError
            ? error.message
            : describeArgoTransportError(error),
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

    const target = await this.safeDestination(resolved.url);
    const response = await this.rawRequest(
      `${target.url.origin}${path}`,
      resolved.token,
      target.addresses,
    );
    this.logger.log(`Argo CD ${path} → ${response.status}`);
    const body = await response.text();
    if (!response.ok) {
      this.logger.error(
        `Argo CD API error ${response.status} ${path}: ${redactSecrets(body).slice(0, 180)}`,
      );
      const resource = path.includes('/projects') ? 'projects' : 'applications';
      throw new BadRequestException(describeArgoHttpStatus(response.status, resource));
    }
    if (!body) {
      return {} as T;
    }
    return JSON.parse(body) as T;
  }

  private async safeDestination(raw: string): Promise<SafeArgoDestination> {
    try {
      return await assertSafeArgoUrl(raw, {
        production: process.env.NODE_ENV === 'production',
      });
    } catch (error) {
      if (error instanceof ArgoUrlError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private async rawRequest(url: string, token: string, addresses: readonly string[]) {
    const ca = loadCaCertificate();
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    return pinnedRequest(url, headers, addresses, ca);
  }
}

function loadCaCertificate(): string | undefined {
  const file = process.env.ARGOCD_CA_FILE?.trim();
  if (file) {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      throw new BadRequestException(
        'ARGOCD_CA_FILE is set, but the certificate file could not be read.',
      );
    }
  }
  const inline = process.env.ARGOCD_CA_CERT?.trim();
  if (!inline) return undefined;
  return inline.replaceAll('\\n', '\n');
}

function pinnedRequest(
  url: string,
  headers: Record<string, string>,
  addresses: readonly string[],
  ca?: string,
): Promise<Response> {
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
  const lookup = createPinnedLookup(addresses, {
    production: process.env.NODE_ENV === 'production',
  });
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers,
        lookup,
        servername: isIP(hostname) ? undefined : hostname,
        rejectUnauthorized: true,
        ca,
        timeout: 12_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve(new Response(body, { status: res.statusCode ?? 0 }));
        });
      },
    );
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    req.end();
  });
}
