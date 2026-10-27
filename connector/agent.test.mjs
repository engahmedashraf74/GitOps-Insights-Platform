import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import tls from 'node:tls';
import {
  assertHttpsUrl,
  buildArgoTrust,
  kubeRequestOptions,
  loadState,
  postJson,
  readArgoCaFile,
  readStoredCredential,
  requestOptions,
  runOnce,
  storeCredential,
  tlsOptions,
  validateCaPem,
} from './agent.mjs';

const source = readFileSync(new URL('./agent.mjs', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('./Dockerfile', import.meta.url), 'utf8');

test('agent source keeps certificate validation enabled', () => {
  assert.equal(source.includes('rejectUnauthorized: false'), false);
  assert.equal(source.includes('NODE_TLS_REJECT_UNAUTHORIZED'), false);
  assert.match(dockerfile, /^FROM node:22\.23\.4-alpine3\.24/m);
  assert.equal(tlsOptions().rejectUnauthorized, true);
  const options = requestOptions(
    new URL('https://argocd-server.argocd.svc/api/v1/applications'),
    'local-argo-token',
    undefined,
  );
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.headers.Authorization, 'Bearer local-argo-token');
});

test('SaaS URL must be HTTPS and enrollment survives a reconnect', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body) });
    const path = String(url);
    if (path.endsWith('/enroll')) {
      return { ok: true, status: 200, json: async () => ({ credential: 'c'.repeat(40) }) };
    }
    return { ok: true, status: 200, json: async () => ({ applications: 1, projects: 0 }) };
  };
  const argoToken = 'argo-token-stays-in-cluster';
  const readArgo = async () => {
    if (!argoToken) throw new Error('missing');
    return {
      applications: [{ metadata: { name: 'payments' } }],
      projects: [],
    };
  };
  const first = await runOnce({
    insightsUrl: 'https://api.gitops-insights.com',
    argoUrl: 'https://argocd-server.argocd.svc',
    enrollmentToken: 'enroll-token-value-0123456789',
    fetchImpl,
    readArgo,
  });
  assert.equal(first.status, 'connected');
  assert.equal(first.enrolled, true);
  calls.length = 0;
  const second = await runOnce({
    insightsUrl: 'https://api.gitops-insights.com',
    argoUrl: 'https://argocd-server.argocd.svc',
    enrollmentToken: 'enroll-token-value-0123456789',
    state: loadState(JSON.stringify({ credential: first.credential })),
    fetchImpl,
    readArgo,
  });
  assert.equal(second.enrolled, false);
  assert.equal(calls.some((call) => call.url.endsWith('/enroll')), false);
  const serialized = JSON.stringify(calls);
  assert.equal(serialized.includes(argoToken), false);
  assert.equal(calls[0].init.redirect, 'error');
  assert.ok(calls[0].init.signal);
});

test('cleartext SaaS URL is rejected before a request', async () => {
  let called = false;
  await assert.rejects(
    () =>
      runOnce({
        insightsUrl: 'http://api.gitops-insights.com',
        argoUrl: 'https://argocd-server.argocd.svc',
        enrollmentToken: 'enroll-token-value-0123456789',
        fetchImpl: async () => {
          called = true;
          return { ok: true, json: async () => ({}) };
        },
        readArgo: async () => ({ applications: [], projects: [] }),
      }),
    /HTTPS/,
  );
  assert.equal(called, false);
  assert.throws(() => assertHttpsUrl('https://user:pass@api.gitops-insights.com', 'GitOps Insights URL'));
});

test('an Argo CD read failure does not invent applications', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (String(url).endsWith('/enroll')) {
      return { ok: true, json: async () => ({ credential: 'c'.repeat(40) }) };
    }
    return { ok: true, json: async () => ({ status: 'error' }) };
  };
  const result = await runOnce({
    insightsUrl: 'https://api.gitops-insights.com',
    argoUrl: 'https://argocd-server.argocd.svc',
    enrollmentToken: 'enroll-token-value-0123456789',
    fetchImpl,
    readArgo: async () => {
      throw new Error('Argo CD returned 401.');
    },
  });
  assert.equal(result.status, 'error');
  assert.equal(calls.some((call) => call.url.endsWith('/snapshot')), false);
  const report = calls.find((call) => call.url.endsWith('/report'));
  assert.equal(report.body.error, 'Argo CD returned 401.');
  assert.equal(JSON.stringify(calls).includes('guestbook'), false);
});

