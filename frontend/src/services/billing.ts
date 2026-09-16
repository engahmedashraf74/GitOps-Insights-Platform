import { apiFetch } from "./api";

export interface SubscriptionState {
  plan: string;
  status: string;
  subscriptionId: string | null;
}

export interface PlanUsage {
  applications: number;
  applicationLimit: number;
  argocdIntegrations: number;
  argocdIntegrationLimit: number;
}

export async function getSubscription(): Promise<SubscriptionState> {
  return apiFetch<SubscriptionState>("/billing/subscription");
}

export async function getUsage(): Promise<PlanUsage> {
  return apiFetch<PlanUsage>("/billing/usage");
}

export async function createCheckout(): Promise<{ checkoutUrl: string }> {
  return apiFetch("/billing/checkout", { method: "POST", body: JSON.stringify({}) });
}

export async function activateStubPro() {
  return apiFetch("/billing/stub/activate-pro", { method: "POST", body: JSON.stringify({}) });
}

export function isProSubscription(subscription: Pick<SubscriptionState, "plan" | "status">) {
  const entitled =
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due";
  return subscription.plan === "pro" && entitled;
}
