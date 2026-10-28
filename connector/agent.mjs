import https from 'node:https';
import tls from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUEST_TIMEOUT_MS = 12_000;
const MAX_BODY_CHARS = 1_000_000;
export const STATE_SECRET_NAME = 'gitops-insights-connector-state';

export function assertHttpsUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`${label} must use HTTPS.`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} must not include a username or password.`);
  }
  return url;
}

export function tlsOptions(ca) {
  return {
    rejectUnauthorized: true,
    timeout: REQUEST_TIMEOUT_MS,
    ...(ca ? { ca } : {}),
  };
}

const PRIVATE_KEY_PEM = /-----BEGIN (?:RSA |EC |ENCRYPTED |OPENSSH )?PRIVATE KEY-----/;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const NETWORK_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  'ECONNABORTED',
  'EPIPE',
]);
const TLS_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_SIGNATURE_FAILURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ERR_TLS_HANDSHAKE_TIMEOUT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);
const SAFE_CERTIFICATE_MESSAGES = new Set([
  'The CA certificate is empty.',
  'A private key was provided. Use the CA certificate only.',
  'The CA certificate must be PEM data.',
  'The CA certificate is not a valid X.509 certificate.',
  'This certificate is not an Argo CD trust anchor.',
  'The CA certificate is not yet valid.',
  'The CA certificate is expired.',
  'ARGOCD_CA_FILE is set, but the certificate file could not be read.',
  'ARGOCD_CA_FILE is empty.',
]);

function trustAnchor(certificate) {
  if (certificate.ca) return true;
  try {
    return certificate.verify(certificate.publicKey) === true;
  } catch {
    return false;
  }
}

export function validateCaPem(pem) {
  const text = String(pem ?? '').replaceAll('\\n', '\n').trim();
  if (!text) throw new Error('The CA certificate is empty.');
  if (PRIVATE_KEY_PEM.test(text)) {
    throw new Error('A private key was provided. Use the CA certificate only.');
  }
  const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  if (!blocks?.length) throw new Error('The CA certificate must be PEM data.');
  const now = Date.now();
  for (const block of blocks) {
    let certificate;
    try {
      certificate = new X509Certificate(block);
    } catch {
      throw new Error('The CA certificate is not a valid X.509 certificate.');
    }
    if (!trustAnchor(certificate)) {
      throw new Error('This certificate is not an Argo CD trust anchor.');
    }
    const validFrom = Date.parse(certificate.validFrom);
    const validTo = Date.parse(certificate.validTo);
    if (Number.isNaN(validFrom) || validFrom > now) {
      throw new Error('The CA certificate is not yet valid.');
    }
    if (Number.isNaN(validTo) || validTo <= now) throw new Error('The CA certificate is expired.');
  }
  return blocks.map((block) => block.trim()).join('\n');
}

export function diagnosticMessage(error) {
  const raw = error instanceof Error ? error.message : '';
  const code = typeof error?.code === 'string' && SAFE_CODE.test(error.code) ? error.code : '';
  const apiStatus = /^GitOps Insights returned (\d{3})\.$/.exec(raw);
  if (apiStatus) return `category=api-http status=${apiStatus[1]}`;
  const argoStatus = /^Argo CD returned (\d{3})\.$/.exec(raw);
  if (argoStatus) return `category=argocd-http status=${argoStatus[1]}`;
  if (TLS_CODES.has(code)) return `category=tls code=${code}`;
  if (raw === 'Argo CD timed out.') return 'category=argocd-timeout';
  if (raw === 'Kubernetes API timed out.') return 'category=kubernetes-timeout';
  if (raw.endsWith('could not be reached.') || NETWORK_CODES.has(code)) {
    const scope = raw.startsWith('Argo CD')
      ? 'argocd-network'
      : raw.startsWith('Kubernetes API')
        ? 'kubernetes-network'
        : 'network';
    return code ? `category=${scope} code=${code}` : `category=${scope}`;
  }
  if (SAFE_CERTIFICATE_MESSAGES.has(raw)) return `category=certificate detail=${raw}`;
  return code ? `category=unknown code=${code}` : 'category=unknown';
}

export function buildArgoTrust(pem) {
  if (pem == null || String(pem).trim() === '') return { rejectUnauthorized: true };
  const custom = validateCaPem(pem);
  return {
    rejectUnauthorized: true,
    ca: [...tls.rootCertificates, custom].join('\n'),
  };
}

export function readArgoCaFile(file, readImpl = readFileSync) {
  if (!file?.trim()) return undefined;
  let raw;
  try {
    raw = readImpl(file, 'utf8');
  } catch {
    throw new Error('ARGOCD_CA_FILE is set, but the certificate file could not be read.');
  }
  const text = String(raw);
  if (!text.trim()) throw new Error('ARGOCD_CA_FILE is empty.');
  return validateCaPem(text);
}

export function loadState(raw) {
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed.credential !== 'string' || parsed.credential.length < 20) {
    return null;
  }
  return { credential: parsed.credential };
}

export function stateDocument(credential) {
  return JSON.stringify({ credential });
}

export function waitForStop(signal, ms) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    if (signal) signal.addEventListener('abort', done, { once: true });
  });
}

export async function postJson(fetchImpl, base, path, body, credential) {
  const url = new URL(path, base);
  assertHttpsUrl(url.toString(), 'GitOps Insights URL');
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (credential) headers.Authorization = `Bearer ${credential}`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GitOps Insights returned ${response.status}.`);
  }
  return response.json();
}

