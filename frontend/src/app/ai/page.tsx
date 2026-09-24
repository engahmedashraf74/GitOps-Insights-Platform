"use client";

import { DeploymentIntelligencePanel } from "@/components/ai/deployment-intelligence-panel";
import { DeploymentTimeline } from "@/components/deployments/deployment-table";
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
import { getDeployments } from "@/services/deployments";
import type { Deployment } from "@/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AiAnalysisPage() {
  const ready = useAuthGuard();
  const { snapshot, applications } = useWorkspace(ready);
  const isPro = Boolean(snapshot?.subscription?.isPro);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [result, setResult] = useState<DeploymentAnalysis | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPro || applications.length === 0) return;
    setApplicationId((current) => current ?? applications[0].id);
  }, [applications, isPro]);

  useEffect(() => {
    if (!ready || !isPro || applicationId == null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void analyzeDeployment(applicationId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult(null);
        if (err instanceof ApiError && err.status === 403) {
          setError("AI Deployment Analysis requires Pro.");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load AI analysis.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, isPro, ready]);

  useEffect(() => {
    if (!ready || !isPro || applicationId == null) return;
    let cancelled = false;
    void getDeployments(applicationId)
      .then((rows) => {
        if (!cancelled) setDeployments(rows);
      })
      .catch(() => {
        if (!cancelled) setDeployments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, isPro, ready]);

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="AI Deployment Analysis"
        description="Scores and recommendations from stored deployments and application events."
      />
      {isPro ? (
        <div className="space-y-6">
          <label className="block max-w-md text-sm text-zinc-400">
            Application
            <select
              className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm text-zinc-100"
              value={applicationId ?? ""}
              onChange={(event) => setApplicationId(Number(event.target.value))}
              disabled={applications.length === 0}
            >
              {applications.length === 0 ? (
                <option value="">No applications</option>
              ) : (
                applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.name}
                  </option>
                ))
              )}
            </select>
          </label>
          {loading ? <p className="text-sm text-zinc-300">Analyzing deployment...</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {!loading && !error && result ? (
            <DeploymentIntelligencePanel result={result} />
          ) : null}
          {applicationId != null ? (
            <section className="rounded-xl border border-white/8 p-5">
              <h2 className="mb-4 text-sm font-medium">Deployment timeline</h2>
              {deployments.length === 0 ? (
                <p className="text-sm text-zinc-500">No deployment history is stored.</p>
              ) : (
                <DeploymentTimeline rows={deployments} />
              )}
            </section>
          ) : null}
          {!loading && !error && !result && applications.length === 0 ? (
            <p className="text-sm text-zinc-300">No applications found.</p>
          ) : null}
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
