import { apiFetch } from "./api";

export interface PlanUsage {
  applications: number;
  applicationLimit: number;
  argocdIntegrations: number;
  argocdIntegrationLimit: number;
  plan?: string;
  status?: string;
}

export interface SubscriptionState {
  plan: string;
  status: string;
  subscriptionId: string | null;
  customerId: string | null;
  renewalDate: string | null;
  cancelAtPeriodEnd: boolean;
  isPro: boolean;
  usage: PlanUsage;
  entitlements: {
    fullAnalytics: boolean;
    fullHistory: boolean;
    aiFeatures: boolean;
    maxApplications: number;
    maxArgocdIntegrations: number;
    historyDays: number | null;
  };
}

export async function getSubscription(): Promise<SubscriptionState> {
  return apiFetch<SubscriptionState>("/billing/subscription");
}

export async function getUsage(): Promise<PlanUsage> {
  return apiFetch<PlanUsage>("/billing/usage");
}

export async function createCheckout(
  promotionCode?: string,
): Promise<{ checkoutUrl: string }> {
  const body: { promotionCode?: string } = {};
  if (promotionCode?.trim()) {
    body.promotionCode = promotionCode.trim();
  }
  return apiFetch("/billing/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createPortalSession(): Promise<{ portalUrl: string }> {
  return apiFetch("/billing/portal", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export interface DeploymentAnalysis {
  applicationId: number;
  healthStatus: string;
  syncStatus: string;
  rootCause: string;
  recommendedFix: string;
  confidence: number;
  deploymentCount: number;
  successRate: number;
  failedDeploymentCount: number;
  lastDeploymentAt: string | null;
  riskScore: number;
  stabilityScore: number;
  recommendations: string[];
}

export async function getAiAnalysis(): Promise<{
  enabled: boolean;
  insights: unknown[];
  message: string;
}> {
  return apiFetch("/billing/ai/analyze");
}

export async function analyzeDeployment(
  applicationId: number,
): Promise<DeploymentAnalysis> {
  return apiFetch(
    `/billing/ai/analyze?applicationId=${encodeURIComponent(String(applicationId))}`,
  );
}

export async function activateStubPro() {
  return apiFetch("/billing/stub/activate-pro", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function isProSubscription(subscription: Pick<SubscriptionState, "isPro" | "plan" | "status">) {
  if (typeof subscription.isPro === "boolean") {
    return subscription.isPro;
  }
  const entitled =
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due" ||
    subscription.status === "canceled";
  return subscription.plan === "pro" && entitled;
}
