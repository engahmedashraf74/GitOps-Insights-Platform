import { BadRequestException } from '@nestjs/common';
import { createHash, randomBytes, X509Certificate } from 'node:crypto';
import { isMetadataAddress } from '../argocd/argo-url';

export const ENROLLMENT_TTL_MS = 15 * 60 * 1000;
export const STALE_AFTER_MS = 90 * 1000;
export const MAX_SNAPSHOT_APPLICATIONS = 100;
export const MAX_SNAPSHOT_PROJECTS = 50;
export const MAX_SNAPSHOT_CHARS = 100_000;
export const REQUEST_TIMEOUT_MS = 12_000;
export const CONNECTOR_VERSION = '0.1.0';
export const DEFAULT_CONNECTOR_IMAGE = `gitops-insights-connector:${CONNECTOR_VERSION}`;

const METADATA_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.google.com',
  'instance-data',
]);

export type ConnectorViewStatus =
  | 'pending'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'revoked';

export function hashCredential(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createCredential(): string {
  return randomBytes(32).toString('base64url');
}

export function displayStatus(
  row: { status: string; lastSeenAt: Date | null },
  now = Date.now(),
): ConnectorViewStatus {
  if (row.status === 'revoked') return 'revoked';
  if (row.status === 'pending') return 'pending';
  const fresh =
    row.lastSeenAt !== null && now - row.lastSeenAt.getTime() <= STALE_AFTER_MS;
  if (!fresh) return 'disconnected';
  if (row.status === 'error') return 'error';
  if (row.status === 'connected') return 'connected';
  return 'disconnected';
}

export function assertClusterArgoUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequestException('Argo CD URL must be a valid HTTPS URL.');
  }
  if (url.protocol !== 'https:') {
    throw new BadRequestException('Argo CD URL must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new BadRequestException('Argo CD URL must not include a username or password.');
  }
  const host = url.hostname.toLowerCase();
  if (METADATA_HOSTS.has(host) || isMetadataAddress(host)) {
    throw new BadRequestException('That Argo CD URL is not allowed.');
  }
  return url.origin;
}

export function publicApiUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.CONNECTOR_API_URL?.trim();
  const value = configured || 'https://api.gitops-insights.com';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException('CONNECTOR_API_URL must be a valid HTTPS URL.');
  }
  if (url.protocol !== 'https:') {
    throw new BadRequestException('CONNECTOR_API_URL must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new BadRequestException('CONNECTOR_API_URL must not include credentials.');
  }
  return url.origin;
}

export function assertConnectorImage(value: string | undefined): string {
  const image = (value ?? DEFAULT_CONNECTOR_IMAGE).trim();
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?(?:\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)*:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(image)) {
    throw new BadRequestException(
      'Set CONNECTOR_IMAGE to a name and version tag, such as gitops-insights-connector:0.1.0.',
    );
  }
  if (image.endsWith(':latest')) {
    throw new BadRequestException('CONNECTOR_IMAGE must be pinned to a version tag.');
  }
  return image;
}

export function connectorImage(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.CONNECTOR_IMAGE?.trim();
  return assertConnectorImage(configured || undefined);
}

export function enrollmentCommand(token: string): string {
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) {
    throw new BadRequestException('Enrollment token is not valid.');
  }
  return `kubectl -n gitops-insights create secret generic gitops-insights-enrollment --from-literal=token='${token}'`;
}

const PRIVATE_KEY_PEM = /-----BEGIN (?:RSA |EC |ENCRYPTED |OPENSSH )?PRIVATE KEY-----/;

export function assertCaCertificate(pem: string): string {
  const text = pem.replaceAll('\\n', '\n').trim();
  if (!text) throw new BadRequestException('The CA certificate is empty.');
  if (PRIVATE_KEY_PEM.test(text)) {
    throw new BadRequestException('A private key was provided. Use the CA certificate only.');
  }
  const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  if (!blocks?.length) {
    throw new BadRequestException('The CA certificate must be PEM data.');
  }
  const now = Date.now();
  for (const block of blocks) {
    let certificate: X509Certificate;
    try {
      certificate = new X509Certificate(block);
    } catch {
      throw new BadRequestException('The CA certificate is not a valid X.509 certificate.');
    }
    if (!certificate.ca) {
      throw new BadRequestException('This certificate is not a certificate authority.');
    }
    const validFrom = Date.parse(certificate.validFrom);
    const validTo = Date.parse(certificate.validTo);
    if (Number.isNaN(validFrom) || validFrom > now) {
      throw new BadRequestException('The CA certificate is not yet valid.');
    }
    if (Number.isNaN(validTo) || validTo <= now) {
      throw new BadRequestException('The CA certificate is expired.');
    }
  }
  return blocks.map((block) => block.trim()).join('\n');
}

export function assertConnectorName(value: string | undefined): string {
  const name = (value ?? 'Private cluster').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,58}$/.test(name)) {
    throw new BadRequestException(
      'Use a connector name of letters, numbers, spaces, dots, hyphens, or underscores.',
    );
  }
  return name;
}

