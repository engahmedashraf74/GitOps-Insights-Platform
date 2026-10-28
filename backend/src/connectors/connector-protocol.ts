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
# The install command from GitOps Insights creates the secrets, then applies this file.
# The agent stores its credential in secret gitops-insights-connector-state.
# That secret stays in the cluster when the pod is replaced, and the new pod reconnects.
# It is not in this file. Do not export it into Git.
# A new install command stops the pod, deletes gitops-insights-connector-state, and starts
# again when its enrollment token is different. Re-running the same command leaves that secret.
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

export function renderInstallCommand(input: {
  apiUrl: string;
  argoUrl: string;
  name: string;
  image?: string;
  customCa?: boolean;
  enrollmentToken: string;
  expiresAt: string;
}): string {
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(input.enrollmentToken)) {
    throw new BadRequestException('Enrollment token is not valid.');
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.expiresAt)) {
    throw new BadRequestException('Enrollment expiry is not valid.');
  }
  const manifest = renderManifest(input);
  if (manifest.includes('GITOPS_MANIFEST_EOF') || manifest.includes('GITOPS_INSTALL')) {
    throw new BadRequestException('The install command could not be rendered.');
  }
  const image = assertConnectorImage(input.image);
  const caBlock = input.customCa
    ? [
        'CA_FILE="${ARGOCD_CA_FILE:-./ca.crt}"',
        'if [[ ! -f "$CA_FILE" ]]; then',
        '  echo "This Argo CD endpoint uses a private CA. Save the CA certificate as ./ca.crt or set ARGOCD_CA_FILE to that file." >&2',
        '  exit 1',
        'fi',
        "if grep -q -- 'PRIVATE KEY' \"$CA_FILE\"; then",
        '  echo "The CA file contains a private key. Provide the certificate only." >&2',
        '  exit 1',
        'fi',
        "if ! grep -q -- 'BEGIN CERTIFICATE' \"$CA_FILE\"; then",
        '  echo "The CA file does not contain a PEM certificate." >&2',
        '  exit 1',
        'fi',
        'ca_hash="$(hash_stdin < "$CA_FILE")"',
        'current_ca="$(ca_now)"',
        'if [[ "$current_ca" != "$ca_hash" ]]; then ca_changed=1; fi',
      ]
    : ['CA_FILE=""'];
  const caApply = input.customCa
    ? [
        'kubectl -n "$NS" create secret generic argocd-ca --from-file="ca.crt=${CA_FILE}" --dry-run=client -o yaml | kubectl apply -f -',
      ]
    : [];
  const lines = [
    "bash <<'GITOPS_INSTALL'",
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    `ENROLLMENT_TOKEN='${input.enrollmentToken}'`,
    `IMAGE='${image}'`,
    `EXPIRES_AT='${input.expiresAt}'`,
    'NS=gitops-insights',
    'tmp=""',
    'cleanup() {',
    '  if [[ -n "$tmp" ]]; then rm -f "$tmp"; fi',
    '  unset ARGOCD_TOKEN || true',
    '  unset ENROLLMENT_TOKEN || true',
    '}',
    'trap cleanup EXIT',
    'echo "GitOps Insights private-cluster connector"',
    'echo "This enrollment expires at ${EXPIRES_AT} and works once."',
    'echo "Image: ${IMAGE}"',
    'echo "imagePullPolicy is IfNotPresent. This command does not build an image or publish one."',
    'echo "Load ${IMAGE} into this cluster if the nodes cannot already run it."',
    'echo "It creates namespace ${NS}, a ServiceAccount, a namespace Role, Secrets, and one Deployment."',
    'echo "The Deployment makes outbound HTTPS calls only. It does not create a Service or Ingress."',
    'echo "The Role can create Secrets in ${NS} and can get, update, and patch gitops-insights-connector-state."',
    'echo "Paste the Argo CD API token when asked. It stays in this terminal and is not sent to GitOps Insights."',
    'if ! command -v kubectl >/dev/null 2>&1; then',
    '  echo "kubectl is required. Install it, select the cluster context, and run this command again." >&2',
    '  exit 1',
    'fi',
    'if ! command -v mktemp >/dev/null 2>&1; then',
    '  echo "mktemp is required." >&2',
    '  exit 1',
    'fi',
    'if ! kubectl cluster-info >/dev/null 2>&1; then',
    '  echo "kubectl cannot reach a cluster. Select the right context, then run this command again." >&2',
    '  exit 1',
    'fi',
    'context="$(kubectl config current-context 2>/dev/null || true)"',
    'echo "Cluster context: ${context:-unknown}"',
    'if [[ "${GITOPS_ASSUME_YES:-}" != "1" ]]; then',
    '  if [[ ! -t 0 ]]; then',
    '    echo "Run this in an interactive terminal, or set GITOPS_ASSUME_YES=1 and ARGOCD_TOKEN." >&2',
    '    exit 1',
    '  fi',
    '  printf "Install into this context? Type y to continue: "',
    '  read -r answer',
    '  case "$answer" in',
    '    y|Y) ;;',
    '    *) echo "Cancelled."; exit 1 ;;',
    '  esac',
    'fi',
    'if [[ -z "${ARGOCD_TOKEN:-}" ]]; then',
    '  if [[ ! -t 0 ]]; then',
    '    echo "Set ARGOCD_TOKEN in the environment. Do not put it in the copied command." >&2',
    '    exit 1',
    '  fi',
    '  printf "Paste the Argo CD API token. It will not be shown: "',
    '  read -rs ARGOCD_TOKEN',
    '  printf "\\n"',
    'fi',
    'if [[ -z "${ARGOCD_TOKEN}" ]]; then',
    '  echo "The Argo CD token was empty." >&2',
    '  exit 1',
    'fi',
    'if [[ "$ARGOCD_TOKEN" == *$\'\\n\'* || "$ARGOCD_TOKEN" == *" "* ]]; then',
    '  echo "The Argo CD token must be one line without spaces." >&2',
    '  exit 1',
    'fi',
    'if [[ "${#ARGOCD_TOKEN}" -lt 8 ]]; then',
    '  echo "The Argo CD token is too short to be a usable API token." >&2',
    '  exit 1',
    'fi',
    'hash_stdin() {',
    '  if command -v sha256sum >/dev/null 2>&1; then',
    "    sha256sum | awk 'NR==1 { print $1 }'",
    '  elif command -v shasum >/dev/null 2>&1; then',
    "    shasum -a 256 | awk 'NR==1 { print $1 }'",
    '  else',
    '    echo "sha256sum or shasum is required." >&2',
    '    exit 1',
    '  fi',
    '}',
    'enrollment_now() {',
    '  if ! kubectl -n "$NS" get secret gitops-insights-enrollment >/dev/null 2>&1; then',
    '    return 0',
    '  fi',
    '  kubectl -n "$NS" get secret gitops-insights-enrollment -o "go-template={{index .data \\"token\\" | base64decode}}" | hash_stdin',
    '}',
    'argo_now() {',
    '  if ! kubectl -n "$NS" get secret argocd-readonly >/dev/null 2>&1; then',
    '    return 0',
    '  fi',
    '  kubectl -n "$NS" get secret argocd-readonly -o "go-template={{index .data \\"token\\" | base64decode}}" | hash_stdin',
    '}',
    'ca_now() {',
    '  if ! kubectl -n "$NS" get secret argocd-ca >/dev/null 2>&1; then',
    '    return 0',
    '  fi',
    '  kubectl -n "$NS" get secret argocd-ca -o "go-template={{index .data \\"ca.crt\\" | base64decode}}" | hash_stdin',
    '}',
    'enrollment_changed=0',
    'argo_changed=0',
    'ca_changed=0',
    'enrollment_hash="$(printf \'%s\' "$ENROLLMENT_TOKEN" | hash_stdin)"',
    'current_enrollment="$(enrollment_now)"',
    'if [[ "$current_enrollment" != "$enrollment_hash" ]]; then enrollment_changed=1; fi',
    'argo_hash="$(printf \'%s\' "$ARGOCD_TOKEN" | hash_stdin)"',
    'current_argo="$(argo_now)"',
    'if [[ "$current_argo" != "$argo_hash" ]]; then argo_changed=1; fi',
    ...caBlock,
    'deployment_exists=0',
    'if kubectl -n "$NS" get deployment gitops-insights-connector >/dev/null 2>&1; then',
    '  deployment_exists=1',
    'fi',
    'if [[ "$enrollment_changed" == "1" && "$deployment_exists" == "1" ]]; then',
    '  kubectl -n "$NS" scale deployment/gitops-insights-connector --replicas=0',
    '  kubectl -n "$NS" rollout status deployment/gitops-insights-connector --timeout=120s',
    'fi',
    'if [[ "$enrollment_changed" == "1" ]]; then',
    '  kubectl -n "$NS" delete secret gitops-insights-connector-state --ignore-not-found',
    'fi',
    'kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -',
    'umask 077',
    'tmp="$(mktemp)"',
    'printf \'%s\' "$ENROLLMENT_TOKEN" > "$tmp"',
    'kubectl -n "$NS" create secret generic gitops-insights-enrollment --from-file="token=${tmp}" --dry-run=client -o yaml | kubectl apply -f -',
    'printf \'%s\' "$ARGOCD_TOKEN" > "$tmp"',
    'kubectl -n "$NS" create secret generic argocd-readonly --from-file="token=${tmp}" --dry-run=client -o yaml | kubectl apply -f -',
    ...caApply,
    'rm -f "$tmp"',
    'tmp=""',
    "kubectl apply -f - <<'GITOPS_MANIFEST_EOF'",
    manifest.endsWith('\n') ? manifest.slice(0, -1) : manifest,
    'GITOPS_MANIFEST_EOF',
    'if [[ "$enrollment_changed" == "0" && "$deployment_exists" == "1" && ( "$argo_changed" == "1" || "$ca_changed" == "1" ) ]]; then',
    '  kubectl -n "$NS" rollout restart deployment/gitops-insights-connector',
    'fi',
    'echo "Waiting for the connector pod."',
    'if ! kubectl -n "$NS" rollout status deployment/gitops-insights-connector --timeout=180s; then',
    '  echo "The connector is not ready. Confirm the image is available to this cluster, then read the pod logs." >&2',
    '  exit 1',
    'fi',
    'echo "The connector process is running. GitOps Insights shows Connected only after the agent checks in."',
    'GITOPS_INSTALL',
  ];
  return `${lines.join('\n')}\n`;
}
