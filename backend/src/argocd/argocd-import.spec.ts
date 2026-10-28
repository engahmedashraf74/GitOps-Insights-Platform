import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { ArgocdSyncService } from './argocd-sync.service';
import {
  assertCaCertificate,
  assertClusterArgoUrl,
  assertConnectorImage,
  assertSnapshotShape,
  publicApiUrl,
  renderInstallCommand,
  renderManifest,
} from '../connectors/connector-protocol';

describe('ArgocdSyncService.importDiscovered', () => {
  it('saves mapped applications for the given organization and does not call Argo CD', async () => {
    const projectUpsert = jest.fn(async () => ({ id: 3 }));
    const prisma = {
      organization: { findUnique: jest.fn(async () => ({ id: 4 })) },
      project: {
        findUnique: jest.fn(async () => null),
        upsert: projectUpsert,
      },
      application: {
        findFirst: jest.fn(async () => null),
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async () => ({ id: 8 })),
        deleteMany: jest.fn(),
      },
      deployment: {
        findMany: jest.fn(async () => []),
        create: jest.fn(async () => ({ id: 1 })),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      applicationEvent: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
        createMany: jest.fn(),
      },
      environment: { upsert: jest.fn(async () => ({ id: 1 })), deleteMany: jest.fn() },
      integration: { upsert: jest.fn() },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const argocd = {
      listApplications: jest.fn(),
      listProjects: jest.fn(),
      testConnection: jest.fn(),
    };
    const service = new ArgocdSyncService(prisma as never, {} as never, argocd as never);
    const result = await service.importDiscovered(
      4,
      11,
      [
        {
          metadata: { name: 'payments', uid: 'uid-1' },
          spec: {
            project: 'default',
            destination: { namespace: 'payments', server: 'https://kubernetes.default.svc' },
            source: { repoURL: 'https://example.com/repo.git', path: 'apps' },
          },
          status: {
            sync: { status: 'Synced', revision: 'abc123' },
            health: { status: 'Healthy' },
          },
        },
      ],
      [{ metadata: { name: 'default' }, spec: { description: 'Default' } }],
    );

    expect(result).toEqual({ applications: 1, projects: 1 });
    expect(projectUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_name: { organizationId: 4, name: 'default' } },
        create: expect.objectContaining({ organizationId: 4, userId: 11 }),
      }),
    );
    expect(prisma.application.deleteMany).not.toHaveBeenCalled();
    expect(prisma.integration.upsert).not.toHaveBeenCalled();
    expect(argocd.listApplications).not.toHaveBeenCalled();
    expect(argocd.listProjects).not.toHaveBeenCalled();
    expect(argocd.testConnection).not.toHaveBeenCalled();
  });
});

