import { cn } from "@/lib/cn";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
  className?: string;
}) {
  const tones = {
    neutral: "bg-white/6 text-zinc-300 border-white/10",
    success: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    warning: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    danger: "bg-rose-400/10 text-rose-300 border-rose-400/20",
    info: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
    accent: "bg-teal-400/10 text-teal-300 border-teal-400/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function HealthBadge({ value }: { value?: string | null }) {
  const health = value || "Unknown";
  const tone =
    health === "Healthy"
      ? "success"
      : health === "Degraded"
        ? "danger"
        : health === "Progressing"
          ? "warning"
          : "neutral";
  return <Badge tone={tone}>{health}</Badge>;
}

export function SyncBadge({ value }: { value?: string | null }) {
  const sync = value || "Unknown";
  const tone =
    sync === "Synced" ? "info" : sync === "OutOfSync" ? "warning" : "neutral";
  return <Badge tone={tone}>{sync}</Badge>;
}

export function StatusBadge({ value }: { value?: string | null }) {
  const status = value || "Unknown";
  const lower = status.toLowerCase();
  const tone =
    lower.includes("success") || lower === "succeeded"
      ? "success"
      : lower.includes("fail")
        ? "danger"
        : lower.includes("progress") || lower.includes("run")
          ? "warning"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}
