import type { NotificationItem } from "@/types";
import type { EnrichedApplication } from "@/services/workspace";
import { isFailed } from "./metrics";

const READ_KEY = "goi.notifications.read";

export function buildNotifications(
  applications: EnrichedApplication[],
): NotificationItem[] {
  const derived: NotificationItem[] = applications
    .filter((application) =>
      application.latestDeployment
        ? isFailed(application.latestDeployment)
        : false,
    )
    .slice(0, 8)
    .map((application) => ({
      id: `fail-${application.id}`,
      title: `${application.name} needs attention`,
      body: `${application.latestDeployment?.status || "Failed"} in ${application.latestDeployment?.environment || "an environment"}.`,
      createdAt: application.latestDeployment?.deployedAt ?? new Date().toISOString(),
      href: `/applications/${application.id}`,
      read: false,
      tone: "danger",
      source: "derived",
    }));

  const outOfSync = applications
    .filter(
      (application) =>
        (application.latestDeployment?.syncStatus || "").toLowerCase() ===
        "outofsync",
    )
    .slice(0, 4)
    .map((application) => ({
      id: `sync-${application.id}`,
      title: `${application.name} is OutOfSync`,
      body: "Live state does not match the desired Git revision.",
      createdAt: application.latestDeployment?.deployedAt ?? new Date().toISOString(),
      href: `/applications/${application.id}`,
      read: false,
      tone: "warning" as const,
      source: "derived" as const,
    }));

  const items = [...derived, ...outOfSync];
  const readIds = getReadIds();
  return items.map((item) => ({
    ...item,
    read: readIds.includes(item.id),
  }));
}

export function getReadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function markNotificationsRead(ids: string[]): void {
  const next = Array.from(new Set([...getReadIds(), ...ids]));
  localStorage.setItem(READ_KEY, JSON.stringify(next));
}
