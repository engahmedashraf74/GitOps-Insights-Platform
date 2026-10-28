import { apiFetch } from "./api";

export type ConnectorStatus =
  | "pending"
  | "connected"
  | "disconnected"
  | "error"
  | "revoked";

export type ConnectorView = {
  id: number;
  name: string;
  argoUrl: string;
  status: ConnectorStatus;
  lastSeenAt: string | null;
  lastError: string | null;
  applicationsSeen: number;
  projectsSeen: number;
  createdAt: string;
  enrollmentState: "none" | "used" | "expired" | "open";
  enrollmentExpiresAt: string | null;
};

export type ConnectorEnrollment = {
  id: number;
  name: string;
  status: "pending";
  expiresAt: string;
  enrollmentToken: string;
  enrollmentCommand: string;
  installCommand: string;
  manifest: string;
  localSecretCommand: string;
  caSecretCommand: string | null;
  recoveryCommands: string;
};

export function listConnectors() {
  return apiFetch<ConnectorView[]>("/connectors");
}

export function createConnector(input: { name?: string; argoUrl?: string; caCertificate?: string }) {
  return apiFetch<ConnectorEnrollment>("/connectors", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function rotateConnector(id: number) {
  return apiFetch<ConnectorEnrollment>(`/connectors/${id}/enrollment`, {
    method: "POST",
  });
}

export function revokeConnector(id: number) {
  return apiFetch<{ id: number; status: "revoked" }>(`/connectors/${id}`, {
    method: "DELETE",
  });
}
