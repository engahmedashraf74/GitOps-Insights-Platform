import { lookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';

export type AddressLookup = (
  hostname: string,
) => Promise<Array<{ address: string }>>;

const METADATA_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.google.com',
  'instance-data',
]);

export class ArgoUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgoUrlError';
  }
}

export function describeArgoHttpStatus(
  status: number,
  resource: 'applications' | 'projects' = 'applications',
): string {
  if (status >= 300 && status < 400) {
    return 'That URL redirects to another address. Enter the final public HTTPS address of the Argo CD server.';
  }
  if (status === 401) {
    return 'Argo CD rejected the token. Generate a new API token and paste it again.';
  }
  if (status === 403) {
    return resource === 'projects'
      ? 'The token can list applications, but it cannot list projects. Grant get access to projects, then generate a new token.'
      : 'The token can sign in, but it cannot list applications. Grant get access to applications and projects, then generate a new token.';
  }
  if (status === 404) {
    return 'The Argo CD API was not found at this URL. Enter the server root, such as https://argocd.example.com.';
  }
  return `Argo CD returned HTTP ${status}.`;
}

export function describeArgoTransportError(error: unknown): string {
  const code = errorCode(error);
  if (
    code === 'CERT_HAS_EXPIRED' ||
    code === 'CERT_NOT_YET_VALID'
  ) {
    return 'The Argo CD TLS certificate has expired or is not yet valid.';
  }
  if (
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'
  ) {
    return 'The Argo CD TLS certificate is not trusted. Use a certificate from a public authority, or set ARGOCD_CA_FILE to the PEM file for your private certificate authority.';
  }
  if (code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    return 'The TLS certificate name does not match the Argo CD URL.';
  }
  if (
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_BODY_TIMEOUT' ||
    code === 'ETIMEDOUT' ||
    code === 'ABORT_ERR' ||
    code === 'ABORTERR'
  ) {
    return 'The Argo CD server did not respond in time. The GitOps Insights server must be able to reach that URL.';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'The Argo CD hostname could not be resolved from the GitOps Insights server.';
  }
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH'
  ) {
    return 'The GitOps Insights server could not open a connection to that Argo CD URL. A private or cluster-local address is not reachable from AWS.';
  }
  return 'The GitOps Insights server could not reach Argo CD.';
}

export function redactSecrets(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]');
}

export type SafeArgoDestination = {
  url: URL;
  addresses: readonly string[];
};

export function createPinnedLookup(
  addresses: readonly string[],
  options: { production: boolean },
): LookupFunction {
  const pinned = addresses.map((address) => {
    const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
    const family = isIP(normalized);
    if (family !== 4 && family !== 6) {
      throw new ArgoUrlError('The Argo CD address could not be verified.');
    }
    if (isMetadataAddress(normalized) || (options.production && isNonPublicAddress(normalized))) {
      throw new ArgoUrlError(privateDestinationMessage(normalized));
    }
    return { address: normalized, family };
  });
  if (pinned.length === 0) {
    throw new ArgoUrlError(
      'The Argo CD hostname could not be resolved from the GitOps Insights server.',
    );
  }

  const pinnedLookup: LookupFunction = (_hostname, lookupOptions, callback) => {
    const requestedFamily = lookupOptions.family;
    const selected =
      requestedFamily === 4 || requestedFamily === 6
        ? pinned.filter((record) => record.family === requestedFamily)
        : pinned;
    if (selected.length === 0) {
      const error = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
      callback(error, '', 4);
      return;
    }
    if (lookupOptions.all) {
      callback(null, selected);
      return;
    }
    callback(null, selected[0].address, selected[0].family);
  };
  return pinnedLookup;
}

export async function assertSafeArgoUrl(
  raw: string,
  options: { production: boolean; lookupHost?: AddressLookup },
): Promise<SafeArgoDestination> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ArgoUrlError('Enter the Argo CD server URL, including https://.');
  }
  if (url.protocol !== 'https:') {
    throw new ArgoUrlError('Argo CD must be reached over HTTPS.');
  }
  if (url.username || url.password) {
    throw new ArgoUrlError('Do not put a username or password in the Argo CD URL. Use a token instead.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || hostname === '0.0.0.0') {
    throw new ArgoUrlError('Enter a public HTTPS address for the Argo CD server.');
  }
  if (isBlockedHostname(hostname)) {
    throw new ArgoUrlError(privateDestinationMessage(hostname));
  }
  const literal = isIP(hostname);
  if (literal) {
    if (isMetadataAddress(hostname) || (options.production && isNonPublicAddress(hostname))) {
      throw new ArgoUrlError(privateDestinationMessage(hostname));
    }
    return { url, addresses: [hostname] };
  }

  const lookupHost = options.lookupHost ?? defaultLookup;
  let records: Array<{ address: string }>;
  try {
    records = await lookupHost(hostname);
  } catch {
    throw new ArgoUrlError(
      'The Argo CD hostname could not be resolved from the GitOps Insights server.',
    );
  }
  const addresses = records.map((record) => record.address);
  if (
    addresses.length === 0 ||
    addresses.some(
      (address) =>
        isMetadataAddress(address) || (options.production && isNonPublicAddress(address)),
    )
  ) {
    throw new ArgoUrlError(privateDestinationMessage(hostname));
  }
  return { url, addresses };
}

function privateDestinationMessage(hostname: string): string {
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '::1' ||
    hostname.startsWith('127.')
  ) {
    return 'localhost points at the machine running the check, not at your Argo CD server. Enter an HTTPS URL that the GitOps Insights server on AWS can reach.';
  }
  if (hostname.endsWith('.svc') || hostname.includes('.svc.') || hostname.endsWith('.cluster.local')) {
    return 'A Kubernetes service address is only reachable inside that cluster. It is not reachable from the GitOps Insights server on AWS.';
  }
  return 'That address is private or internal. The GitOps Insights server on AWS can only connect to an Argo CD URL that is reachable over the network. A private Minikube address is not reachable.';
}

function isBlockedHostname(hostname: string): boolean {
  if (METADATA_HOSTS.has(hostname)) return true;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
  if (hostname.endsWith('.svc') || hostname.includes('.svc.') || hostname.endsWith('.cluster.local')) {
    return true;
  }
  if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)) return true;
  return false;
}

export function isMetadataAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalized === '169.254.169.254' ||
    normalized === '169.254.170.2' ||
    normalized === 'fd00:ec2::254'
  );
}

export function isNonPublicAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized.startsWith('::ffff:')) {
    return isNonPublicAddress(normalized.slice('::ffff:'.length));
  }
  if (isIP(normalized) === 6) {
    if (normalized === '::1' || normalized === '::') return true;
    if (/^fe[89ab]/.test(normalized) || normalized.startsWith('fc') || normalized.startsWith('fd')) {
      return true;
    }
    return false;
  }
  const parts = normalized.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

async function defaultLookup(hostname: string): Promise<Array<{ address: string }>> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address }));
}

function errorCode(error: unknown): string {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const record = current as { code?: unknown; cause?: unknown; name?: unknown };
    if (typeof record.code === 'string') return record.code;
    if (record.name === 'TimeoutError' || record.name === 'AbortError') return 'ETIMEDOUT';
    current = record.cause;
  }
  return '';
}
