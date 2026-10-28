const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isInternalHost(host: string): boolean {
  if (
    LOCAL_HOSTS.has(host) ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.svc') ||
    host.includes('.svc.') ||
    !host.includes('.')
  ) {
    return true;
  }
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

export function verificationPageUrl(
  token: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error('verification-token-invalid');
  }
  return `${frontendOrigin(env)}/verify-email?token=${token}`;
}

export function frontendOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.FRONTEND_URL || env.APP_URL || '').trim();
  if (!raw) {
    if (env.NODE_ENV === 'production') {
      throw new Error('verification-origin-missing');
    }
    return 'http://localhost:3000';
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('verification-origin-invalid');
  }

  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('verification-origin-invalid');
  }

  const host = url.hostname.toLowerCase();
  const production = env.NODE_ENV === 'production';
  if (production && (url.protocol !== 'https:' || isInternalHost(host))) {
    throw new Error('verification-origin-invalid');
  }
  if (!production && url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('verification-origin-invalid');
  }

  return url.origin;
}
