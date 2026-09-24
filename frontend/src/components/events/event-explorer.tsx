import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/format";
import type { ApplicationEvent } from "@/types";

export function EventExplorer({ rows }: { rows: ApplicationEvent[] }) {
  const ordered = [...rows].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  if (ordered.length === 0) {
    return (
      <EmptyState
        title="No events"
        description="Application events will appear here after the next Argo CD sync stores them."
      />
    );
  }

  return (
    <ol className="space-y-3">
      {ordered.map((row) => {
        const warning = isWarning(row);
        const source = eventSource(row);
        return (
          <li
            key={row.id}
            className={`rounded-lg border px-4 py-3 ${
              warning
                ? "border-amber-400/30 bg-amber-400/5"
                : "border-white/8 bg-white/[0.02]"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={warning ? "warning" : "neutral"}>{warning ? "Warning" : "Normal"}</Badge>
              <Badge tone="info">{row.type}</Badge>
              <span className="text-xs text-zinc-500">{formatDateTime(row.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-zinc-200">{row.message}</p>
            {source ? (
              <p className="mt-2 text-xs text-zinc-500">Source: {source}</p>
            ) : null}
            {hasMetadata(row.metadata) ? (
              <pre className="mt-2 overflow-x-auto rounded-md bg-black/30 p-2 font-mono text-xs text-zinc-400">
                {JSON.stringify(row.metadata, null, 2)}
              </pre>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function isWarning(row: ApplicationEvent): boolean {
  const text = `${row.type} ${row.message}`.toLowerCase();
  if (text.includes("imagepullbackoff")) return true;
  if (text.includes("crashloopbackoff")) return true;
  if (text.includes("failedscheduling")) return true;
  if (text.includes("sync") && (text.includes("fail") || text.includes("error"))) return true;
  return text.includes("warning") || text.includes("fail") || text.includes("error") || text.includes("degraded");
}

function eventSource(row: ApplicationEvent): string | null {
  if (typeof row.source === "string" && row.source.trim()) return row.source.trim();
  if (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)) {
    const source = (row.metadata as Record<string, unknown>).source;
    if (typeof source === "string" && source.trim()) return source.trim();
  }
  return null;
}

function hasMetadata(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}
