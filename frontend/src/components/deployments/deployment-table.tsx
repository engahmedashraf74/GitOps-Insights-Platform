"use client";

import { HealthBadge, StatusBadge, SyncBadge } from "@/components/ui/status-badge";
import { formatDateTime, shortRevision } from "@/lib/format";
import type { Deployment } from "@/types";

export function DeploymentTable({
  rows,
  applicationName,
}: {
  rows: Deployment[];
  applicationName?: (applicationId?: number) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-zinc-500">
            {applicationName ? <th className="px-3 py-3 font-medium">Application</th> : null}
            <th className="px-3 py-3 font-medium">Environment</th>
            <th className="px-3 py-3 font-medium">Revision</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Sync</th>
            <th className="px-3 py-3 font-medium">Health</th>
            <th className="px-3 py-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.id ?? row.revision}-${index}`}
              className="border-b border-white/6 hover:bg-white/[0.02]"
            >
              {applicationName ? (
                <td className="px-3 py-3 font-medium text-zinc-100">
                  {applicationName(row.applicationId)}
                </td>
              ) : null}
              <td className="px-3 py-3 text-zinc-300">{row.environment || "—"}</td>
              <td className="px-3 py-3 font-mono text-xs text-zinc-300">
                {shortRevision(row.revision)}
              </td>
              <td className="px-3 py-3">
                <StatusBadge value={row.status} />
              </td>
              <td className="px-3 py-3">
                <SyncBadge value={row.syncStatus} />
              </td>
              <td className="px-3 py-3">
                <HealthBadge value={row.healthStatus} />
              </td>
              <td className="px-3 py-3 text-zinc-400">
                {formatDateTime(row.deployedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeploymentTimeline({ rows }: { rows: Deployment[] }) {
  return (
    <ol className="space-y-4">
      {rows.map((row, index) => (
        <li key={`${row.id ?? row.revision}-${index}`} className="flex gap-3">
          <div className={`mt-2 h-2 w-2 shrink-0 rounded-full ${statusDot(row.status)}`} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={row.status} />
              <span className="text-sm text-zinc-200">{timelineDate(row.deployedAt)}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <HealthBadge value={row.healthStatus} />
              <SyncBadge value={row.syncStatus} />
            </div>
            <p className="mt-2 font-mono text-xs text-zinc-300">
              {shortRevision(row.revision)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{formatDateTime(row.deployedAt)}</p>
            {row.environment ? (
              <p className="mt-1 text-xs text-zinc-500">{row.environment}</p>
            ) : null}
            {row.commitSha ? (
              <p className="mt-1 font-mono text-xs text-zinc-500">
                {shortRevision(row.commitSha)}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function timelineDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function statusDot(status?: string | null): string {
  const lower = (status || "").toLowerCase();
  if (lower.includes("fail")) return "bg-rose-400";
  if (lower.includes("progress") || lower.includes("run")) return "bg-amber-400";
  if (lower.includes("success") || lower === "succeeded") return "bg-emerald-400";
  return "bg-zinc-500";
}
