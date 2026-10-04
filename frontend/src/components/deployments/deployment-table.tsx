"use client";

import { HealthBadge, StatusBadge, SyncBadge } from "@/components/ui/status-badge";
import { shownResult, shownSnapshot } from "@/lib/deployment-display";
import { formatDateTime, formatLocalDate, formatLocalTime, formatUtcDateTime, shortRevision } from "@/lib/format";
import type { Deployment } from "@/types";
import { useState } from "react";

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
                <StatusBadge value={shownResult(row.status)} />
              </td>
              <td className="px-3 py-3">
                <SyncBadge value={shownSnapshot(row.syncStatus)} />
              </td>
              <td className="px-3 py-3">
                <HealthBadge value={shownSnapshot(row.healthStatus)} />
              </td>
              <td className="px-3 py-3 text-zinc-400" title={formatUtcDateTime(row.deployedAt)}>
                {formatDateTime(row.deployedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type HistorySort = "date" | "revision" | "health" | "sync" | "result";

export function DeploymentHistoryTable({ rows }: { rows: Deployment[] }) {
  const [sortKey, setSortKey] = useState<HistorySort>("date");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  function toggle(key: HistorySort) {
    if (sortKey === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection(key === "date" ? "desc" : "asc");
  }

  const sorted = [...rows].sort((left, right) => {
    const factor = direction === "asc" ? 1 : -1;
    if (sortKey === "date") {
      return (
        (new Date(left.deployedAt ?? 0).getTime() - new Date(right.deployedAt ?? 0).getTime()) *
        factor
      );
    }
    return historyValue(left, sortKey).localeCompare(historyValue(right, sortKey)) * factor;
  });

  return (
    <div className="max-h-[32rem] overflow-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[var(--surface)]">
          <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
            <SortHeader label="Date" active={sortKey === "date"} onClick={() => toggle("date")} />
            <th className="px-3 py-3 font-medium">Time</th>
            <SortHeader label="Revision" active={sortKey === "revision"} onClick={() => toggle("revision")} />
            <SortHeader label="Health" active={sortKey === "health"} onClick={() => toggle("health")} />
            <SortHeader label="Sync" active={sortKey === "sync"} onClick={() => toggle("sync")} />
            <SortHeader label="Result" active={sortKey === "result"} onClick={() => toggle("result")} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr
              key={`${row.id ?? row.revision}-${index}`}
              className="border-b border-white/6 hover:bg-white/[0.02]"
            >
              <td className="px-3 py-3 text-zinc-200" title={formatUtcDateTime(row.deployedAt)}>
                {formatLocalDate(row.deployedAt)}
              </td>
              <td className="px-3 py-3 text-zinc-400" title={formatUtcDateTime(row.deployedAt)}>
                {formatLocalTime(row.deployedAt)}
              </td>
              <td className="px-3 py-3 font-mono text-xs text-zinc-300" title={row.revision}>
                {shortRevision(row.revision)}
              </td>
              <td className="px-3 py-3">
                <HealthBadge value={shownSnapshot(row.healthStatus)} />
              </td>
              <td className="px-3 py-3">
                <SyncBadge value={shownSnapshot(row.syncStatus)} />
              </td>
              <td className="px-3 py-3">
                <StatusBadge value={shownResult(row.status)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-3 font-medium">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={active ? "text-[var(--accent-strong)]" : "text-[var(--text-muted)]"}
      >
        {label}
      </button>
    </th>
  );
}

function historyValue(row: Deployment, key: Exclude<HistorySort, "date">): string {
  if (key === "revision") return row.revision || "";
  if (key === "health") return row.healthStatus || "";
  if (key === "sync") return row.syncStatus || "";
  return row.status || "";
}
