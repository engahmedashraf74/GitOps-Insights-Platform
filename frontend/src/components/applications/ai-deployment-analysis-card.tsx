"use client";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/api";
import {
  analyzeDeployment,
  type DeploymentAnalysis,
} from "@/services/billing";
import Link from "next/link";
import { useState } from "react";

export function AiDeploymentAnalysisCard({
  applicationId,
  isPro,
}: {
  applicationId: number;
  isPro: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DeploymentAnalysis | null>(null);

  async function onAnalyze() {
    setLoading(true);
    setError("");
    try {
      setResult(await analyzeDeployment(applicationId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("AI Analysis is available on Pro plan.");
        return;
      }
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-white/8 p-5">
      <h2 className="text-sm font-medium text-zinc-100">AI Deployment Analysis</h2>
      {isPro ? (
        <>
          <p className="mt-1 text-sm text-zinc-500">
            Uses this application&apos;s health, sync, events, and Argo CD metadata.
          </p>
          <div className="mt-4">
            <Button loading={loading} onClick={() => void onAnalyze()}>
              Analyze Deployment
            </Button>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
          {result ? (
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-zinc-500">Root Cause</dt>
                <dd className="mt-1 text-zinc-100">{result.rootCause}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Recommended Fix</dt>
                <dd className="mt-1 text-zinc-100">{result.recommendedFix}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Confidence</dt>
                <dd className="mt-1 text-zinc-100">{result.confidence}</dd>
              </div>
            </dl>
          ) : null}
        </>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-zinc-300">
            AI Analysis is available on Pro plan.
          </p>
          <Link href="/upgrade" className="mt-3 inline-block">
            <Button>Upgrade</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
