const TOKEN_KEY = "token";
const REMEMBER_EMAIL_KEY = "goi.rememberedEmail";

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
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

  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(normalized)) as {
      userId?: number;
      email?: string;
    };

    if (!json.email || typeof json.userId !== "number") {
      return null;
    }

    return { userId: json.userId, email: json.email };
  } catch {
    return null;
  }
}