export async function runOnce(options) {
  const insights = assertHttpsUrl(options.insightsUrl, 'GitOps Insights URL');
  assertHttpsUrl(options.argoUrl, 'Argo CD URL');
  let credential = options.state?.credential || '';
  let enrolled = false;
  if (!credential) {
    if (!options.enrollmentToken) {
      throw new Error('No enrollment token and no saved credential.');
    }
    const result = await postJson(
      options.fetchImpl,
      insights,
      '/connectors/agent/enroll',
      { enrollmentToken: options.enrollmentToken },
      '',
    );
    if (!result || typeof result.credential !== 'string') {
      throw new Error('Enrollment did not return a credential.');
    }
    credential = result.credential;
    enrolled = true;
  }
  await postJson(options.fetchImpl, insights, '/connectors/agent/heartbeat', {}, credential);
  try {
    const snapshot = await options.readArgo();
    if (!snapshot || !Array.isArray(snapshot.applications) || !Array.isArray(snapshot.projects)) {
      throw new Error('Argo CD returned an unreadable list.');
    }
    await postJson(
      options.fetchImpl,
      insights,
      '/connectors/agent/snapshot',
      { applications: snapshot.applications, projects: snapshot.projects },
      credential,
    );
    return { credential, status: 'connected', enrolled };
  } catch (error) {
    const detail = diagnosticMessage(error);
    await postJson(
      options.fetchImpl,
      insights,
      '/connectors/agent/report',
      { error: detail },
      credential,
    );
    return { credential, status: 'error', enrolled, detail };
  }
}

export function itemsOf(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
}

export function requestOptions(target, token, pem) {
  const trust = buildArgoTrust(pem);
  const options = {
    method: 'GET',
    hostname: target.hostname,
    port: target.port || 443,
    path: `${target.pathname}${target.search}`,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    servername: target.hostname,
    timeout: REQUEST_TIMEOUT_MS,
    ...trust,
  };
  if (options.rejectUnauthorized !== true) {
    throw new Error('TLS validation cannot be disabled.');
  }
  if (Object.hasOwn(options, 'ca') && !String(options.ca).includes(tls.rootCertificates[0])) {
    throw new Error('Argo CD trust must keep the public certificate authorities.');
  }
  return options;
}

