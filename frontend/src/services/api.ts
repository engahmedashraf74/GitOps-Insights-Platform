import { clearToken, getToken } from "@/lib/auth";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://192.168.49.2:30000";

export function getApiUrl(): string {
  return API_URL;
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const token = getToken();
  const isAuthRoute = endpoint.startsWith("/auth/");

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401 && !isAuthRoute) {
      clearToken();
    }
    throw new ApiError(await readError(response, isAuthRoute), response.status);
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

async function readError(
  response: Response,
  isAuthRoute: boolean,
): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "message" in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        if (!isAuthRoute && response.status === 401) {
          return "Session expired. Sign in again.";
        }
        return message;
      }
      if (Array.isArray(message)) return message.map(String).join(", ");
    }
  } catch {
    /* ignore parse errors */
  }

  if (response.status === 401) {
    return isAuthRoute
      ? "Invalid credentials. Check your email and password."
      : "Session expired. Sign in again.";
  }
  return "The request could not be completed. Try again.";
}
