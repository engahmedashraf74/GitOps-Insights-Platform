import { apiFetch } from "./api";

export async function getProjects() {
  return apiFetch("/projects");
}

export async function createProject(
  name: string,
  description: string,
) {
  return apiFetch("/projects", {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
    }),
  });
}
