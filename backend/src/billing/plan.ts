import {
  SubscriptionPlan,
  SubscriptionStatus,
  type Organization,
} from '@prisma/client';

export const FREE_MAX_APPLICATIONS = 3;
export const FREE_MAX_ARGOCD_INTEGRATIONS = 1;
export const FREE_HISTORY_DAYS = 7;

export function isProPlan(organization: Pick<
  Organization,
  'subscriptionPlan' | 'subscriptionStatus' | 'subscriptionExpiresAt'
>): boolean {
  if (organization.subscriptionPlan !== SubscriptionPlan.PRO) {
    return false;
  }
  if (
    organization.subscriptionStatus !== SubscriptionStatus.active &&
    organization.subscriptionStatus !== SubscriptionStatus.trialing
  ) {
    return false;
  }
  if (
    organization.subscriptionExpiresAt &&
    organization.subscriptionExpiresAt.getTime() < Date.now()
  ) {
    return false;
  }
  return true;
}

export function maxApplications(
  organization: Organization | null | undefined,
): number {
  if (!organization) return FREE_MAX_APPLICATIONS;
  return isProPlan(organization) ? -1 : FREE_MAX_APPLICATIONS;
}

export function historySince(organization: Organization): Date | null {
  if (isProPlan(organization)) return null;
  const since = new Date();
  since.setDate(since.getDate() - FREE_HISTORY_DAYS);
  return since;
}

export interface PlanEntitlements {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  expiresAt: Date | null;
  isPro: boolean;
  maxApplications: number;
  maxArgocdIntegrations: number;
  historyDays: number | null;
  fullAnalytics: boolean;
  fullHistory: boolean;
  aiFeatures: boolean;
}

export function entitlementsFor(organization: Organization): PlanEntitlements {
  const pro = isProPlan(organization);
  return {
    plan: organization.subscriptionPlan,
    status: organization.subscriptionStatus,
    expiresAt: organization.subscriptionExpiresAt,
    isPro: pro,
    maxApplications: pro ? -1 : FREE_MAX_APPLICATIONS,
    maxArgocdIntegrations: pro ? -1 : FREE_MAX_ARGOCD_INTEGRATIONS,
    historyDays: pro ? null : FREE_HISTORY_DAYS,
    fullAnalytics: pro,
    fullHistory: pro,
    aiFeatures: pro,
  };
}
