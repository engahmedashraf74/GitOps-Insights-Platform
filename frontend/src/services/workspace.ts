import { getApplications } from "./applications";
import { getDeployments } from "./deployments";
import { getProjects } from "./projects";
import type { Application, Deployment, Project } from "@/types";
import type { WorkspaceSnapshot } from "@/lib/metrics";

export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const projects = await getProjects();
  const applicationGroups = await Promise.all(
    projects.map((project) => getApplications(project.id)),
  );
  const applications = applicationGroups.flat();
  const deploymentGroups = await Promise.all(
    applications.map(async (application) => {
      const deployments = await getDeployments(application.id);
      return deployments.map((deployment) => ({
        ...deployment,
        applicationId: deployment.applicationId ?? application.id,
      }));
    }),
  );

  return {
    projects,
    applications,
    deployments: deploymentGroups.flat(),
  };
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

  return snapshot.applications.map((application) => ({
    ...application,
    project: projectMap.get(application.projectId),
    latestDeployment: latestByApp.get(application.id),
  }));
}
