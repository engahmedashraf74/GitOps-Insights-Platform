import { Card } from "@/components/ui/card";
import { HealthBadge, SyncBadge } from "@/components/ui/status-badge";
import { formatRelative } from "@/lib/format";
import type { Project } from "@/types";
import Link from "next/link";

export function ProjectCard({
  project,
  applicationCount,
  deploymentCount,
  healthyCount,
  lastActivity,
}: {
  project: Project;
  applicationCount: number;
  deploymentCount: number;
  healthyCount: number;
  lastActivity?: string;
}) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="h-full p-5 transition hover:border-teal-400/30 hover:bg-white/[0.03]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-medium text-zinc-50">{project.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
              {project.description || "No description provided."}
            </p>
          </div>
          <HealthBadge
            value={
              applicationCount === 0
                ? "Unknown"
                : healthyCount === applicationCount
                  ? "Healthy"
                  : healthyCount === 0
                    ? "Degraded"
                    : "Progressing"
            }
          />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-xs text-zinc-400">
          <div>
            <p className="text-zinc-500">Apps</p>
            <p className="mt-1 text-sm text-zinc-100">{applicationCount}</p>
          </div>
          <div>
            <p className="text-zinc-500">Deploys</p>
            <p className="mt-1 text-sm text-zinc-100">{deploymentCount}</p>
          </div>
          <div>
            <p className="text-zinc-500">Last activity</p>
            <p className="mt-1 text-sm text-zinc-100">{formatRelative(lastActivity)}</p>
          </div>
        </div>
        <div className="mt-4">
          <SyncBadge value={`${healthyCount}/${applicationCount || 0} healthy`} />
        </div>
      </Card>
    </Link>
  );
}
