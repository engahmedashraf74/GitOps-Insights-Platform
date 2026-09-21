"use client";

import { Badge } from "@/components/ui/status-badge";

export function PlanBadge({
  plan,
  isPro,
}: {
  plan?: string;
  isPro?: boolean;
}) {
  if (isPro || plan === "pro") {
    return <Badge tone="accent">Current Plan · Pro</Badge>;
  }
  return <Badge tone="neutral">Current Plan · Free</Badge>;
}

export function SubscriptionStatusBadge({ status }: { status?: string | null }) {
  const value = (status ?? "free").toLowerCase();
  if (value === "trialing" || value === "trial") {
    return <Badge tone="info">Trial</Badge>;
  }
  if (value === "active") {
    return <Badge tone="success">Active Subscription</Badge>;
  }
  if (value === "past_due") {
    return <Badge tone="warning">Past due</Badge>;
  }
  if (value === "canceled") {
    return <Badge tone="warning">Cancels at period end</Badge>;
  }
  if (value === "expired" || value === "inactive") {
    return <Badge tone="danger">Expired</Badge>;
  }
  return <Badge tone="neutral">Free</Badge>;
}

export function UpgradeBadge() {
  return <Badge tone="accent">Upgrade to Pro</Badge>;
}
