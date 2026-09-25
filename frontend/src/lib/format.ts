export function formatDateTime(value?: string | Date | null): string {
  if (!value) {
    return "—";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: browserTimeZone(),
    timeZoneName: "short",
  }).format(date);
}

export function formatLocalDate(value?: string | Date | null): string {
  const date = parseTimestamp(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: browserTimeZone(),
  }).format(date);
}

export function formatLocalTime(value?: string | Date | null): string {
  const date = parseTimestamp(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: browserTimeZone(),
    timeZoneName: "short",
  }).format(date);
}

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function parseTimestamp(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRelative(value?: string | Date | null): string {
  if (!value) {
    return "No activity";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "No activity";
  }

  const delta = Date.now() - date.getTime();
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(date);
}

export function shortRevision(revision?: string | null): string {
  if (!revision) return "—";
  return revision.length > 12 ? `${revision.slice(0, 8)}…` : revision;
}

export function toNumber(value: number | string | undefined | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function percentLabel(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 10) / 10}%`;
}
