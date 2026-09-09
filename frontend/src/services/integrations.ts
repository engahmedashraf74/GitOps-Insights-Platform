import type { Integration, IntegrationProvider } from "@/types";
import { integrationCatalog } from "@/mock/demo-data";

const STORAGE_KEY = "goi.integrations";

interface StoredIntegration {
  provider: IntegrationProvider;
  status: "connected" | "disconnected";
  url?: string;
}

/**
 * Integration credentials are never persisted in frontend source or storage.
 * Connection metadata (provider + URL + status) is local until a multi-tenant
 * integrations API exists.
 */
export function listIntegrations(): Integration[] {
  const stored = readStored();
  return integrationCatalog.map((item) => {
    const match = stored.find((entry) => entry.provider === item.provider);
    if (!match) return item;
    return {
      ...item,
      status: match.status,
      url: match.url,
    };
  });
}

export function connectArgoCd(url: string): Integration[] {
  const stored = readStored().filter((item) => item.provider !== "argocd");
  stored.push({
    provider: "argocd",
    status: "connected",
    url,
  });
  writeStored(stored);
  return listIntegrations();
}

export function disconnectArgoCd(): Integration[] {
  const stored = readStored().filter((item) => item.provider !== "argocd");
  writeStored(stored);
  return listIntegrations();
}

function readStored(): StoredIntegration[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredIntegration[]) : [];
  } catch {
    return [];
  }
}

function writeStored(value: StoredIntegration[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}
