const TOKEN_KEY = "token";
const REMEMBER_EMAIL_KEY = "goi.rememberedEmail";

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || token === "undefined" || token === "null") {
    return null;
  }

  if (!isJwtUsable(token)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }

  return token;
}

export function setToken(token: string): void {
  if (!token || token === "undefined") {
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getRememberedEmail(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
}

export function setRememberedEmail(email: string | null): void {
  if (email) {
    localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    return;
  }

  localStorage.removeItem(REMEMBER_EMAIL_KEY);
}

export interface SessionUser {
  userId: number;
  email: string;
}

export function getSessionUser(): SessionUser | null {
  const token = getToken();
  if (!token) {
    return null;
  }

  const json = decodeJwtPayload(token);
  if (!json?.email || typeof json.userId !== "number") {
    return null;
  }

  return { userId: json.userId, email: json.email };
}

function isJwtUsable(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return false;
  }
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    return false;
  }
  return true;
}

function decodeJwtPayload(
  token: string,
): { userId?: number; email?: string; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)) as {
      userId?: number;
      email?: string;
      exp?: number;
    };
  } catch {
    return null;
  }
}
