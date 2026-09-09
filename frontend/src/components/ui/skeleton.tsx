import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-white/6",
        className,
      )}
    />
  );
}

export function MetricSkeleton() {
  return (
    <div className="rounded-xl border border-white/8 bg-[#111113] p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-16" />
      <Skeleton className="mt-3 h-3 w-36" />
    </div>
  );
}
