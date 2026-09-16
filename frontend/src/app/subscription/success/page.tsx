"use client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import Link from "next/link";

export default function SubscriptionSuccessPage() {
  const ready = useAuthGuard();
  if (!ready) return null;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="You are on Pro"
        description="Stripe Checkout completed. Your workspace unlocks as soon as the subscription webhook is processed."
      />
      <Link href="/subscription">
        <Button>View subscription</Button>
      </Link>
    </div>
  );
}
