"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/toast";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { getSessionUser } from "@/lib/auth";
import { getWorkspace, saveWorkspace } from "@/lib/settings";
import { loadSettings, updateSettings } from "@/services/settings";
import type { UserPreferences } from "@/types";
import Link from "next/link";
import { useEffect, useState } from "react";

const tabs = ["Profile", "Security", "Notifications", "Integrations", "Preferences"] as const;
type Tab = (typeof tabs)[number];

export default function SettingsPage() {
  const ready = useAuthGuard();
  const { push } = useToast();
  const { snapshot } = useWorkspace(ready);
  const [tab, setTab] = useState<Tab>("Profile");
  const [prefs, setPrefs] = useState<UserPreferences>(loadSettings);
  const [workspace, setWorkspace] = useState(getWorkspace().name);
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");

  useEffect(() => {
    setEmail(getSessionUser()?.email ?? "");
    setPrefs(loadSettings());
    setWorkspace(getWorkspace().name);
  }, []);

  if (!ready) return null;

  function saveProfile() {
    updateSettings({ username: prefs.username });
    saveWorkspace({ name: workspace.trim() || "Platform workspace" });
    push("Profile saved.", "success");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Settings"
        description="Account, security, and workspace preferences for this client."
      />
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-white/8 p-1">
        {tabs.map((item) => (
          <button
            key={item}
            className={`rounded-lg px-3 py-2 text-sm ${
              tab === item ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"
            }`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Profile" ? (
        <section className="space-y-4 rounded-xl border border-white/8 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-400/15 text-lg font-semibold text-teal-300">
              {(prefs.username || email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-zinc-100">{prefs.username || "Unnamed user"}</p>
              <p className="text-xs text-zinc-500">{email || "Email from session token"}</p>
            </div>
          </div>
          <Input
            value={prefs.username}
            onChange={(event) =>
              setPrefs((current) => ({ ...current, username: event.target.value }))
            }
            placeholder="Username"
          />
          <Input value={email} disabled placeholder="Email" />
          <Input
            value={workspace}
            onChange={(event) => setWorkspace(event.target.value)}
            placeholder="Workspace name"
          />
          <Button onClick={saveProfile}>Save profile</Button>
        </section>
      ) : null}

      {tab === "Security" ? (
        <section className="space-y-4 rounded-xl border border-white/8 p-5">
          <p className="text-sm text-zinc-400">
            Password changes require a dedicated users API that is not exposed in this release.
          </p>
          <PasswordInput
            id="current"
            label="Current password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <PasswordInput
            id="next"
            label="New password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
          />
          <Button
            onClick={() =>
              push("Password updates are not available until the security API ships.", "info")
            }
          >
            Change password
          </Button>
          <div className="rounded-lg border border-white/8 p-4 text-sm text-zinc-400">
            Session: JWT stored in local browser storage. Sign out from the account menu to clear it.
          </div>
        </section>
      ) : null}

      {tab === "Notifications" ? (
        <section className="space-y-4 rounded-xl border border-white/8 p-5">
          {(
            [
              ["email", "Email notifications"],
              ["deploymentFailures", "Deployment failure alerts"],
              ["weeklySummary", "Weekly summary"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4 text-sm">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={prefs.notifications[key]}
                onChange={(event) => {
                  const next = {
                    ...prefs,
                    notifications: {
                      ...prefs.notifications,
                      [key]: event.target.checked,
                    },
                  };
                  setPrefs(next);
                  updateSettings(next);
                }}
              />
            </label>
          ))}
        </section>
      ) : null}

      {tab === "Integrations" ? (
        <section className="rounded-xl border border-white/8 p-5 text-sm text-zinc-400">
          Manage Argo CD and upcoming providers on the{" "}
          <Link href="/integrations" className="text-teal-300">
            Integrations
          </Link>{" "}
          page.
        </section>
      ) : null}

      {tab === "Preferences" ? (
        <section className="space-y-4 rounded-xl border border-white/8 p-5">
          <label className="block text-sm">
            Theme
            <select
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3"
              value={prefs.theme}
              onChange={(event) => {
                const next = {
                  ...prefs,
                  theme: event.target.value as UserPreferences["theme"],
                };
                setPrefs(next);
                updateSettings(next);
              }}
            >
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="block text-sm">
            Timezone
            <Input
              className="mt-2"
              value={prefs.timezone}
              onChange={(event) => {
                const next = { ...prefs, timezone: event.target.value };
                setPrefs(next);
                updateSettings(next);
              }}
            />
          </label>
          <label className="block text-sm">
            Default project
            <select
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3"
              value={prefs.defaultProjectId ?? ""}
              onChange={(event) => {
                const next = {
                  ...prefs,
                  defaultProjectId: event.target.value
                    ? Number(event.target.value)
                    : null,
                };
                setPrefs(next);
                updateSettings(next);
              }}
            >
              <option value="">None</option>
              {snapshot?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}
    </div>
  );
}
