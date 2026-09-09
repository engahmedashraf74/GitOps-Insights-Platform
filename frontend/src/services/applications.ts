import { apiFetch } from "./api";
import type { Application, ApplicationRepository } from "@/types";

export async function getApplications(
  projectId: number,
): Promise<Application[]> {
  return apiFetch<Application[]>(`/applications/${projectId}`);
}

export async function createApplication(
  name: string,
  description: string,
  repoUrl: string,
  branch: string,
  path: string,
  projectId: number,
): Promise<Application> {
  return apiFetch<Application>("/applications", {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      repoUrl,
      branch,
      path,
      projectId,
    }),
  });
}

export async function getApplicationRepository(
  id: number,
): Promise<ApplicationRepository> {
  return apiFetch<ApplicationRepository>(`/applications/repository/${id}`);
}
