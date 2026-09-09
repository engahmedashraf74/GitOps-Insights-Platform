import { apiFetch } from "./api";
import type {
  ApplicationOverview,
  DashboardStats,
  Deployment,
  DeploymentFrequency,
  FailureRate,
} from "@/types";

export async function getOverview(
  applicationId: number,
): Promise<ApplicationOverview> {
  return apiFetch<ApplicationOverview>(
    `/dashboard/overview/${applicationId}`,
  );
}

export async function getStats(
  applicationId: number,
): Promise<DashboardStats> {
  return apiFetch<DashboardStats>(`/dashboard/stats/${applicationId}`);
}

export async function getTimeline(
  applicationId: number,
): Promise<Deployment[]> {
  return apiFetch<Deployment[]>(`/dashboard/timeline/${applicationId}`);
}

export async function getFailureRate(
  applicationId: number,
): Promise<FailureRate> {
  return apiFetch<FailureRate>(`/dashboard/failure-rate/${applicationId}`);
}

export async function getDeploymentFrequency(
  applicationId: number,
): Promise<DeploymentFrequency> {
  return apiFetch<DeploymentFrequency>(
    `/dashboard/frequency/${applicationId}`,
  );
}
