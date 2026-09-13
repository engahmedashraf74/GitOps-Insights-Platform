import { apiFetch } from "./api";
import type { Application, ApplicationRepository } from "@/types";

export interface ArgoSyncResult {
  connected: boolean;
  imported: number;
  updated: number;
  removed: number;
  lastSyncedAt: string | null;
}

export async function getApplications(
  projectId?: number,
): Promise<Application[]> {
  if (projectId) {
    return apiFetch<Application[]>(`/applications/${projectId}`);
  }
  return apiFetch<Application[]>("/applications");
}

export async function syncApplications(): Promise<ArgoSyncResult> {
  return apiFetch<ArgoSyncResult>("/applications/sync", { method: "POST" });
}

export async function getApplicationRepository(
  id: number,
): Promise<ApplicationRepository> {
  return apiFetch<ApplicationRepository>(`/applications/repository/${id}`);
}