test('a stored cluster credential reconnects after pod replacement', async () => {
  const stored = { body: '' };
  const kubeCalls = [];
  const requestImpl = async (options, body) => {
    kubeCalls.push({
      hostname: options.hostname,
      path: options.path,
      method: options.method,
      authorization: options.headers.Authorization,
    });
    if (options.method === 'GET' && !stored.body) return { status: 404, body: '' };
    if (options.method === 'POST') {
      stored.body = body;
      return { status: 201, body };
    }
    return { status: 200, body: stored.body };
  };
  const config = {
    host: 'kubernetes.default.svc',
    port: 443,
    namespace: 'gitops-insights',
    token: 'sa-token-value-not-for-saas',
    ca: 'cluster-ca',
    insightsHostname: 'api.gitops-insights.com',
  };
  const credential = 'c'.repeat(40);
  await storeCredential(config, requestImpl, credential);
  const loaded = await readStoredCredential(config, requestImpl);
  assert.equal(loaded.credential, credential);
  assert.equal(kubeCalls.every((call) => call.hostname === 'kubernetes.default.svc'), true);
  assert.equal(kubeCalls.every((call) => call.path.includes('gitops-insights-connector-state') || call.method === 'POST'), true);

  const saas = [];
  const second = await runOnce({
    insightsUrl: 'https://api.gitops-insights.com',
    argoUrl: 'https://argocd-server.argocd.svc',
    enrollmentToken: 'enroll-token-value-0123456789',
    state: loaded,
    fetchImpl: async (url, init) => {
      saas.push({ url: String(url), body: init.body, authorization: init.headers.Authorization });
      return { ok: true, json: async () => ({ applications: 1, projects: 0 }) };
    },
    readArgo: async () => ({ applications: [{ metadata: { name: 'payments' } }], projects: [] }),
  });
  assert.equal(second.enrolled, false);
  assert.equal(saas.some((call) => String(call.url).endsWith('/enroll')), false);
  assert.equal(JSON.stringify(saas).includes('sa-token-value-not-for-saas'), false);
  assert.equal(JSON.stringify(kubeCalls).includes('api.gitops-insights.com'), false);
});

test('the cluster credential is not sent to the SaaS host', () => {
  assert.throws(
    () =>
      kubeRequestOptions(
        {
          host: 'api.gitops-insights.com',
          namespace: 'gitops-insights',
          token: 'sa-token',
          insightsHostname: 'api.gitops-insights.com',
        },
        'get',
        false,
      ),
    /Refusing/,
  );
  const options = kubeRequestOptions(
    {
      host: 'kubernetes.default.svc',
      namespace: 'gitops-insights',
      token: 'sa-token',
      ca: 'cluster-ca',
      insightsHostname: 'api.gitops-insights.com',
    },
    'get',
    false,
  );
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.hostname, 'kubernetes.default.svc');
});

const certDir = mkdtempSync(join(tmpdir(), 'gitops-ca-'));

function openssl(args) {
  execFileSync('openssl', args, { cwd: certDir, stdio: 'pipe' });
}

function makeLeaf(name, extra) {
  openssl([
    'req', '-newkey', 'rsa:2048', '-keyout', `${name}.key`, '-out', `${name}.csr`,
    '-nodes', '-subj', `/CN=${name}`, '-addext', `subjectAltName=DNS:${name}`,
  ]);
  openssl([
    'x509', '-req', '-in', `${name}.csr`, '-CA', 'ca.crt', '-CAkey', 'ca.key',
    '-CAcreateserial', '-out', `${name}.crt`, ...extra,
  ]);
}

test.before(() => {
  openssl([
    'req', '-x509', '-newkey', 'rsa:2048', '-keyout', 'ca.key', '-out', 'ca.crt',
    '-days', '3650', '-nodes', '-subj', '/CN=TestCA',
    '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
  ]);
  makeLeaf('argocd.internal', ['-days', '30', '-copy_extensions', 'copy']);
  makeLeaf('other.internal', ['-days', '30', '-copy_extensions', 'copy']);
  makeLeaf('expired.internal', [
    '-not_before', '20200101000000Z',
    '-not_after', '20200102000000Z',
    '-copy_extensions', 'copy',
  ]);
});

test.after(() => {
  rmSync(certDir, { recursive: true, force: true });
});

