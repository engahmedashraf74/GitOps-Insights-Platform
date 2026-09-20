"use client";

import { UpgradeBadge } from "@/components/billing/plan-badges";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { getAiAnalysis } from "@/services/billing";
import { ApiError } from "@/services/api";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AiAnalysisPage() {
  const ready = useAuthGuard();
  const { snapshot } = useWorkspace(ready);
  const isPro = Boolean(snapshot?.subscription?.isPro);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || !isPro) return;
    void getAiAnalysis()
      .then((result) => setMessage(result.message))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("AI Deployment Analysis requires Pro.");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load AI analysis.");
      });
  }, [isPro, ready]);

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="AI Deployment Analysis"
        description="Pro analyzes deployment failures, sync drift, and delivery risk."
      />
      {isPro ? (
        <div className="rounded-xl border border-white/8 p-6 text-sm text-zinc-300">
          {error ? <p className="text-rose-200">{error}</p> : <p>{message || "Loading…"}</p>}
        </div>
      ) : (
        <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-6">
          <UpgradeBadge />
          <p className="mt-3 text-sm text-zinc-300">
            Free workspaces cannot access AI Deployment Analysis. Upgrade to Pro
            for unlimited history and AI insights.
          </p>
          <Link href="/upgrade" className="mt-4 inline-block">
            <Button>Upgrade to Pro</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
