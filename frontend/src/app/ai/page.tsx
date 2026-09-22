"use client";

import { UpgradeBadge } from "@/components/billing/plan-badges";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  analyzeDeployment,
  type DeploymentAnalysis,
} from "@/services/billing";
import { ApiError } from "@/services/api";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AiAnalysisPage() {
  const ready = useAuthGuard();
  const { snapshot } = useWorkspace(ready);

  const isPro = Boolean(snapshot?.subscription?.isPro);

  const [result, setResult] = useState<DeploymentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || !isPro) return;

    const applicationId = snapshot?.applications?.[0]?.id;

    if (!applicationId) {
      setError("No applications found.");
      return;
    }

    setLoading(true);

    void analyzeDeployment(applicationId)
      .then((data) => {
        setResult(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("AI Deployment Analysis requires Pro.");
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Could not load AI analysis.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ready, isPro, snapshot]);

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="AI Deployment Analysis"
        description="Pro analyzes deployment failures, sync drift, and delivery risk."
      />

      {isPro ? (
        <div className="rounded-xl border border-white/8 p-6">
          {loading ? (
            <p className="text-sm text-zinc-300">Analyzing deployment...</p>
          ) : error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : result ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm text-zinc-500">Application</h3>
                <p className="text-zinc-100">{result.applicationId}</p>
              </div>

              <div>
                <h3 className="text-sm text-zinc-500">Health Status</h3>
                <p className="text-zinc-100">{result.healthStatus}</p>
              </div>

              <div>
                <h3 className="text-sm text-zinc-500">Sync Status</h3>
                <p className="text-zinc-100">{result.syncStatus}</p>
              </div>

              <div>
                <h3 className="text-sm text-zinc-500">Root Cause</h3>
                <p className="text-zinc-100">{result.rootCause}</p>
              </div>

              <div>
                <h3 className="text-sm text-zinc-500">Recommended Fix</h3>
                <p className="text-zinc-100">{result.recommendedFix}</p>
              </div>

              <div>
                <h3 className="text-sm text-zinc-500">Confidence</h3>
                <p className="text-zinc-100">{result.confidence}%</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-300">No analysis available.</p>
          )}
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