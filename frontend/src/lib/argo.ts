import type { WorkspaceSnapshot } from "@/lib/metrics";

export function validateArgoServerUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return "Enter the Argo CD server URL, including https://.";
  }
  if (url.protocol !== "https:") return "Argo CD must be reached over HTTPS.";
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    host.startsWith("127.")
  ) {
    return "localhost is the machine running the check, not your Argo CD server. Use an HTTPS URL the GitOps Insights server can reach.";
  }
  if (host.endsWith(".svc") || host.includes(".svc.") || host.endsWith(".cluster.local")) {
    return "A Kubernetes service address is not reachable from the GitOps Insights server on AWS.";
  }
  if (
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return "A private network address is not reachable from the GitOps Insights server on AWS.";
  }
  return null;
}

export function isArgoConnected(snapshot: WorkspaceSnapshot | null): boolean {
  if (!snapshot) return false;
  return (
    snapshot.argocd?.connected === true ||
    snapshot.applications.length > 0 ||
    snapshot.projects.length > 0
  );
}