export function assertSnapshotShape(body: unknown): {
  applications: unknown[];
  projects: unknown[];
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Snapshot must be an object.');
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== 'applications' && key !== 'projects') {
      throw new BadRequestException('Snapshot has an unsupported field.');
    }
  }
  if (!Array.isArray(record.applications) || !Array.isArray(record.projects)) {
    throw new BadRequestException('Snapshot must include applications and projects arrays.');
  }
  if (record.applications.length > MAX_SNAPSHOT_APPLICATIONS) {
    throw new BadRequestException('Snapshot includes too many applications.');
  }
  if (record.projects.length > MAX_SNAPSHOT_PROJECTS) {
    throw new BadRequestException('Snapshot includes too many projects.');
  }
  const items = [...record.applications, ...record.projects];
  if (items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new BadRequestException('Each application and project must be an object.');
  }
  if (JSON.stringify(body).length > MAX_SNAPSHOT_CHARS) {
    throw new BadRequestException('Snapshot is too large.');
  }
  return {
    applications: record.applications,
    projects: record.projects,
  };
}

export function redactText(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[redacted]')
    .replace(/[A-Za-z0-9_-]{43,}/g, '[redacted]')
    .slice(0, 160);
}

export function renderManifest(input: {
  apiUrl: string;
  argoUrl: string;
  name: string;
  image?: string;
  customCa?: boolean;
}): string {
  const apiUrl = publicApiUrl({ CONNECTOR_API_URL: input.apiUrl });
  const argoUrl = assertClusterArgoUrl(input.argoUrl);
  const name = assertConnectorName(input.name);
  const image = assertConnectorImage(input.image);
  const label = name.replace(/[^A-Za-z0-9_.-]/g, '-');
  const caNote = input.customCa
    ? `# This Argo CD endpoint uses a private CA. Create secret argocd-ca from that CA certificate only.
# kubectl -n gitops-insights create secret generic argocd-ca --from-file=ca.crt=./ca.crt
# Do not put a private key in that secret.
`
    : `# No private CA is configured. A publicly trusted Argo CD certificate needs nothing else.
`;
  const caEnv = input.customCa
    ? `            - name: ARGOCD_CA_FILE
              value: /etc/gitops-insights/argocd-ca/ca.crt
`
    : '';
  const caMount = input.customCa
    ? `            - name: argo-ca
              mountPath: /etc/gitops-insights/argocd-ca
              readOnly: true
`
    : '';
  const caVolume = input.customCa
    ? `        - name: argo-ca
          secret:
            secretName: argocd-ca
            items:
              - key: ca.crt
                path: ca.crt
`
    : '';
  return `# GitOps Insights private-cluster connector ${CONNECTOR_VERSION}
${caNote}# Install this on any Kubernetes cluster the agent can use to reach Argo CD.
# This file contains no credentials. Do not add tokens to it or commit secrets.
# 1. Build or load the image ${image} into this cluster.
# 2. Create the Argo CD token secret in this cluster with the command shown in GitOps Insights.
# 3. Create the one-time enrollment secret with the command shown in GitOps Insights.
# 4. Apply this file.
# The agent stores its credential in secret gitops-insights-connector-state.
# That secret stays in the cluster when the pod is replaced, and the new pod reconnects.
# It is not in this file. Do not export it into Git.
# To rotate: generate a new enrollment in GitOps Insights, replace gitops-insights-enrollment,
# delete secret gitops-insights-connector-state, then restart this deployment.
# Do not disable TLS validation. The SaaS connection always uses public certificate authorities.
apiVersion: v1
kind: Namespace
metadata:
  name: gitops-insights
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: gitops-insights-connector
  namespace: gitops-insights
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: gitops-insights-connector
  namespace: gitops-insights
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["gitops-insights-connector-state"]
    verbs: ["get", "update", "patch"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: gitops-insights-connector
  namespace: gitops-insights
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: gitops-insights-connector
subjects:
  - kind: ServiceAccount
    name: gitops-insights-connector
    namespace: gitops-insights
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gitops-insights-connector
  namespace: gitops-insights
  labels:
    app: gitops-insights-connector
spec:
  replicas: 1
  selector:
    matchLabels:
      app: gitops-insights-connector
  template:
    metadata:
      labels:
        app: gitops-insights-connector
        gitops-insights/connector-name: "${label}"
    spec:
      serviceAccountName: gitops-insights-connector
      automountServiceAccountToken: true
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: connector
          image: "${image}"
          imagePullPolicy: IfNotPresent
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          env:
            - name: GITOPS_INSIGHTS_URL
              value: "${apiUrl}"
            - name: ENROLLMENT_TOKEN
              valueFrom:
                secretKeyRef:
                  name: gitops-insights-enrollment
                  key: token
            - name: ARGOCD_URL
              value: "${argoUrl}"
            - name: ARGOCD_TOKEN
              valueFrom:
                secretKeyRef:
                  name: argocd-readonly
                  key: token
${caEnv}          resources:
            requests:
              cpu: 20m
              memory: 64Mi
            limits:
              memory: 128Mi
          volumeMounts:
            - name: tmp
              mountPath: /tmp
${caMount}      volumes:
        - name: tmp
          emptyDir: {}
${caVolume}`;
}
