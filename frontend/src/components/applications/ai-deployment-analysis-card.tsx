"use client";

import { Button } from "@/components/ui/button";
import {
  analyzeDeployment,
  type DeploymentAnalysis,
} from "@/services/billing";
import { useState } from "react";

export function AiDeploymentAnalysisCard({
  applicationId,
}: {
  applicationId: number;
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
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-white/8 p-5">
      <h2 className="text-sm font-medium text-zinc-100">AI Deployment Analysis</h2>
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
    </div>
  );
}
