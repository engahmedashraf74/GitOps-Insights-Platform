import { Card } from "@/components/ui/card";
import { HealthBadge, SyncBadge } from "@/components/ui/status-badge";
import { formatRelative, shortRevision } from "@/lib/format";
import type { EnrichedApplication } from "@/services/workspace";
import Link from "next/link";

export function ApplicationCard({
  application,
}: {
  application: EnrichedApplication;
}) {
  const latest = application.latestDeployment;

  return (
    <Link href={`/applications/${application.id}`}>
      <Card className="h-full p-5 transition hover:border-teal-400/30 hover:bg-white/[0.03]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-medium text-zinc-50">
              {application.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
              {application.namespace
                ? `${application.namespace}${application.cluster ? ` · ${application.cluster}` : ""}`
                : application.description || "Imported from Argo CD"}
            </p>
          </div>
          <HealthBadge value={application.healthStatus || latest?.healthStatus} />
        </div>
        <p className="mt-4 truncate font-mono text-xs text-zinc-500">
          {application.repoUrl || "Repository not set"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <SyncBadge value={application.syncStatus || latest?.syncStatus} />
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
            {application.branch || "HEAD"}
          </span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
            {application.namespace || latest?.environment || "No namespace"}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
          <span>{shortRevision(application.revision || latest?.revision)}</span>
          <span>{formatRelative(latest?.deployedAt)}</span>
        </div>
      </Card>
    </Link>
  );
}
