import { Button } from "./button";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-teal-300">{icon}</div> : null}
      <h3 className="text-base font-medium text-zinc-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-zinc-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Unable to load this view",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-6">
      <h3 className="text-sm font-medium text-rose-200">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{message}</p>
      {onRetry ? (
        <Button className="mt-4" size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
