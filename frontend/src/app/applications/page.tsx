"use client";

import { ApplicationCard } from "@/components/applications/application-card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { createApplication } from "@/services/applications";
import { useToast } from "@/components/ui/toast";
import { Boxes } from "lucide-react";
import { useMemo, useState } from "react";

export default function ApplicationsPage() {
  const ready = useAuthGuard();
  const { loading, error, snapshot, applications, reload } = useWorkspace(ready);
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    repoUrl: "",
    branch: "main",
    path: "",
    projectId: "",
  });

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return applications.filter(
      (application) =>
        application.name.toLowerCase().includes(q) ||
        (application.description || "").toLowerCase().includes(q) ||
        (application.repoUrl || "").toLowerCase().includes(q),
    );
  }, [applications, query]);

  if (!ready) return null;

  async function onCreate() {
    if (!form.name.trim() || !form.projectId) {
      push("Name and project are required.", "error");
      return;
    }
    setSaving(true);
    try {
      await createApplication(
        form.name.trim(),
        form.description,
        form.repoUrl,
        form.branch,
        form.path,
        Number(form.projectId),
      );
      setOpen(false);
      setForm({
        name: "",
        description: "",
        repoUrl: "",
        branch: "main",
        path: "",
        projectId: "",
      });
      push("Application created.", "success");
      reload();
    } catch (err) {
      push(err instanceof Error ? err.message : "Create failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Applications"
        description="GitOps applications across projects, with live sync and health from recorded deployments."
        actions={
          <Button onClick={() => setOpen(true)}>+ New Application</Button>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          className="max-w-md flex-1"
          placeholder="Search applications"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex rounded-lg border border-white/10 p-1">
          <button
            className={`rounded-md px-3 py-1 text-xs ${view === "cards" ? "bg-white/10" : "text-zinc-400"}`}
            onClick={() => setView("cards")}
          >
            Cards
          </button>
          <button
            className={`rounded-md px-3 py-1 text-xs ${view === "table" ? "bg-white/10" : "text-zinc-400"}`}
            onClick={() => setView("table")}
          >
            Table
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Boxes size={22} />}
          title="No applications yet"
          description="Add an application to a project to start tracking repository, health, and revisions."
          action={<Button onClick={() => setOpen(true)}>+ New Application</Button>}
        />
      ) : view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Repository</th>
                <th className="px-3 py-3">Branch</th>
                <th className="px-3 py-3">Health</th>
                <th className="px-3 py-3">Sync</th>
                <th className="px-3 py-3">Revision</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((application) => (
                <tr key={application.id} className="border-b border-white/6">
                  <td className="px-3 py-3">{application.name}</td>
                  <td className="px-3 py-3 font-mono text-xs text-zinc-400">
                    {application.repoUrl || "—"}
                  </td>
                  <td className="px-3 py-3">{application.branch || "main"}</td>
                  <td className="px-3 py-3">
                    <StatusBadge value={application.latestDeployment?.healthStatus} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge value={application.latestDeployment?.syncStatus} />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {application.latestDeployment?.revision || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        title="New application"
        description="Applications belong to a project and map to a Git repository path."
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void onCreate()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <select
            className="h-11 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm"
            value={form.projectId}
            onChange={(event) =>
              setForm((current) => ({ ...current, projectId: event.target.value }))
            }
          >
            <option value="">Select project</option>
            {snapshot?.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
          <Input
            placeholder="Description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />
          <Input
            placeholder="Repository URL"
            value={form.repoUrl}
            onChange={(event) =>
              setForm((current) => ({ ...current, repoUrl: event.target.value }))
            }
          />
          <Input
            placeholder="Branch"
            value={form.branch}
            onChange={(event) =>
              setForm((current) => ({ ...current, branch: event.target.value }))
            }
          />
          <Input
            placeholder="Path"
            value={form.path}
            onChange={(event) =>
              setForm((current) => ({ ...current, path: event.target.value }))
            }
          />
        </div>
      </Modal>
    </div>
  );
}
