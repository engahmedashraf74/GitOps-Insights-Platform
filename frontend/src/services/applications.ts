import { apiFetch } from "./api";

export async function getApplications(
  projectId: number,
) {
  return apiFetch(
    `/applications/${projectId}`,
  );
}

export async function createApplication(
  name: string,
  description: string,
  repoUrl: string,
  branch: string,
  path: string,
  projectId: number,
) {
  return apiFetch("/applications", {
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
