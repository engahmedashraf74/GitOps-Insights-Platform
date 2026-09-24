import Link from "next/link";
import { landingPreviewApps } from "@/mock/demo-data";
import { PricingSection } from "@/components/billing/pricing-section";
import { HealthBadge, SyncBadge } from "@/components/ui/status-badge";

const features = [
  {
    title: "Deployment visibility",
    body: "See what shipped, where it landed, and whether it stayed healthy.",
  },
  {
    title: "Application health",
    body: "Track Healthy, Progressing, and Degraded states without opening Argo CD for every check.",
  },
  {
    title: "Sync monitoring",
    body: "Know which applications are Synced or OutOfSync before users feel the drift.",
  },
  {
    title: "Deployment history",
    body: "Keep a durable record of revisions, environments, and outcomes.",
  },
  {
    title: "Environment awareness",
    body: "Separate development, staging, and production so incidents are easier to isolate.",
  },
  {
    title: "Reliability insights",
    body: "Success rate, failure volume, and delivery frequency in one operational view.",
  },
];

const reasons = [
  {
    title: "A shared delivery view",
    body: "Platform teams can ship through Git and still lack one picture of what is healthy, drifting, or failing. GitOps Insights is that product surface for engineering managers and on-call owners.",
  },
  {
    title: "Argo CD stays the source of truth",
    body: "Connection is workspace-scoped. The product reads application health, sync, and deployment history from Argo CD instead of asking operators to reconstruct status from the cluster console.",
  },
  {
    title: "Built for operators",
    body: "The interface is a calm, accurate view of delivery health. Integration secrets stay off the client, and the account token is the only credential the browser holds.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400/15 text-sm font-semibold text-teal-300">
            GI
          </span>
          <span className="text-sm font-semibold">GitOps Insights</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/pricing" className="text-zinc-400 hover:text-white">
            Pricing
          </Link>
          <Link href="/login" className="text-zinc-400 hover:text-white">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-teal-400 px-3 py-2 font-medium text-zinc-950"
          >
            Start for free
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-300">
            GitOps operations
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            GitOps visibility, without the guesswork.
          </h1>
          <p className="mt-4 max-w-xl text-base text-zinc-400">
            Track deployment health, sync status, failures, and reliability
            across your GitOps applications.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-teal-400 px-5 py-3 text-sm font-medium text-zinc-950"
            >
              Start for free
            </Link>
            <a
              href="#product"
              className="rounded-lg border border-white/12 px-5 py-3 text-sm text-zinc-200"
            >
              View product
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#111113]/80 p-4 shadow-2xl">
          <div className="mb-4 flex items-center justify-between text-xs text-zinc-500">
            <span>Overview</span>
            <span>Live preview</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["Apps", "Deploys", "Success"].map((label, index) => (
              <div key={label} className="rounded-lg border border-white/8 p-3">
                <p className="text-[11px] text-zinc-500">{label}</p>
                <p className="mt-1 text-lg font-semibold">
                  {["12", "84", "96%"][index]}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {landingPreviewApps.map((app) => (
              <div
                key={app.name}
                className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-zinc-100">{app.name}</p>
                  <p className="text-[11px] text-zinc-500">{app.environment}</p>
                </div>
                <div className="flex gap-2">
                  <HealthBadge value={app.health} />
                  <SyncBadge value={app.sync} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Core features</h2>
        <p className="mt-3 max-w-3xl text-sm text-zinc-400">
          One operational view of health, sync, history, and reliability for
          the applications you already deliver with GitOps.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-white/8 bg-white/[0.02] p-5"
            >
              <h3 className="text-sm font-medium text-zinc-100">{feature.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Product</h2>
        <p className="mt-3 max-w-3xl text-sm text-zinc-400">
          The same surfaces operators use after sign-in: application health,
          deployment history, and sync status.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-[#111113]/80 p-4">
            <p className="text-xs text-zinc-500">Application health</p>
            <div className="mt-4 space-y-2">
              {landingPreviewApps.map((app) => (
                <div
                  key={app.name}
                  className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2"
                >
                  <p className="text-sm text-zinc-100">{app.name}</p>
                  <HealthBadge value={app.health} />
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#111113]/80 p-4">
            <p className="text-xs text-zinc-500">Deployment history</p>
            <div className="mt-4 space-y-2">
              {landingPreviewApps.map((app) => (
                <div
                  key={app.revision}
                  className="rounded-lg border border-white/8 px-3 py-2"
                >
                  <p className="text-sm text-zinc-100">{app.name}</p>
                  <p className="mt-1 font-mono text-[11px] text-zinc-500">
                    {app.revision} · {app.environment}
                  </p>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#111113]/80 p-4">
            <p className="text-xs text-zinc-500">Sync status</p>
            <div className="mt-4 space-y-2">
              {landingPreviewApps.map((app) => (
                <div
                  key={`${app.name}-sync`}
                  className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2"
                >
                  <p className="text-sm text-zinc-100">{app.environment}</p>
                  <SyncBadge value={app.sync} />
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Why GitOps Insights</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="rounded-xl border border-white/8 bg-white/[0.02] p-5"
            >
              <h3 className="text-sm font-medium text-zinc-100">{reason.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{reason.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Pricing</h2>
        <p className="mt-3 max-w-3xl text-sm text-zinc-400">
          Start free for public beta. Pro is $10/month for unlimited history,
          advanced analytics, and AI Deployment Analysis.
        </p>
        <div className="mt-8">
          <PricingSection ctaHref="/register" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold">See delivery health clearly.</h2>
        <p className="mt-3 text-sm text-zinc-400">
          Start with your projects and applications. Expand as the platform grows.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-flex rounded-lg bg-teal-400 px-5 py-3 text-sm font-medium text-zinc-950"
        >
          Start for free
        </Link>
      </section>

      <footer className="border-t border-white/8 px-6 py-8 text-sm text-zinc-500">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>GitOps Insights</p>
          <Link href="/pricing" className="text-zinc-400 hover:text-zinc-200">
            Pricing
          </Link>
          <p>Deployment health for GitOps teams.</p>
        </div>
      </footer>
    </div>
  );
}
