"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatRelative } from "@/lib/format";
import {
  buildNotifications,
  markNotificationsRead,
} from "@/lib/notifications";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export function NotificationCenter({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { applications, loading } = useWorkspace(open);
  const items = useMemo(
    () => buildNotifications(applications),
    [applications],
  );
  const unread = items.filter((item) => !item.read).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75]">
      <button className="absolute inset-0 bg-black/40" aria-label="Close notifications" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-white/10 bg-[#0c0c0e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Notifications</h2>
            <p className="text-xs text-zinc-500">
              {unread} unread · generated from live deployment state
            </p>
          </div>
          <button
            className="text-xs text-teal-300"
            onClick={() => {
              markNotificationsRead(items.map((item) => item.id));
              onClose();
            }}
          >
            Mark all read
          </button>
        </div>
        <div className="h-[calc(100%-64px)] overflow-y-auto p-3">
          {loading ? (
            <p className="px-3 py-10 text-center text-sm text-zinc-500">
              Checking delivery events…
            </p>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Bell size={22} />}
              title="No operational alerts"
              description="Failure and OutOfSync events will appear here as deployments are recorded."
            />
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    className={`w-full rounded-xl border px-4 py-3 text-left ${
                      item.read
                        ? "border-white/8 bg-transparent"
                        : "border-white/12 bg-white/[0.03]"
                    }`}
                    onClick={() => {
                      markNotificationsRead([item.id]);
                      if (item.href) router.push(item.href);
                      onClose();
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-zinc-100">{item.title}</p>
                      <span className="text-[11px] text-zinc-500">
                        {formatRelative(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{item.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
