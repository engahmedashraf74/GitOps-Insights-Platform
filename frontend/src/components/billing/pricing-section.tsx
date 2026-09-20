import Link from "next/link";
import { Check } from "lucide-react";

const freeFeatures = [
  "Up to 3 applications",
  "1 Argo CD integration",
  "7 days of deployment history",
];

const proFeatures = [
  "Unlimited applications",
  "Unlimited deployment history",
  "Advanced analytics",
  "AI Deployment Analysis",
  "Priority support",
];

export function PricingSection({
  ctaHref = "/register",
  highlightPro = true,
}: {
  ctaHref?: string;
  highlightPro?: boolean;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <article className="rounded-2xl border border-white/10 bg-[#111113]/80 p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Free</p>
        <h3 className="mt-2 text-2xl font-semibold">Public Beta</h3>
        <p className="mt-1 text-3xl font-semibold">
          $0<span className="text-base font-normal text-zinc-500">/month</span>
        </p>
        <ul className="mt-6 space-y-2">
          {freeFeatures.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-zinc-300">
              <Check size={16} className="mt-0.5 text-zinc-500" />
              {item}
            </li>
          ))}
        </ul>
        <Link
          href={ctaHref === "/upgrade" ? "/dashboard" : ctaHref}
          className="mt-8 inline-flex h-11 items-center rounded-lg border border-white/12 px-4 text-sm text-zinc-200"
        >
          Continue on Free
        </Link>
      </article>
      <article
        className={`rounded-2xl border p-6 ${
          highlightPro
            ? "border-teal-400/30 bg-teal-400/5"
            : "border-white/10 bg-[#111113]/80"
        }`}
      >
        <p className="text-xs uppercase tracking-[0.18em] text-teal-300">Pro</p>
        <h3 className="mt-2 text-2xl font-semibold">GitOps Insights Pro</h3>
        <p className="mt-1 text-3xl font-semibold">
          $10<span className="text-base font-normal text-zinc-500">/month</span>
        </p>
        <ul className="mt-6 space-y-2">
          {proFeatures.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-zinc-200">
              <Check size={16} className="mt-0.5 text-teal-300" />
              {item}
            </li>
          ))}
        </ul>
        <Link
          href={ctaHref}
          className="mt-8 inline-flex h-11 items-center rounded-lg bg-teal-400 px-4 text-sm font-medium text-zinc-950"
        >
          Upgrade to Pro
        </Link>
      </article>
    </div>
  );
}
