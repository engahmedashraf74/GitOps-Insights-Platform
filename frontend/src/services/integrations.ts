import { apiFetch } from "./api";
import type { Integration } from "@/types";

export async function listIntegrations(): Promise<Integration[]> {
  return apiFetch<Integration[]>("/integrations");
}

export async function testArgoCd(url: string, token: string) {
  return apiFetch<{ ok: boolean; message: string }>("/integrations/argocd/test", {
    method: "POST",
    body: JSON.stringify({ url, token }),
  });
}

export async function connectArgoCd(url: string, token: string) {
  return apiFetch("/integrations/argocd/connect", {
    method: "POST",
    body: JSON.stringify({ url, token }),
  });
}

export async function disconnectArgoCd() {
  return apiFetch("/integrations/argocd", { method: "DELETE" });
}
