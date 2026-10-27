"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Private cluster");
  const [argoUrl, setArgoUrl] = useState("https://argocd-server.argocd.svc");
  const [caPem, setCaPem] = useState("");
  const [saving, setSaving] = useState(false);
  const [enrollment, setEnrollment] = useState<ConnectorEnrollment | null>(null);
  const [formMessage, setFormMessage] = useState("");

  const refresh = useCallback(async () => {
    setItems(await listConnectors());
  }, []);

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      push(err instanceof Error ? err.message : "Could not load private-cluster connectors.", "error");
    });
  }, [push, refresh]);

  function close() {
    setOpen(false);
    setEnrollment(null);
    setFormMessage("");
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
      push("Copied.", "success");
    } catch {
      push("Could not copy. Select the text and copy it manually.", "error");
    }
  }

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Private cluster</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
            For an Argo CD server this service cannot reach. The agent runs in
            your Kubernetes cluster and connects out over HTTPS. Use it on any
            distribution. The Argo CD token stays in the cluster. Direct Connect
            is unchanged. After enrollment, the agent keeps its credential in a
            Secret so a replacement pod can reconnect.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEnrollment(null);
            setFormMessage("");
            setOpen(true);
          }}
        >
          Connect Private Cluster
        </Button>
      </div>

      {items.length === 0 ? (
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
                      onClick={async () => {
                        try {
                          const next = await rotateConnector(item.id);
                          setEnrollment(next);
                          setOpen(true);
                          await refresh();
                          push("The previous agent credential no longer works.", "info");
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
                      onClick={async () => {
                        try {
                          await revokeConnector(item.id);
                          await refresh();
                          push("Connector revoked.", "info");
                        } catch (err) {
                          push(err instanceof Error ? err.message : "Could not revoke the connector.", "error");
                        }
                      }}
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
        title="Connect Private Cluster"
        description="Generate a one-time enrollment, then apply it inside the cluster. The token is shown only now."
        onClose={close}
        footer={
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          {!enrollment ? (
            <>
              <label className="block text-sm text-zinc-300" htmlFor="connector-name">
                Name
              </label>
              <Input
                id="connector-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
              />
              <label className="block text-sm text-zinc-300" htmlFor="connector-argo-url">
                Argo CD address inside the cluster
              </label>
              <Input
                id="connector-argo-url"
                value={argoUrl}
                onChange={(event) => setArgoUrl(event.target.value)}
                autoComplete="off"
              />
              <p className="text-xs leading-5 text-zinc-500">
                Use the HTTPS address the agent can reach. The usual in-cluster
                service is shown above. Change it when Argo CD uses another
                service or an ingress. GitOps Insights does not connect to it.
              </p>
              <label className="block text-sm text-zinc-300" htmlFor="connector-ca">
                Private CA certificate, optional
              </label>
              <textarea
                id="connector-ca"
                value={caPem}
                onChange={(event) => setCaPem(event.target.value)}
                placeholder="Leave empty when Argo CD has a publicly trusted certificate"
                className="h-28 w-full rounded-lg border border-white/10 bg-zinc-950/60 p-3 font-mono text-[11px] leading-5 text-zinc-200"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs leading-5 text-zinc-500">
                Paste a PEM CA certificate only when Argo CD uses a private
                certificate authority. Do not paste a private key. A public
                certificate needs nothing here. This does not change how the
                agent checks the GitOps Insights certificate.
              </p>
              {formMessage ? (
                <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
                  {formMessage}
                </p>
              ) : null}
              <Button loading={saving} onClick={() => void generate()}>
                Generate enrollment
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs leading-5 text-zinc-400">
                The enrollment command expires {new Date(enrollment.expiresAt).toLocaleString()} and
                works once. Closing this dialog hides it. The manifest has no
                credentials. Create the Argo CD secret in the cluster with your
                own token. Do not paste that token here.
              </p>
              <p className="rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 font-mono text-[11px] leading-5 text-zinc-300">
                {enrollment.localSecretCommand}
              </p>
              <Button size="sm" variant="secondary" onClick={() => void copy(enrollment.localSecretCommand)}>
                Copy Argo CD secret command
              </Button>
              {enrollment.caSecretCommand ? (
                <>
                  <p className="text-xs leading-5 text-zinc-500">
                    Save the CA certificate as ca.crt on the machine where you
                    run kubectl, then create the secret. The manifest mounts it
                    read-only and does not contain the certificate.
                  </p>
                  <p className="rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 font-mono text-[11px] leading-5 text-zinc-300">
                    {enrollment.caSecretCommand}
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => void copy(enrollment.caSecretCommand ?? "")}>
                    Copy CA secret command
                  </Button>
                </>
              ) : null}
              <p className="rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 font-mono text-[11px] leading-5 break-all text-zinc-300">
                {enrollment.enrollmentCommand}
              </p>
              <Button size="sm" variant="secondary" onClick={() => void copy(enrollment.enrollmentCommand)}>
                Copy enrollment command
              </Button>
              <p className="text-xs leading-5 text-zinc-500">
                On rotation, run the first two commands below, then the new
                enrollment command, then the restart. The restart has to be last.
              </p>
              <p className="whitespace-pre-wrap rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 font-mono text-[11px] leading-5 text-zinc-300">
                {enrollment.recoveryCommands}
              </p>
              <textarea
                readOnly
                className="h-56 w-full rounded-lg border border-white/10 bg-zinc-950/60 p-3 font-mono text-[11px] leading-5 text-zinc-200"
                value={enrollment.manifest}
              />
              <Button size="sm" variant="secondary" onClick={() => void copy(enrollment.manifest)}>
                Copy manifest
              </Button>
            </>
          )}
        </div>
      </Modal>
    </Card>
  );
}

function describe(item: ConnectorView): string {
  if (item.status === "pending") {
    if (item.enrollmentState === "expired") {
      return "The enrollment expired before the agent used it. Rotate the credential to generate another.";
    }
    if (item.applicationsSeen > 0) {
      return "Waiting for the agent to enroll again. Previously saved applications are unchanged.";
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
