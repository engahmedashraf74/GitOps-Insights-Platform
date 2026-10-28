"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  createConnector,
  listConnectors,
  revokeConnector,
  rotateConnector,
  type ConnectorEnrollment,
  type ConnectorView,
} from "@/services/connectors";

const labels: Record<ConnectorView["status"], string> = {
  pending: "Pending",
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Error",
  revoked: "Revoked",
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300";

function tone(status: ConnectorView["status"]) {
  if (status === "connected") return "success" as const;
  if (status === "pending") return "info" as const;
  if (status === "error") return "danger" as const;
  if (status === "disconnected") return "warning" as const;
  return "neutral" as const;
}

export function PrivateClusterPanel() {
  const { push } = useToast();
  const [items, setItems] = useState<ConnectorView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Private cluster");
  const [argoUrl, setArgoUrl] = useState("https://argocd-server.argocd.svc");
  const [caPem, setCaPem] = useState("");
  const [saving, setSaving] = useState(false);
  const [enrollment, setEnrollment] = useState<ConnectorEnrollment | null>(null);
  const [reason, setReason] = useState<"new" | "rotate">("new");
  const [copied, setCopied] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [revoking, setRevoking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await listConnectors());
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load private-cluster connectors.");
      throw err;
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listConnectors()
      .then((next) => {
        if (cancelled) return;
        setItems(next);
        setLoadError("");
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Could not load private-cluster connectors.");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = enrollment ? items.find((item) => item.id === enrollment.id) : undefined;
  const waiting = items.some((item) => item.status === "pending" || item.status === "disconnected");

  useEffect(() => {
    if (!open || !enrollment) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [enrollment, open, refresh]);

  useEffect(() => {
    if (open || !waiting) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [open, refresh, waiting]);

  function close() {
    setOpen(false);
    setEnrollment(null);
    setFormMessage("");
    setCopied(false);
    setCaPem("");
  }

  async function generate() {
    setSaving(true);
    setFormMessage("");
    try {
      const created = await createConnector({
        name: name.trim(),
        argoUrl: argoUrl.trim(),
        ...(caPem.trim() ? { caCertificate: caPem.trim() } : {}),
      });
      setReason("new");
      setCopied(false);
      setEnrollment(created);
      await refresh();
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Could not create an enrollment.");
    } finally {
      setSaving(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      push("Command copied.", "success");
    } catch {
      push("Could not copy. Select the command and copy it manually.", "error");
    }
  }

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Private cluster</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
            The agent runs inside your Kubernetes cluster and calls GitOps Insights
            over outbound HTTPS. Argo CD stays private. Direct Connect is unchanged.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className={focusRing}
            onClick={() => {
              void refresh().catch((err: unknown) => {
                push(err instanceof Error ? err.message : "Could not load private-cluster connectors.", "error");
              });
            }}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            className={focusRing}
            onClick={() => {
              setEnrollment(null);
              setCopied(false);
              setFormMessage("");
              setReason("new");
              setOpen(true);
            }}
          >
            Connect Private Cluster
          </Button>
        </div>
      </div>

      {!loaded ? (
        <p className="mt-4 text-xs text-zinc-500">Loading connectors…</p>
      ) : loadError && items.length === 0 ? (
        <p className="mt-4 text-xs text-rose-200" role="alert">{loadError}</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-500">No private cluster is enrolled.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-white/10 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-100">{item.name}</span>
                    <Badge tone={tone(item.status)}>{labels[item.status]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{item.argoUrl}</p>
                </div>
                {item.status !== "revoked" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className={focusRing}
                      onClick={async () => {
                        try {
                          const next = await rotateConnector(item.id);
                          setReason("rotate");
                          setCopied(false);
                          setEnrollment(next);
                          setOpen(true);
                          await refresh();
                          push("The previous agent credential no longer works. Run the new command.", "info");
                        } catch (err) {
                          push(err instanceof Error ? err.message : "Could not rotate the credential.", "error");
                        }
                      }}
                    >
                      Rotate credential
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className={focusRing}
                      onClick={() => setRevokeId(item.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-400">{describe(item)}</p>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        className="max-w-2xl"
        title="Connect Private Cluster"
        description="One command installs the agent. Connected appears only after it checks in."
        onClose={close}
        footer={
          <Button variant="ghost" className={focusRing} onClick={close}>
            Close
          </Button>
        }
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {!enrollment ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void generate();
              }}
            >
              <p className="text-xs leading-5 text-zinc-500">
                You need kubectl pointed at the cluster, permission to create a
                namespace and a deployment there, and a least-privilege Argo CD
                API token. GitOps Insights does not open a port into the cluster.
              </p>
              <label className="block text-sm text-zinc-300" htmlFor="connector-name">
                Name
              </label>
              <Input
                id="connector-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
                className={focusRing}
              />
              <label className="block text-sm text-zinc-300" htmlFor="connector-argo-url">
                Argo CD address the agent can reach
              </label>
              <Input
                id="connector-argo-url"
                value={argoUrl}
                onChange={(event) => setArgoUrl(event.target.value)}
                autoComplete="off"
                className={focusRing}
              />
              <p className="text-xs leading-5 text-zinc-500">
                Use the in-cluster HTTPS service, or another address that is
                reachable from the cluster. Change the default when Argo CD is
                not in the usual namespace.
              </p>
              <label className="block text-sm text-zinc-300" htmlFor="connector-ca">
                Private CA certificate, optional
              </label>
              <textarea
                id="connector-ca"
                value={caPem}
                onChange={(event) => setCaPem(event.target.value)}
                placeholder="Leave empty when Argo CD has a publicly trusted certificate"
                className={`h-28 w-full rounded-lg border border-white/10 bg-zinc-950/60 p-3 font-mono text-[11px] leading-5 text-zinc-200 ${focusRing}`}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs leading-5 text-zinc-500">
                Paste a PEM CA certificate only when Argo CD uses a private
                certificate authority. Do not paste a private key. This does not
                change how the agent checks the GitOps Insights certificate.
                The certificate is not stored here. The command reads ./ca.crt
                on the machine where you run it.
              </p>
              {formMessage ? (
                <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100" role="alert">
                  {formMessage}
                </p>
              ) : null}
              <Button type="submit" className={focusRing} loading={saving}>
                {saving ? "Preparing setup" : "Create install command"}
              </Button>
            </form>
          ) : (
            <>
              <p className="text-xs leading-5 text-zinc-400" aria-live="polite">
                {statusCopy(current, enrollment, reason, copied)}
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-xs leading-5 text-zinc-500">
                <li>Run it in bash on a machine whose kubectl context is this cluster.</li>
                <li>Confirm the context, then paste the Argo CD token when asked. It is not echoed.</li>
                <li>If you entered a private CA, save it as ./ca.crt in that directory first.</li>
                <li>Leave this window open. The status below updates from the agent, not from the copy button.</li>
              </ol>
              <label className="block text-sm text-zinc-300" htmlFor="connector-install">
                Install command
              </label>
              <textarea
                id="connector-install"
                readOnly
                spellCheck={false}
                className={`h-56 w-full rounded-lg border border-white/10 bg-zinc-950/60 p-3 font-mono text-[11px] leading-5 text-zinc-200 ${focusRing}`}
                value={enrollment.installCommand}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className={focusRing}
                  onClick={() => void copy(enrollment.installCommand)}
                >
                  {copied ? "Copied" : "Copy command"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className={focusRing}
                  onClick={() => {
                    void refresh().catch((err: unknown) => {
                      push(err instanceof Error ? err.message : "Could not refresh the connector.", "error");
                    });
                  }}
                >
                  Refresh status
                </Button>
              </div>
              <p className="text-xs leading-5 text-zinc-500">
                The command contains a one-time enrollment token that expires{" "}
                {new Date(enrollment.expiresAt).toLocaleString()}. Closing this
                window hides it. Rotate the credential to generate another.
                Re-running the same command does not print tokens and does not
                remove a credential that already matches this enrollment.
              </p>
              <details className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400">
                <summary className={`cursor-pointer ${focusRing}`}>What the command changes</summary>
                <p className="mt-2 leading-5">
                  Namespace gitops-insights, a ServiceAccount, a Role limited to
                  Secrets in that namespace, the enrollment and Argo CD token
                  Secrets, an optional CA Secret, and one Deployment. No Service
                  or Ingress is created. The image is pinned in the command and
                  must already be available to the cluster.
                </p>
              </details>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={revokeId !== null}
        title="Revoke connector"
        message="The agent can no longer send data. Applications already saved for this organization stay in place."
        confirmLabel="Revoke"
        loading={revoking}
        onClose={() => setRevokeId(null)}
        onConfirm={() => {
          if (revokeId === null) return;
          setRevoking(true);
          void revokeConnector(revokeId)
            .then(async () => {
              setRevokeId(null);
              await refresh();
              push("Connector revoked.", "info");
            })
            .catch((err: unknown) => {
              push(err instanceof Error ? err.message : "Could not revoke the connector.", "error");
            })
            .finally(() => setRevoking(false));
        }}
      />
    </Card>
  );
}

function statusCopy(
  current: ConnectorView | undefined,
  enrollment: ConnectorEnrollment,
  reason: "new" | "rotate",
  copied: boolean,
): string {
  if (current?.status === "connected") {
    return "Connected. The agent checked in and can send Argo CD discovery for this organization.";
  }
  if (current?.status === "error") {
    return current.lastError || "The agent checked in, and the last discovery failed.";
  }
  if (current?.status === "disconnected") {
    return "The agent has not checked in recently. It will reconnect with the credential stored in the cluster.";
  }
  if (current?.status === "revoked") {
    return "This connector is revoked. Create a new one to install again.";
  }
  if (current?.enrollmentState === "expired") {
    return "This enrollment expired before the agent used it. Close this window and rotate the credential.";
  }
  if (!current && new Date(enrollment.expiresAt).getTime() <= Date.now()) {
    return "This enrollment expired before the agent used it. Close this window and rotate the credential.";
  }
  if (copied) {
    return "Command copied. Run it in the cluster terminal. This stays pending until the agent checks in.";
  }
  if (reason === "rotate") {
    return "The previous credential is no longer valid. Run this command to enroll again.";
  }
  return "The install command is ready. Nothing is connected until the agent checks in.";
}

function describe(item: ConnectorView): string {
  if (item.status === "pending") {
    if (item.enrollmentState === "expired") {
      return "The enrollment expired before the agent used it. Rotate the credential to generate another.";
    }
    if (item.enrollmentState === "open") {
      return "Enrollment is ready. Run the install command where kubectl can reach this cluster.";
    }
    return "Waiting for the agent to enroll. No applications have been received.";
  }
  if (item.status === "disconnected") {
    return "The agent has not checked in recently. Applications already saved are unchanged.";
  }
  if (item.status === "error") {
    return item.lastError || "The last discovery failed. No new applications were saved.";
  }
  if (item.status === "revoked") {
    return "This connector cannot send data. Existing saved applications were not deleted.";
  }
  if (item.applicationsSeen === 0) {
    return "Connected. No applications have been received yet.";
  }
  return `${item.applicationsSeen} applications and ${item.projectsSeen} projects were saved for this organization.`;
}
