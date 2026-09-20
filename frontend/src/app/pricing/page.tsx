import { PricingSection } from "@/components/billing/pricing-section";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.18em] text-teal-300">Public Beta</p>
      <h1 className="mt-3 text-4xl font-semibold">Simple pricing for GitOps teams</h1>
      <p className="mt-3 max-w-2xl text-sm text-zinc-400">
        Start free. Upgrade to Pro for unlimited history, advanced analytics, and
        AI Deployment Analysis. Promo codes BETA100, STUDENT50, and LAUNCH50 are
        supported at checkout.
      </p>
      <div className="mt-10">
        <PricingSection ctaHref="/register" />
      </div>
      <p className="mt-10 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-teal-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
