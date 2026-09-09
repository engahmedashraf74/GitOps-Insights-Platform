import { apiFetch } from "./api";
import type { Environment } from "@/types";

export async function getEnvironments(
  applicationId: number,
): Promise<Environment[]> {
  return apiFetch<Environment[]>(`/environments/${applicationId}`);
}

export async function createEnvironment(
  name: string,
  applicationId: number,
): Promise<Environment> {
  return apiFetch<Environment>("/environments", {
    method: "POST",
    body: JSON.stringify({ name, applicationId }),
  });
}

export async function deleteEnvironment(id: number): Promise<unknown> {
  return apiFetch(`/environments/${id}`, { method: "DELETE" });
}
