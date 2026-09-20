"use client";

import { PricingSection } from "@/components/billing/pricing-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [promo, setPromo] = useState("");
  const checkout = params.get("checkout");

  if (!ready) return null;

  async function startCheckout() {
    setLoading(true);
    try {
      const session = await createCheckout(promo);
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
      router.replace("/billing");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not activate Pro.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Upgrade to Pro"
        description="Unlimited applications, full history, advanced analytics, and AI Deployment Analysis — $10/month."
      />
      {checkout ? (
        <p className="mb-4 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400">
          Checkout session {checkout} is ready.
        </p>
      ) : null}
      <PricingSection ctaHref="/upgrade" highlightPro />
      <div className="mt-8 rounded-2xl border border-white/8 p-6">
        <label className="text-sm text-zinc-300" htmlFor="promo">
          Promo code
        </label>
        <Input
          id="promo"
          className="mt-2 max-w-sm"
          placeholder="BETA100, STUDENT50, or LAUNCH50"
          value={promo}
          onChange={(event) => setPromo(event.target.value.toUpperCase())}
        />
        <p className="mt-2 text-xs text-zinc-500">
          Codes are applied in Stripe Checkout. BETA100 is 100% off, STUDENT50
          and LAUNCH50 are 50% off when those promotion codes exist in Stripe.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button loading={loading} onClick={() => void startCheckout()}>
            Continue to checkout
          </Button>
          <Button variant="secondary" loading={loading} onClick={() => void simulate()}>
            Activate Pro (beta stub)
          </Button>
        </div>
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
