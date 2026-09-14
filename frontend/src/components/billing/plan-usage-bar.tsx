import Link from "next/link";

export function PlanUsageBar({
  applications,
  applicationLimit,
  isPro,
}: {
  applications: number;
  applicationLimit: number;
  isPro: boolean;
}) {
  const unlimited = applicationLimit < 0;
  const percent = unlimited
    ? 12
    : Math.min(100, (applications / Math.max(applicationLimit, 1)) * 100);

  return (
    <div className="rounded-xl border border-white/8 bg-[#111113]/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            {isPro ? "Pro plan" : "Free plan"}
          </p>
          <p className="mt-1 text-sm text-zinc-200">
            {unlimited
              ? `${applications} applications`
              : `${applications} / ${applicationLimit} applications`}
          </p>
        </div>
        {isPro ? null : (
          <Link href="/upgrade" className="text-sm text-teal-300">
            Upgrade to Pro
          </Link>
        )}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-teal-400" style={{ width: `${percent}%` }} />
      </div>
      {isPro ? null : (
        <p className="mt-2 text-xs text-zinc-500">
          Free includes 3 applications, 1 Argo CD integration, and 7 days of
          history.
        </p>
      )}
    </div>
  );
}
