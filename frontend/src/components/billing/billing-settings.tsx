"use client";

import { PlanUsageBar } from "@/components/billing/plan-usage-bar";
import {
  PlanBadge,
  SubscriptionStatusBadge,
  UpgradeBadge,
} from "@/components/billing/plan-badges";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useToast } from "@/components/ui/toast";
import {
  createPortalSession,
  getSubscription,
  isProSubscription,
  type SubscriptionState,
} from "@/services/billing";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BillingSettings() {
  const ready = useAuthGuard();
  const { push } = useToast();
  const [data, setData] = useState<SubscriptionState | null>(null);
  const [error, setError] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    void getSubscription()
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load billing."),
      );
  }, [ready]);

  if (!ready) return null;

  const isPro = data ? isProSubscription(data) : false;

  async function openPortal() {
    setPortalLoading(true);
    try {
      const session = await createPortalSession();
      window.location.assign(session.portalUrl);
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not open billing portal.", "error");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Billing"
        description="Plan, usage, and Stripe subscription for this workspace."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data ? <PlanBadge plan={data.plan} isPro={isPro} /> : null}
            {data ? <SubscriptionStatusBadge status={data.status} /> : null}
            {isPro ? null : <UpgradeBadge />}
          </div>
        }
      />
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
      {data ? (
        <div className="space-y-4">
          <PlanUsageBar
            applications={data.usage.applications}
            applicationLimit={data.usage.applicationLimit}
            isPro={isPro}
            status={data.status}
            plan={data.plan}
          />
          <div className="grid gap-3 rounded-xl border border-white/8 p-5 text-sm sm:grid-cols-2">
            <Field label="Current plan" value={isPro ? "Pro" : "Free"} />
            <Field label="Subscription status" value={data.status} />
            <Field
              label={data.cancelAtPeriodEnd ? "Access through" : "Renewal date"}
              value={formatDate(data.renewalDate)}
            />
            <Field label="Customer ID" value={data.customerId ?? "—"} />
            <Field
              label="Subscription ID"
              value={data.subscriptionId ?? "—"}
              wide
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {isPro ? (
              <Button loading={portalLoading} onClick={() => void openPortal()}>
                Manage Subscription
              </Button>
            ) : (
              <Link href="/upgrade">
                <Button>Upgrade to Pro</Button>
              </Link>
            )}
            {isPro ? (
              <Button
                variant="secondary"
                loading={portalLoading}
                onClick={() => void openPortal()}
              >
                Update payment method
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 break-all text-zinc-200">{value}</p>
    </div>
  );
}
