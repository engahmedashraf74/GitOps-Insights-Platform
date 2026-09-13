import { apiFetch } from "./api";
import type { Project } from "@/types";

export async function getProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/projects");
}
