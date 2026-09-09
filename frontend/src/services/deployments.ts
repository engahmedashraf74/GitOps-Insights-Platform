import { apiFetch } from "./api";
import type { Deployment } from "@/types";

export async function getDeployments(
  applicationId: number,
): Promise<Deployment[]> {
  return apiFetch<Deployment[]>(`/deployments/${applicationId}`);
}

export async function createDeployment(
  revision: string,
  status: string,
  environment: string,
  applicationId: number,
): Promise<Deployment> {
  return apiFetch<Deployment>("/deployments", {
    method: "POST",
    body: JSON.stringify({
      revision,
      status,
      environment,
      applicationId,
    }),
  });
}
