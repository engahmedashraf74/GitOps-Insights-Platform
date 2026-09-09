import Link from "next/link";
import { landingPreviewApps } from "@/mock/demo-data";
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
              href="#preview"
              className="rounded-lg border border-white/12 px-5 py-3 text-sm text-zinc-200"
            >
              View demo
            </a>
          </div>
        </div>
        <div
          id="preview"
          className="rounded-2xl border border-white/10 bg-[#111113]/80 p-4 shadow-2xl"
        >
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
        <h2 className="text-2xl font-semibold">The GitOps gap</h2>
        <p className="mt-3 max-w-3xl text-sm text-zinc-400">
          Platform teams can ship through Git, but still lack a shared view of
          what is healthy, drifting, or failing across environments. Cluster
          consoles are powerful, but they are not a product surface for
          engineering managers or on-call owners.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Core features</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-white/8 bg-white/[0.02] p-5"
            >
              <h3 className="text-sm font-medium text-zinc-100">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-3">
        {[
          {
            step: "01",
            title: "Connect your workspace",
            body: "Create a project and register the applications you already manage with GitOps.",
          },
          {
            step: "02",
            title: "Ingest deployment state",
            body: "Record revisions, environments, sync, and health as deployments happen.",
          },
          {
            step: "03",
            title: "Operate from one view",
            body: "Use overview, history, and analytics instead of reconstructing status from logs.",
          },
        ].map((item) => (
          <div key={item.step} className="rounded-xl border border-white/8 p-5">
            <p className="text-xs text-teal-300">{item.step}</p>
            <h3 className="mt-2 text-lg font-medium">{item.title}</h3>
            <p className="mt-2 text-sm text-zinc-400">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Deployment analytics</h2>
        <p className="mt-3 max-w-3xl text-sm text-zinc-400">
          Frequency, success rate, and failure volume are first-class views.
          The product is built for operational truth, not vanity charts.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-semibold">GitOps / Argo CD integration</h2>
        <p className="mt-3 max-w-3xl text-sm text-zinc-400">
          Argo CD is the primary integration. Connection is workspace-scoped
          so credentials never live in the client as a global secret. Additional
          source-control and alerting integrations are staged for later releases.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Security and reliability</h2>
        <p className="mt-3 max-w-3xl text-sm text-zinc-400">
          Authentication uses your account token. Integration secrets are treated
          as sensitive and are not shipped in frontend source. The interface is
          designed for production operators who need a calm, accurate picture of
          delivery health.
        </p>
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
          <p>Deployment health for GitOps teams.</p>
        </div>
      </footer>
    </div>
  );
}
