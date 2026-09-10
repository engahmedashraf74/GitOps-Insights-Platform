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
import type { Integration } from "@/types";
import {
  CheckCircle2,
  GitBranch,
  GitCommitHorizontal,
  MessageSquare,
  Plug,
} from "lucide-react";
import { useEffect, useState } from "react";

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
  const [items, setItems] = useState<Integration[]>(() =>
    typeof window === "undefined" ? [] : listIntegrations(),
  );
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    setItems(listIntegrations());
  }, []);

  if (!ready) return null;

  function refresh() {
    setItems(listIntegrations());
  }

  function testConnection() {
    setTesting(true);
    setTestMessage("");
    try {
      const parsed = new URL(url.trim());
      if (!parsed.protocol.startsWith("http")) {
        throw new Error("URL must start with http or https.");
      }
      if (!token.trim()) {
        throw new Error("Paste an Argo CD token to test. It is not stored.");
      }
      setTestMessage(
        "URL and token look valid locally. A workspace integrations API is required to probe Argo CD from the server.",
      );
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : "Invalid connection details.");
    } finally {
      setTesting(false);
    }
  }

  function connect() {
    if (!url.trim()) {
      push("Enter the Argo CD URL.", "error");
      return;
    }
    try {
      new URL(url.trim());
    } catch {
      push("Enter a valid URL.", "error");
      return;
    }
    connectArgoCd(url.trim());
    setToken("");
    setOpen(false);
    refresh();
    push("Argo CD URL saved. Token was not stored in the browser.", "success");
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Integrations"
        description="Connect delivery systems. Credentials are never written into frontend source or local storage."
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
                <div className="mt-5 flex gap-2">
                  {item.status === "connected" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        disconnectArgoCd();
                        refresh();
                        push("Argo CD disconnected.", "info");
                      }}
                    >
                      Disconnect
                    </Button>
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
        description="The token is used only in this dialog. It is not persisted in the client."
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" loading={testing} onClick={testConnection}>
              Test connection
            </Button>
            <Button onClick={connect}>Connect</Button>
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