export function readArgo(argoUrl, token, ca, requestImpl = argoRequest) {
  const target = assertHttpsUrl(argoUrl, 'Argo CD URL');
  if (!token || token.length < 8) throw new Error('ARGOCD_TOKEN is not set.');
  return Promise.all([
    getJson(target, '/api/v1/applications', token, ca, requestImpl),
    getJson(target, '/api/v1/projects', token, ca, requestImpl),
  ]).then(([applications, projects]) => {
    const applicationItems = itemsOf(applications);
    const projectItems = itemsOf(projects);
    if (applicationItems.length > 100) {
      throw new Error('This connector can send at most 100 applications.');
    }
    if (projectItems.length > 50) {
      throw new Error('This connector can send at most 50 projects.');
    }
    return { applications: applicationItems, projects: projectItems };
  });
}

function getJson(target, path, token, ca, requestImpl) {
  const options = requestOptions(new URL(path, target), token, ca);
  return requestImpl(options).then((result) => {
    if (result.status !== 200) {
      throw new Error(`Argo CD returned ${result.status}.`);
    }
    if (result.body.length > MAX_BODY_CHARS) {
      throw new Error('Argo CD response is too large.');
    }
    return JSON.parse(result.body);
  });
}

function httpsRequest(options, body, failureLabel = 'The remote host') {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', (error) => {
      const failure = new Error(`${failureLabel} could not be reached.`);
      if (typeof error?.code === 'string' && SAFE_CODE.test(error.code)) failure.code = error.code;
      reject(failure);
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      const failure = new Error(`${failureLabel} timed out.`);
      failure.code = 'ETIMEDOUT';
      reject(failure);
    });
    if (body) req.write(body);
    req.end();
  });
}

function argoRequest(options) {
  return httpsRequest(options, undefined, 'Argo CD');
}

function kubernetesRequest(options, body) {
  return httpsRequest(options, body, 'Kubernetes API');
}

export function assertDnsLabel(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(value) || value.length > 63) {
    throw new Error(`${label} is not a valid Kubernetes name.`);
  }
  return value;
}

export function kubeRequestPath(namespace, operation) {
  const name = assertDnsLabel(namespace, 'Namespace');
  if (operation === 'create') return `/api/v1/namespaces/${name}/secrets`;
  if (operation === 'get' || operation === 'replace') {
    return `/api/v1/namespaces/${name}/secrets/${STATE_SECRET_NAME}`;
  }
  throw new Error('Unsupported Kubernetes operation.');
}

export function credentialFromSecret(secret) {
  const encoded = secret?.data?.credential;
  if (typeof encoded !== 'string' || encoded.length === 0) return null;
  return loadState(Buffer.from(encoded, 'base64').toString('utf8'));
}

export function secretBody(namespace, credential) {
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: STATE_SECRET_NAME, namespace: assertDnsLabel(namespace, 'Namespace') },
    type: 'Opaque',
    data: {
      credential: Buffer.from(stateDocument(credential), 'utf8').toString('base64'),
    },
  };
}

export function kubeRequestOptions(config, operation, hasBody) {
  if (!config?.host || /[/\s]/.test(config.host)) {
    throw new Error('Kubernetes API host is not valid.');
  }
  if (config.insightsHostname && config.host === config.insightsHostname) {
    throw new Error('Refusing to contact GitOps Insights with the cluster credential.');
  }
  const method = operation === 'get' ? 'GET' : operation === 'create' ? 'POST' : 'PUT';
  const options = {
    method,
    hostname: config.host,
    port: Number(config.port || 443),
    path: kubeRequestPath(config.namespace, operation),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.token}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    servername: config.host,
    ...tlsOptions(config.ca),
  };
  if (options.rejectUnauthorized !== true) {
    throw new Error('TLS validation cannot be disabled.');
  }
  return options;
}

async function kubeCall(config, requestImpl, operation, body) {
  const options = kubeRequestOptions(config, operation, Boolean(body));
  const result = await requestImpl(options, body ? JSON.stringify(body) : undefined);
  return result;
}

