"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import {
  connectArgoCd,
  disconnectArgoCd,
  listIntegrations,
} from "@/services/integrations";
import { syncApplications } from "@/services/applications";
import type { Integration } from "@/types";
import { validateArgoServerUrl } from "@/lib/argo";
import { GitBranch, GitCommitHorizontal, MessageSquare, Plug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const icons: Record<string, typeof Plug> = {
  argocd: Plug,
  github: GitBranch,
  gitlab: GitCommitHorizontal,
  bitbucket: GitBranch,
  slack: MessageSquare,
};

export default function IntegrationsPage() {
  const ready = useAuthGuard();
  const { push } = useToast();
  const [items, setItems] = useState<Integration[]>([]);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  const refresh = useCallback(async () => {
    const data = await listIntegrations();
    setItems(data);
  }, []);

  useEffect(() => {
    if (!ready) return;
    void refresh().catch((err: unknown) => {
      push(err instanceof Error ? err.message : "Could not load integrations.", "error");
    });
  }, [push, ready, refresh]);

  if (!ready) return null;

  function formError(): string | null {
    if (!url.trim() || !token.trim()) return "Enter the Argo CD URL and token.";
    if (token.trim().length < 8) return "The token is too short.";
    return validateArgoServerUrl(url);
  }

  async function connect() {
    const problem = formError();
    setFormMessage("");
    if (problem) {
      setFormMessage(problem);
      return;
    }
    setSaving(true);
    try {
      const result = await connectArgoCd(url.trim(), token.trim());
      setToken("");
      setOpen(false);
      await refresh();
      if (result.syncError) {
        push(
          `Argo CD is saved. The first sync failed: ${result.syncError} Use Sync applications. The token does not need to be entered again.`,
          "error",
        );
        return;
      }
      const applications = result.sync?.applicationsFetched ?? 0;
      const projects = result.sync?.projectsFetched ?? 0;
      if (applications === 0 && projects === 0) {
        push("Argo CD is connected. No applications or projects were returned.", "info");
      } else {
        push("Argo CD is connected. Applications and projects were imported.", "success");
      }
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Could not connect to Argo CD.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Integrations"
        description="Argo CD is the source of truth. Tokens are stored encrypted on the server and never returned to the browser."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const Icon = icons[item.provider] ?? Plug;
          return (
            <Card key={item.provider} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300">
                    <Icon size={18} />
                  </span>
                  <div>
                    <h3 className="text-sm font-medium">{item.name}</h3>
                    <p className="mt-1 text-xs text-zinc-500">{item.description}</p>
                  </div>
                </div>
                <Badge
                  tone={
                    item.status === "connected"
                      ? "success"
                      : item.status === "coming_soon"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {item.status === "coming_soon" ? "Coming soon" : item.status}
                </Badge>
              </div>
              {item.provider === "argocd" && item.status === "connected" && item.url ? (
                <p className="mt-4 truncate text-xs text-zinc-500">{item.url}</p>
              ) : null}
              {item.provider === "argocd" ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {item.status === "connected" ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          try {
                            await syncApplications();
                            await refresh();
                            push("Applications and projects refreshed from Argo CD.", "success");
                          } catch (err) {
                            push(
                              err instanceof Error ? err.message : "Sync failed.",
                              "error",
                            );
                          }
                        }}
                      >
                        Sync applications
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          try {
                            await disconnectArgoCd();
                            await refresh();
                            push(
                              "Argo CD disconnected. The stored token was removed. Revoke that token in Argo CD if it should stop working.",
                              "info",
                            );
                          } catch (err) {
                            push(
                              err instanceof Error ? err.message : "Could not disconnect Argo CD.",
                              "error",
                            );
                          }
                        }}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setUrl("");
                        setToken("");
                        setFormMessage("");
                        setOpen(true);
                      }}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              ) : (
                <Button className="mt-5" size="sm" variant="secondary" disabled>
                  Unavailable
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <Modal
        open={open}
        title="Connect Argo CD"
        description="Enter the server URL and an API token. Connect checks the certificate, token, and read access, then imports applications and projects."
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!url.trim() || !token.trim()} onClick={() => void connect()}>
              Connect
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs leading-5 text-zinc-400">
            The AWS server makes this connection. Use a public HTTPS address.
            localhost, a Kubernetes service name, and a private address such as
            192.168.49.2 cannot be reached. A private cluster needs a separate
            outbound connection, which is not part of this setup.
          </p>
          <div>
            <label className="mb-1.5 block text-sm text-zinc-300" htmlFor="argo-url">
              Argo CD server URL
            </label>
            <Input
              id="argo-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://argocd.example.com"
              autoComplete="off"
            />
          </div>
          <PasswordInput
            id="argo-token"
            label="Argo CD API token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="new-password"
            placeholder="Paste an API token"
          />
          <p className="text-xs leading-5 text-zinc-500">
            In Argo CD, create an account with get access to applications and
            projects, then generate an API token. An administrator password is
            not used. Later syncs reuse the stored token.
          </p>
          {formMessage ? (
            <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-100">
              {formMessage}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
