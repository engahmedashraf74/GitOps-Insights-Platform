import { apiFetch } from "./api";
import type { Application, Deployment, Project } from "@/types";
import type { WorkspaceSnapshot } from "@/lib/metrics";

export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  return apiFetch<WorkspaceSnapshot>("/workspace/snapshot");
}

export type EnrichedApplication = Application & {
  project?: Project;
  latestDeployment?: Deployment;
};

export function enrichApplications(
  snapshot: WorkspaceSnapshot,
): EnrichedApplication[] {
  const projectMap = new Map(
    snapshot.projects.map((project) => [project.id, project]),
  );
  const latestByApp = new Map<number, Deployment>();

  for (const deployment of snapshot.deployments) {
    const appId = deployment.applicationId;
    if (!appId) continue;
    const current = latestByApp.get(appId);
    if (
      !current ||
      new Date(deployment.deployedAt ?? 0).getTime() >
        new Date(current.deployedAt ?? 0).getTime()
    ) {
      latestByApp.set(appId, deployment);
    }
  }

  return snapshot.applications.map((application) => {
    const latest = latestByApp.get(application.id);
    return {
      ...application,
      project: projectMap.get(application.projectId),
      latestDeployment: latest
        ? {
            ...latest,
            healthStatus: application.healthStatus ?? latest.healthStatus,
            syncStatus: application.syncStatus ?? latest.syncStatus,
            revision: application.revision ?? latest.revision,
            environment: application.namespace ?? latest.environment,
          }
        : application.revision || application.healthStatus
          ? {
              revision: application.revision || "",
              status: "Succeeded",
              healthStatus: application.healthStatus,
              syncStatus: application.syncStatus,
              environment: application.namespace ?? undefined,
              deployedAt: application.lastObservedAt ?? undefined,
              applicationId: application.id,
            }
          : undefined,
    };
  });
}
