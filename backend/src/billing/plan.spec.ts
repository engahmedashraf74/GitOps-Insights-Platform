import { SubscriptionPlan, SubscriptionStatus, type Organization } from '@prisma/client';
import { entitlementsFor, historySince, maxApplications, PAYMENTS_ENABLED, PUBLIC_LAUNCH } from './plan';

function organization(plan: SubscriptionPlan = SubscriptionPlan.FREE): Organization {
  return {
    subscriptionPlan: plan,
    subscriptionStatus: SubscriptionStatus.inactive,
    subscriptionExpiresAt: null,
  } as Organization;
}

describe('public launch entitlements', () => {
  it('gives a free workspace the full product and leaves checkout closed', () => {
    const entitlements = entitlementsFor(organization());
    expect(PUBLIC_LAUNCH).toBe(true);
    expect(PAYMENTS_ENABLED).toBe(false);
    expect(entitlements.isPro).toBe(false);
    expect(entitlements.aiFeatures).toBe(true);
    expect(entitlements.fullAnalytics).toBe(true);
    expect(entitlements.fullHistory).toBe(true);
    expect(entitlements.maxApplications).toBe(-1);
    expect(entitlements.maxArgocdIntegrations).toBe(-1);
    expect(entitlements.historyDays).toBeNull();
    expect(maxApplications(organization())).toBe(-1);
    expect(maxApplications(null)).toBe(-1);
    expect(historySince(organization())).toBeNull();
  });
});
