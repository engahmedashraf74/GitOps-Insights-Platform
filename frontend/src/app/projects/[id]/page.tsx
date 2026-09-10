"use client";

import { ApplicationCard } from "@/components/applications/application-card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { createApplication } from "@/services/applications";
import { Boxes } from "lucide-react";
import { use, useState } from "react";

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = Number(id);
  const ready = useAuthGuard();
  const { loading, error, snapshot, applications, reload } = useWorkspace(ready);
  const { push } = useToast();
  const project = snapshot?.projects.find((item) => item.id === projectId);
  const apps = applications.filter((item) => item.projectId === projectId);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    repoUrl: "",
    branch: "main",
    path: "",
  });

  if (!ready) return null;

  async function onCreate() {
    if (!form.name.trim()) {
      push("Enter an application name.", "error");
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
        projectId,
      );
      setOpen(false);
      setForm({ name: "", description: "", repoUrl: "", branch: "main", path: "" });
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
        title={project?.name || "Project"}
        description={project?.description || "Applications in this project."}
        actions={<Button onClick={() => setOpen(true)}>+ New Application</Button>}
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={<Boxes size={22} />}
          title="No applications in this project"
          description="Attach a GitOps application to start collecting sync and health data."
          action={<Button onClick={() => setOpen(true)}>+ New Application</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      )}
      <Modal
        open={open}
        title="New application"
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
          {(["name", "description", "repoUrl", "branch", "path"] as const).map((field) => (
            <Input
              key={field}
              placeholder={field}
              value={form[field]}
              onChange={(event) =>
                setForm((current) => ({ ...current, [field]: event.target.value }))
              }
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}
