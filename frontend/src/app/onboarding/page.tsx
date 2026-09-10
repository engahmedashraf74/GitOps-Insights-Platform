"use client";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { useAuthGuard } from "@/hooks/use-auth-guard";

export default function OnboardingPage() {
  const ready = useAuthGuard();
  if (!ready) return null;
  return <OnboardingWizard />;
}
