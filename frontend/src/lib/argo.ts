import type { WorkspaceSnapshot } from "@/lib/metrics";

export function isArgoConnected(snapshot: WorkspaceSnapshot | null): boolean {
  if (!snapshot) return false;
  return (
    snapshot.argocd?.connected === true ||
    snapshot.applications.length > 0 ||
    snapshot.projects.length > 0
  );
}
