"use client";

import { PlanUsageBar } from "@/components/billing/plan-usage-bar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { getSubscription, type PlanEntitlements } from "@/services/billing";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SubscriptionPage() {
  const ready = useAuthGuard();
  const [data, setData] = useState<PlanEntitlements | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    void getSubscription()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load plan."),
      );
  }, [ready]);

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Subscription"
        description="GitOps Insights Public Beta · Free and Pro plans."
        actions={
          data?.isPro ? null : (
            <Link href="/upgrade">
              <Button>Upgrade to Pro</Button>
            </Link>
          )
        }
      />
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
      {data ? (
        <div className="space-y-4">
          <PlanUsageBar
            applications={data.usage.applications}
            applicationLimit={data.usage.applicationLimit}
            isPro={data.isPro}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/8 p-5">
              <h2 className="text-sm font-medium">Free</h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                <li>Up to 3 applications</li>
                <li>1 Argo CD integration</li>
                <li>7 days of deployment history</li>
              </ul>
            </div>
            <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-5">
              <h2 className="text-sm font-medium text-teal-200">Pro</h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                <li>Unlimited applications and projects</li>
                <li>Full analytics and history</li>
                <li>Future AI features enabled</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
