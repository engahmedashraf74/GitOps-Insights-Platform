import {
  SubscriptionPlan,
  SubscriptionStatus,
  type Organization,
} from '@prisma/client';

export const FREE_MAX_APPLICATIONS = 3;
export const FREE_MAX_ARGOCD_INTEGRATIONS = 1;
export const FREE_HISTORY_DAYS = 7;
export const PRO_MONTHLY_PRICE_USD = 10;

/** Every authenticated workspace gets the full product. Checkout stays closed. */
export const PUBLIC_LAUNCH = true;
export const PAYMENTS_ENABLED = false;

export const SUPPORTED_PROMO_CODES = ['BETA100', 'STUDENT50', 'LAUNCH50'] as const;

export function isProPlan(organization: Pick<
  Organization,
  'subscriptionPlan' | 'subscriptionStatus' | 'subscriptionExpiresAt'
>): boolean {
  if (organization.subscriptionPlan !== SubscriptionPlan.PRO) {
    return false;
  }

  const expiresAt = organization.subscriptionExpiresAt;
  const expired = Boolean(expiresAt && expiresAt.getTime() < Date.now());
  if (expired) {
    return false;
  }

  const status = organization.subscriptionStatus;
  if (
    status === SubscriptionStatus.active ||
    status === SubscriptionStatus.trialing ||
    status === SubscriptionStatus.past_due
  ) {
    return true;
  }

  // Canceled but still inside the paid period.
  if (status === SubscriptionStatus.canceled && expiresAt) {
    return true;
  }

  return false;
}

export function maxApplications(
  organization: Organization | null | undefined,
): number {
  if (PUBLIC_LAUNCH) return -1;
  if (!organization) return FREE_MAX_APPLICATIONS;
  return isProPlan(organization) ? -1 : FREE_MAX_APPLICATIONS;
}

export function historySince(organization: Organization): Date | null {
  if (PUBLIC_LAUNCH || isProPlan(organization)) return null;
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
  const open = PUBLIC_LAUNCH || pro;
  return {
    plan: organization.subscriptionPlan,
    status: organization.subscriptionStatus,
    expiresAt: organization.subscriptionExpiresAt,
    isPro: pro,
    maxApplications: open ? -1 : FREE_MAX_APPLICATIONS,
    maxArgocdIntegrations: open ? -1 : FREE_MAX_ARGOCD_INTEGRATIONS,
    historyDays: open ? null : FREE_HISTORY_DAYS,
    fullAnalytics: open,
    fullHistory: open,
    aiFeatures: open,
  };
}