export async function readStoredCredential(config, requestImpl) {
  const result = await kubeCall(config, requestImpl, 'get');
  if (result.status === 404) return null;
  if (result.status !== 200) throw new Error(`Kubernetes returned ${result.status}.`);
  let secret;
  try {
    secret = JSON.parse(result.body);
  } catch {
    throw new Error('Kubernetes secret could not be read.');
  }
  return credentialFromSecret(secret);
}

export async function storeCredential(config, requestImpl, credential) {
  const current = await kubeCall(config, requestImpl, 'get');
  const body = secretBody(config.namespace, credential);
  if (current.status === 404) {
    const created = await kubeCall(config, requestImpl, 'create', body);
    if (created.status !== 201 && created.status !== 200) {
      throw new Error(`Kubernetes returned ${created.status}.`);
    }
    return;
  }
  if (current.status !== 200) throw new Error(`Kubernetes returned ${current.status}.`);
  const replaced = await kubeCall(config, requestImpl, 'replace', body);
  if (replaced.status !== 200) throw new Error(`Kubernetes returned ${replaced.status}.`);
}

function persist(file, credential) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, stateDocument(credential), { mode: 0o600 });
}

function readClusterConfig(insightsUrl) {
  let token = '';
  let ca;
  let namespace = 'gitops-insights';
  try {
    token = readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8').trim();
    ca = readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
    namespace = readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace', 'utf8').trim();
  } catch {
    throw new Error('Kubernetes service account could not be read.');
  }
  let insightsHostname = '';
  try {
    insightsHostname = new URL(insightsUrl).hostname;
  } catch {
    insightsHostname = '';
  }
  return {
    host: process.env.KUBERNETES_SERVICE_HOST,
    port: process.env.KUBERNETES_SERVICE_PORT || '443',
    namespace,
    token,
    ca,
    insightsHostname,
  };
}

async function main() {
  const insightsUrl = process.env.GITOPS_INSIGHTS_URL || '';
  const argoUrl = process.env.ARGOCD_URL || '';
  const enrollmentToken = process.env.ENROLLMENT_TOKEN || '';
  const stateFile = process.env.CONNECTOR_STATE_FILE || '';
  const token = process.env.ARGOCD_TOKEN || '';
  const kube = process.env.KUBERNETES_SERVICE_HOST ? readClusterConfig(insightsUrl) : null;
  let caPem;
  try {
    caPem = readArgoCaFile(process.env.ARGOCD_CA_FILE || '');
  } catch (error) {
    console.error(`[connector] ${diagnosticMessage(error)}`);
    process.exit(1);
  }
  const stop = new AbortController();
  const finish = () => stop.abort();
  process.once('SIGTERM', finish);
  process.once('SIGINT', finish);
  let memory = '';
  for (;;) {
    if (stop.signal.aborted) break;
    try {
      if (!memory && kube) {
        const stored = await readStoredCredential(kube, kubernetesRequest);
        memory = stored?.credential || '';
      }
      if (!memory && stateFile) {
        memory = loadState(safeRead(stateFile))?.credential || '';
      }
      const result = await runOnce({
        insightsUrl,
        argoUrl,
        enrollmentToken,
        state: memory ? { credential: memory } : null,
        fetchImpl: globalThis.fetch,
        readArgo: () => readArgo(argoUrl, token, caPem),
      });
      memory = result.credential;
      if (kube) await storeCredential(kube, kubernetesRequest, memory);
      else if (stateFile) persist(stateFile, memory);
      console.log(`[connector] ${result.status}${result.detail ? ` ${result.detail}` : ''}`);
    } catch (error) {
      console.error(`[connector] ${diagnosticMessage(error)}`);
    }
    await waitForStop(stop.signal, 20_000);
    if (stop.signal.aborted) break;
  }
}

function safeRead(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
