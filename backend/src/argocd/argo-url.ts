import { BadRequestException } from '@nestjs/common';
import { isIP } from 'net';

/**
 * Hostnames that are never a legitimate Argo CD endpoint and are the usual
 * SSRF pivots (cloud metadata services and loopback).
 */
const ALWAYS_BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'instance-data.ec2.internal',
]);

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Self-hosted Argo CD commonly lives on a private network, so private ranges
 * are allowed outside production and can be opted into explicitly.
 */
function privateNetworkAllowed(): boolean {
  const flag = process.env.ARGOCD_ALLOW_PRIVATE_NETWORK;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return !isProduction();
}

function classifyIpv4(host: string): 'loopback' | 'link-local' | 'private' | 'public' {
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return 'public';
  }
  const [a, b] = parts;
  if (a === 127 || a === 0) return 'loopback';
  // 169.254.0.0/16 covers the AWS/GCP/Azure metadata address 169.254.169.254.
  if (a === 169 && b === 254) return 'link-local';
  if (a === 10) return 'private';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 100 && b >= 64 && b <= 127) return 'private';
  if (a >= 224) return 'link-local';
  return 'public';
}

function classifyIpv6(host: string): 'loopback' | 'link-local' | 'private' | 'public' {
  const value = host.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (value === '::1' || value === '::') return 'loopback';
  if (value.startsWith('fe80')) return 'link-local';
  if (value.startsWith('fc') || value.startsWith('fd')) return 'private';
  if (value.startsWith('::ffff:')) return classifyIpv4(value.slice(7));
  return 'public';
}

/**
 * Validates an operator-supplied Argo CD base URL before any authenticated
 * request is sent to it, and returns the normalised form.
 */
export function assertSafeArgoUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    throw new BadRequestException('Argo CD URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException(
      'Argo CD URL is not a valid URL. Use the full form, for example https://argocd.example.com',
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestException('Argo CD URL must use http or https.');
  }
  if (parsed.protocol === 'http:' && isProduction()) {
    throw new BadRequestException(
      'Argo CD URL must use https in production so the API token is not sent in clear text.',
    );
  }
  if (parsed.username || parsed.password) {
    throw new BadRequestException(
      'Argo CD URL must not embed credentials.',
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new BadRequestException('Argo CD URL must include a hostname.');
  }
  if (ALWAYS_BLOCKED_HOSTNAMES.has(hostname)) {
    throw new BadRequestException(
      'Argo CD URL points at a loopback or cloud metadata address, which is not allowed.',
    );
  }

  const ipVersion = isIP(hostname.replace(/^\[/, '').replace(/\]$/, ''));
  if (ipVersion !== 0) {
    const category =
      ipVersion === 4 ? classifyIpv4(hostname) : classifyIpv6(hostname);
    if (category === 'loopback' || category === 'link-local') {
      throw new BadRequestException(
        'Argo CD URL points at a loopback, link-local, or cloud metadata address, which is not allowed.',
      );
    }
    if (category === 'private' && !privateNetworkAllowed()) {
      throw new BadRequestException(
        'Argo CD URL points at a private network address. Set ARGOCD_ALLOW_PRIVATE_NETWORK=true if this Argo CD is reachable only on an internal network.',
      );
    }
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`.replace(
    /\/$/,
    '',
  );
}
