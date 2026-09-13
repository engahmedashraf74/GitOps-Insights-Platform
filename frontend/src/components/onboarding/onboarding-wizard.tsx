"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { completeOnboarding, getOnboardingState, saveOnboardingState } from "@/lib/onboarding";
import { saveWorkspace, getWorkspace } from "@/lib/settings";
import { connectArgoCd } from "@/services/integrations";
import { Plug, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState(getWorkspace().name);
  const [argoUrl, setArgoUrl] = useState("");
  const [argoToken, setArgoToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const steps = [
    {
      title: "Name your workspace",
      body: "A local label for this GitOps Insights workspace.",
      icon: <Workflow size={20} />,
    },
    {
      title: "Connect Argo CD",
      body: "Applications are imported from Argo CD. The token is stored encrypted on the server.",
      icon: <Plug size={20} />,
    },
  ];

  async function finish() {
    completeOnboarding();
    router.replace("/dashboard");
  }

  async function next() {
    setError("");
    if (step === 0) {
      if (!workspace.trim()) {
        setError("Enter a workspace name.");
        return;
      }
      saveWorkspace({ name: workspace.trim() });
      saveOnboardingState({
        ...getOnboardingState(),
        workspaceNamed: true,
      });
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!argoUrl.trim() || !argoToken.trim()) {
        setError("Enter the Argo CD URL and token, or skip setup.");
        return;
      }
      try {
        new URL(argoUrl.trim());
      } catch {
        setError("Enter a valid Argo CD URL.");
        return;
      }
      setLoading(true);
      try {
        await connectArgoCd(argoUrl.trim(), argoToken.trim());
        saveOnboardingState({
          ...getOnboardingState(),
          integrationReviewed: true,
        });
        await finish();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not connect to Argo CD.");
        setLoading(false);
      }
    }
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <p className="text-xs uppercase tracking-[0.2em] text-teal-300">
        Getting started
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Observe Argo CD
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Connect Argo CD to import applications. This platform does not create apps or repos.
      </p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-[#111113]/80 p-6">
        <div className="mb-6 flex gap-2">
          {steps.map((item, index) => (
            <div
              key={item.title}
              className={`h-1 flex-1 rounded-full ${index <= step ? "bg-teal-400" : "bg-white/10"}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 text-teal-300">
          {steps[step].icon}
          <h2 className="text-lg font-medium text-zinc-50">{steps[step].title}</h2>
        </div>
        <p className="mt-2 text-sm text-zinc-400">{steps[step].body}</p>
        {error ? (
          <p className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
        <div className="mt-6 space-y-3">
          {step === 0 ? (
            <Input
              value={workspace}
              onChange={(event) => setWorkspace(event.target.value)}
              placeholder="Platform engineering"
            />
          ) : null}
          {step === 1 ? (
            <>
              <Input
                value={argoUrl}
                onChange={(event) => setArgoUrl(event.target.value)}
                placeholder="https://argocd.example.com"
              />
              <PasswordInput
                id="onboarding-argo-token"
                label="Token"
                value={argoToken}
                onChange={(event) => setArgoToken(event.target.value)}
                autoComplete="off"
              />
            </>
          ) : null}
        </div>
        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={() => void finish()}>
            Skip setup
          </Button>
          <Button onClick={() => void next()} loading={loading}>
            {step === 1 ? "Connect and import" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