describe('connector URL rules', () => {
  it('allows an in-cluster HTTPS address and rejects metadata and cleartext', () => {
    expect(assertClusterArgoUrl('https://argocd-server.argocd.svc')).toBe(
      'https://argocd-server.argocd.svc',
    );
    expect(assertClusterArgoUrl('https://192.168.49.2')).toBe('https://192.168.49.2');
    expect(() => assertClusterArgoUrl('http://argocd-server.argocd.svc')).toThrow(
      BadRequestException,
    );
    expect(() => assertClusterArgoUrl('https://169.254.169.254')).toThrow(BadRequestException);
    expect(() => publicApiUrl({ CONNECTOR_API_URL: 'http://api.gitops-insights.com' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertSnapshotShape({
        applications: [],
        projects: [],
        organizationId: 2,
      }),
    ).toThrow('Snapshot has an unsupported field.');
    expect(assertConnectorImage(undefined)).toBe('gitops-insights-connector:0.1.0');
    expect(assertConnectorImage('registry.example.com/gitops-insights-connector:0.1.0')).toBe(
      'registry.example.com/gitops-insights-connector:0.1.0',
    );
    expect(() => assertConnectorImage('gitops-insights-connector:latest')).toThrow(
      BadRequestException,
    );
    expect(() => assertConnectorImage('gitops-insights-connector')).toThrow(BadRequestException);
    const manifest = renderManifest({
      apiUrl: 'https://api.gitops-insights.com',
      argoUrl: 'https://argocd.example.com',
      name: 'Production',
      image: 'registry.example.com/gitops-insights-connector:0.1.0',
    });
    expect(manifest).toContain('image: "registry.example.com/gitops-insights-connector:0.1.0"');
    expect(manifest).toContain('https://argocd.example.com');
    expect(manifest).not.toContain('ARGOCD_CA_FILE');
    expect(manifest.toLowerCase()).not.toContain('minikube');
    expect(manifest).not.toContain('stringData');
    expect(manifest).not.toContain('token=');
    expect(manifest).not.toContain('YOUR_ARGO_CD_TOKEN');
    const withCa = renderManifest({
      apiUrl: 'https://api.gitops-insights.com',
      argoUrl: 'https://argocd.internal.example',
      name: 'Production',
      customCa: true,
    });
    expect(withCa).toContain('name: ARGOCD_CA_FILE');
    expect(withCa).toContain('/etc/gitops-insights/argocd-ca/ca.crt');
    expect(withCa).toContain('readOnly: true');
    expect(withCa).toContain('secretName: argocd-ca');
    expect(withCa).not.toContain('BEGIN CERTIFICATE');
    expect(withCa).not.toContain('PRIVATE KEY');
    expect(withCa.toLowerCase()).not.toContain('minikube');
    const dir = mkdtempSync(join(tmpdir(), 'goi-ca-'));
    try {
      execFileSync(
        'openssl',
        [
          'req', '-x509', '-newkey', 'rsa:2048', '-keyout', 'ca.key', '-out', 'ca.crt',
          '-days', '30', '-nodes', '-subj', '/CN=ApiTestCA',
          '-addext', 'basicConstraints=critical,CA:TRUE',
        ],
        { cwd: dir, stdio: 'pipe' },
      );
      const pem = readFileSync(join(dir, 'ca.crt'), 'utf8');
      expect(assertCaCertificate(pem)).toContain('BEGIN CERTIFICATE');
      expect(() => assertCaCertificate(readFileSync(join(dir, 'ca.key'), 'utf8'))).toThrow(
        /private key/,
      );
      expect(withCa).not.toContain(pem.trim().split('\n')[1]);
      const command = renderInstallCommand({
        apiUrl: 'https://api.gitops-insights.com',
        argoUrl: 'https://argocd.example.com',
        name: 'Production',
        image: 'registry.example.com/gitops-insights-connector:0.1.0',
        customCa: true,
        enrollmentToken: 'abcdefghijklmnopqrstuvwxyz012345',
        expiresAt: '2026-10-28T12:00:00.000Z',
      });
      expect(command.startsWith("bash <<'GITOPS_INSTALL'\n")).toBe(true);
      expect(command).toContain('read -r answer </dev/tty');
      expect(command).toContain('read -rs ARGOCD_TOKEN </dev/tty');
      expect(command).toContain('printf "\\n" >/dev/tty');
      expect(command).toContain('GITOPS_ASSUME_YES');
      expect(command).not.toContain('[[ ! -t 0 ]]');
      expect(command).not.toContain('read -rs ARGOCD_TOKEN\n');
      expect(command).toContain('registry.example.com/gitops-insights-connector:0.1.0');
      expect(command).toContain('ARGOCD_CA_FILE');
      expect(command).not.toContain('-----BEGIN CERTIFICATE-----');
      expect(command).not.toContain('-----BEGIN PRIVATE KEY-----');
      expect(command).not.toContain('--from-literal');
      expect(command.toLowerCase()).not.toContain('minikube');
      const inner = command.split("bash <<'GITOPS_INSTALL'\n")[1].replace(/\nGITOPS_INSTALL\n$/, '\n');
      expect(inner).not.toContain('GITOPS_INSTALL');
      const bashBins = ['bash', 'C:\\Program Files\\Git\\bin\\bash.exe'];
      let syntaxChecked = false;
      for (const bin of bashBins) {
        try {
          execFileSync(bin, ['-n'], { input: inner, stdio: 'pipe' });
          syntaxChecked = true;
          break;
        } catch (error) {
          const missing = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
          if (!missing) throw error;
        }
      }
      expect(syntaxChecked).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
