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
  testArgoCd,
} from "@/services/integrations";
import { syncApplications } from "@/services/applications";
import type { Integration } from "@/types";
import {
  CheckCircle2,
  GitBranch,
  GitCommitHorizontal,
  MessageSquare,
  Plug,
} from "lucide-react";
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
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testMessage, setTestMessage] = useState("");

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

  async function testConnection() {
    setTesting(true);
    setTestMessage("");
    try {
      const result = await testArgoCd(url.trim(), token.trim());
      setTestMessage(result.message || "Connection succeeded.");
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setTesting(false);
    }
  }

  async function connect() {
    if (!url.trim() || !token.trim()) {
      push("Enter the Argo CD URL and token.", "error");
      return;
    }
    setSaving(true);
    try {
      await connectArgoCd(url.trim(), token.trim());
      setToken("");
      setOpen(false);
      await refresh();
      push("Argo CD connected. Applications were imported.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Connect failed.", "error");
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
                            push("Applications refreshed from Argo CD.", "success");
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
                          await disconnectArgoCd();
                          await refresh();
                          push("Argo CD disconnected.", "info");
                        }}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setUrl(item.url ?? "");
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
        description="The token is sent to the API, encrypted at rest, and never stored in the browser."
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" loading={testing} onClick={() => void testConnection()}>
              Test connection
            </Button>
            <Button loading={saving} onClick={() => void connect()}>
              Connect
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm text-zinc-300">Argo CD URL</label>
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://argocd.example.com"
            />
          </div>
          <PasswordInput
            id="argo-token"
            label="Token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
          />
          {testMessage ? (
            <p className="flex items-start gap-2 text-xs text-zinc-400">
              <CheckCircle2 size={14} className="mt-0.5 text-teal-300" />
              {testMessage}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
