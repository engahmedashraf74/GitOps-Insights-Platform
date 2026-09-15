import { apiFetch } from "./api";

export interface PlanEntitlements {
  organizationId?: number;
  plan: "FREE" | "PRO";
  status: string;
  expiresAt: string | null;
  isPro: boolean;
  maxApplications: number;
  maxArgocdIntegrations: number;
  historyDays: number | null;
  fullAnalytics: boolean;
  fullHistory: boolean;
  aiFeatures: boolean;
  usage: {
    applications: number;
    applicationLimit: number;
    argocdIntegrations: number;
    argocdIntegrationLimit: number;
  };
}

export async function getSubscription(): Promise<PlanEntitlements> {
  return apiFetch<PlanEntitlements>("/billing/subscription");
}

export async function createCheckout(): Promise<{ id: string; url: string; provider: string }> {
  return apiFetch("/billing/checkout", { method: "POST", body: JSON.stringify({}) });
}

export async function activateStubPro() {
  return apiFetch("/billing/stub/activate-pro", { method: "POST", body: JSON.stringify({}) });
}
