"use client";

import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { normalizeHealth } from "@/lib/metrics";
import { createProject } from "@/services/projects";
import { FolderKanban } from "lucide-react";
import { useMemo, useState } from "react";

export default function ProjectsPage() {
  const ready = useAuthGuard();
  const { loading, error, snapshot, applications, reload } = useWorkspace(ready);
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "activity">("name");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const cards = useMemo(() => {
    const projects = snapshot?.projects ?? [];
    const mapped = projects.map((project) => {
      const apps = applications.filter((application) => application.projectId === project.id);
      const deployments = (snapshot?.deployments ?? []).filter((item) =>
        apps.some((application) => application.id === item.applicationId),
      );
      const healthyCount = apps.filter(
        (application) =>
          normalizeHealth(application.latestDeployment?.healthStatus) === "Healthy",
      ).length;
      const lastActivity = deployments
        .map((item) => item.deployedAt)
        .filter(Boolean)
        .sort()
        .at(-1);
      return {
        project,
        applicationCount: apps.length,
        deploymentCount: deployments.length,
        healthyCount,
        lastActivity,
      };
    });
    const filtered = mapped.filter(
      (item) =>
        item.project.name.toLowerCase().includes(query.toLowerCase()) ||
        (item.project.description || "").toLowerCase().includes(query.toLowerCase()),
    );
    return filtered.sort((a, b) => {
      if (sort === "activity") {
        return (
          new Date(b.lastActivity ?? 0).getTime() -
          new Date(a.lastActivity ?? 0).getTime()
        );
      }
      return a.project.name.localeCompare(b.project.name);
    });
  }, [applications, query, snapshot, sort]);

  if (!ready) return null;

  async function onCreate() {
    if (!name.trim()) {
      push("Enter a project name.", "error");
      return;
    }
    setSaving(true);
    try {
      await createProject(name.trim(), description);
      setOpen(false);
      setName("");
      setDescription("");
      push("Project created.", "success");
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
        title="Projects"
        description="Group applications and environments for each delivery surface."
        actions={<Button onClick={() => setOpen(true)}>+ New Project</Button>}
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchInput
          className="max-w-md flex-1"
          placeholder="Search projects"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="h-10 rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm"
          value={sort}
          onChange={(event) => setSort(event.target.value as "name" | "activity")}
        >
          <option value="name">Sort by name</option>
          <option value="activity">Sort by activity</option>
        </select>
      </div>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={22} />}
          title="No projects yet"
          description="Create a project to start attaching GitOps applications."
          action={<Button onClick={() => setOpen(true)}>+ New Project</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <ProjectCard
              key={card.project.id}
              project={card.project}
              applicationCount={card.applicationCount}
              deploymentCount={card.deploymentCount}
              healthyCount={card.healthyCount}
              lastActivity={card.lastActivity}
            />
          ))}
        </div>
      )}
      <Modal
        open={open}
        title="New project"
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
          <Input
            placeholder="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            placeholder="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
