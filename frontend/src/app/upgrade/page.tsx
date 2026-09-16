"use client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useToast } from "@/components/ui/toast";
import { activateStubPro, createCheckout } from "@/services/billing";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function UpgradeInner() {
  const ready = useAuthGuard();
  const router = useRouter();
  const params = useSearchParams();
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const checkout = params.get("checkout");

  if (!ready) return null;

  async function startCheckout() {
    setLoading(true);
    try {
      const session = await createCheckout();
      if (session.checkoutUrl) {
        window.location.assign(session.checkoutUrl);
        return;
      }
      push("Checkout session created.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Checkout failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function simulate() {
    setLoading(true);
    try {
      const result = await activateStubPro();
      if (result && typeof result === "object" && "ok" in result && result.ok === false) {
        push("Stripe is not configured for production yet.", "info");
        return;
      }
      push("Pro plan activated for this beta workspace.", "success");
      router.replace("/subscription");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not activate Pro.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Upgrade to Pro"
        description="Unlimited applications, full history, full analytics, and future AI insights."
      />
      {checkout ? (
        <p className="mb-4 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400">
          Checkout session {checkout} is ready. Stripe keys are not wired in Public Beta v1.
        </p>
      ) : null}
      <div className="rounded-2xl border border-white/8 p-6">
        <ul className="space-y-2 text-sm text-zinc-300">
          <li>Unlimited Argo CD applications and projects</li>
          <li>Full deployment history</li>
          <li>Full workspace analytics</li>
          <li>AI features flagged on for the Pro entitlement</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button loading={loading} onClick={() => void startCheckout()}>
            Continue to checkout
          </Button>
          <Button variant="secondary" loading={loading} onClick={() => void simulate()}>
            Activate Pro (beta stub)
          </Button>
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          Checkout uses Stripe subscription mode. Set STRIPE_SECRET_KEY and
          STRIPE_PRICE_ID_PRO on the API to enable live upgrades.
        </p>
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradeInner />
    </Suspense>
  );
}