function handshake(certName, servername, pem) {
  const cert = readFileSync(join(certDir, `${certName}.crt`));
  const key = readFileSync(join(certDir, `${certName}.key`));
  const trust = buildArgoTrust(pem);
  return new Promise((resolve, reject) => {
    const server = https.createServer({ cert, key }, (_req, res) => {
      res.writeHead(200);
      res.end('{}');
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const req = https.request(
        {
          host: '127.0.0.1',
          port: address.port,
          method: 'GET',
          path: '/',
          servername,
          timeout: 5000,
          ...trust,
        },
        (res) => {
          res.resume();
          res.on('end', () => {
            server.close();
            resolve({ ok: true, status: res.statusCode });
          });
        },
      );
      req.on('error', (error) => {
        server.close();
        resolve({ ok: false, code: error.code || '', message: error.message });
      });
      req.end();
    });
    server.on('error', reject);
  });
}

function publicHandshake(ca) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: 'example.com',
        port: 443,
        method: 'GET',
        path: '/',
        servername: 'example.com',
        rejectUnauthorized: true,
        timeout: 8000,
        ...(ca ? { ca } : {}),
      },
      (res) => {
        res.resume();
        resolve({ ok: true, status: res.statusCode });
      },
    );
    req.on('error', (error) => resolve({ ok: false, code: error.code || '', message: error.message }));
    req.end();
  });
}

test('a publicly trusted certificate needs no custom CA', async () => {
  const options = requestOptions(new URL('https://example.com/'), 'token-value-0123456789');
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(Object.hasOwn(options, 'ca'), false);
  const result = await publicHandshake();
  assert.equal(result.ok, true, result.message);
});

test('a private CA is trusted only for the Argo CD connection', async () => {
  const caPem = readFileSync(join(certDir, 'ca.crt'), 'utf8');
  const without = await handshake('argocd.internal', 'argocd.internal');
  assert.equal(without.ok, false);
  const withCa = await handshake('argocd.internal', 'argocd.internal', caPem);
  assert.equal(withCa.ok, true, withCa.message);
  const trust = buildArgoTrust(caPem);
  assert.equal(trust.rejectUnauthorized, true);
  assert.ok(trust.ca.includes(tls.rootCertificates[0]));
  assert.ok(trust.ca.includes(caPem.trim().split('\n')[1]));
  const previous = process.env.NODE_EXTRA_CA_CERTS;
  const calls = [];
  await postJson(
    async (_url, init) => {
      calls.push(init);
      return { ok: true, json: async () => ({ ok: true }) };
    },
    'https://api.gitops-insights.com',
    '/connectors/agent/heartbeat',
    {},
    'c'.repeat(40),
  );
  assert.equal(process.env.NODE_EXTRA_CA_CERTS, previous);
  assert.equal(Object.hasOwn(calls[0], 'ca'), false);
  assert.equal(JSON.stringify(calls[0]).includes('BEGIN CERTIFICATE'), false);
  const saas = await publicHandshake(trust.ca);
  assert.equal(saas.ok, true, saas.message);
});

test('a missing or invalid CA file is rejected', () => {
  assert.throws(() => readArgoCaFile(join(certDir, 'missing.pem')), /could not be read/);
  const invalid = join(certDir, 'invalid.pem');
  writeFileSync(invalid, 'this is not a certificate');
  assert.throws(() => readArgoCaFile(invalid), /PEM/);
  writeFileSync(invalid, '');
  assert.throws(() => readArgoCaFile(invalid), /empty/);
  assert.throws(() => validateCaPem(readFileSync(join(certDir, 'ca.key'), 'utf8')), /private key/);
  assert.throws(
    () => validateCaPem(readFileSync(join(certDir, 'argocd.internal.crt'), 'utf8')),
    /certificate authority/,
  );
});

test('an expired certificate and a hostname mismatch are rejected', async () => {
  const caPem = readFileSync(join(certDir, 'ca.crt'), 'utf8');
  const expired = await handshake('expired.internal', 'expired.internal', caPem);
  assert.equal(expired.ok, false);
  assert.match(`${expired.code} ${expired.message}`, /EXPIRED|expired/i);
  const mismatch = await handshake('argocd.internal', 'other.internal', caPem);
  assert.equal(mismatch.ok, false);
  assert.match(`${mismatch.code} ${mismatch.message}`, /ALTNAME|hostname/i);
});
