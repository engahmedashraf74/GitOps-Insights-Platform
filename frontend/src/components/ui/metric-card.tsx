import { Card } from "./card";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  hint,
  trend,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: { value: string; positive?: boolean } | null;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </p>
        {icon ? <div className="text-zinc-500">{icon}</div> : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {trend ? (
          <span
            className={cn(
              trend.positive === false ? "text-rose-300" : "text-emerald-300",
            )}
          >
            {trend.value}
          </span>
        ) : null}
        {hint ? <span className="text-zinc-500">{hint}</span> : null}
      </div>
    </Card>
  );
}
