"use client";

import { ApplicationCard } from "@/components/applications/application-card";
import { ConnectArgoEmptyState } from "@/components/integrations/connect-argo-empty-state";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { isArgoConnected } from "@/lib/argo";
import { Boxes } from "lucide-react";
import { use } from "react";

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = Number(id);
  const ready = useAuthGuard();
  const { loading, error, snapshot, applications, reload } = useWorkspace(ready);
  const project = snapshot?.projects.find((item) => item.id === projectId);
  const apps = applications.filter((item) => item.projectId === projectId);
  const connected = isArgoConnected(snapshot);

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={project?.name || "Project"}
        description={
          project?.description ||
          "Applications imported from this Argo CD project."
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : !connected ? (
        <ConnectArgoEmptyState />
      ) : apps.length === 0 ? (
        <EmptyState
          icon={<Boxes size={22} />}
          title="No applications in this project"
          description="Sync from Argo CD to import applications that belong to this project."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      )}
    </div>
  );
}
