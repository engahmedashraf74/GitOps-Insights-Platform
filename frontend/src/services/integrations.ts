import { apiFetch } from "./api";
import type { Integration } from "@/types";

export async function listIntegrations(): Promise<Integration[]> {
  return apiFetch<Integration[]>("/integrations");
}

export type ArgoConnectResult = {
  provider: string;
  status: string;
  url: string | null;
  lastSyncedAt: string | null;
  sync: {
    applicationsFetched?: number;
    projectsFetched?: number;
  } | null;
  syncError?: string;
};

export async function connectArgoCd(url: string, token: string) {
  return apiFetch<ArgoConnectResult>("/integrations/argocd/connect", {
    method: "POST",
    body: JSON.stringify({ url, token }),
  });
}

export async function disconnectArgoCd() {
  return apiFetch("/integrations/argocd", { method: "DELETE" });
}
