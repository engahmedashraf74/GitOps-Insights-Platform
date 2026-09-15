import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import {
  CheckoutSessionService,
  type CreateCheckoutInput,
} from './checkout-session.service';
import { entitlementsFor, FREE_MAX_APPLICATIONS, isProPlan } from './plan';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly checkout: CheckoutSessionService,
  ) {}

  async getSubscription(userId: number) {
    const organization = await this.organizations.ensureForUser(userId);
    const usage = await this.getUsage(userId);
    return {
      organizationId: organization.id,
      ...entitlementsFor(organization),
      usage,
    };
  }

  async getUsage(userId: number) {
    const organization = await this.organizations.ensureForUser(userId);
    const [applications, integrations] = await Promise.all([
      this.prisma.application.count({
        where: { project: { organizationId: organization.id } },
      }),
      this.prisma.integration.count({
        where: {
          organizationId: organization.id,
          provider: 'argocd',
          status: 'connected',
        },
      }),
    ]);
    const entitlements = entitlementsFor(organization);
    return {
      applications,
      applicationLimit: entitlements.maxApplications,
      argocdIntegrations: integrations,
      argocdIntegrationLimit: entitlements.maxArgocdIntegrations,
    };
  }

  async assertCanSyncApplications(userId: number, incomingCount: number) {
    const organization = await this.organizations.ensureForUser(userId);
    if (isProPlan(organization)) return incomingCount;
    return Math.min(incomingCount, FREE_MAX_APPLICATIONS);
  }

  async createCheckout(userId: number, input: Omit<CreateCheckoutInput, 'organizationId' | 'userId'>) {
    const organization = await this.organizations.ensureForUser(userId);
    const session = await this.checkout.createSession({
      ...input,
      organizationId: organization.id,
      userId,
    });

    await this.prisma.billingCustomer.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: { organizationId: organization.id },
    });

    await this.prisma.billingCheckoutSession.create({
      data: {
        organizationId: organization.id,
        userId,
        provider: session.provider,
        providerRef: session.id,
        plan: SubscriptionPlan.PRO,
        status: 'created',
        url: session.url,
      },
    });

    return session;
  }

  async requirePro(userId: number) {
    const organization = await this.organizations.ensureForUser(userId);
    if (!isProPlan(organization)) {
      throw new ForbiddenException(
        'This feature requires a Pro plan. Upgrade to unlock full analytics, history, and AI.',
      );
    }
    return organization;
  }

  async markStubUpgrade(userId: number) {
    const organization = await this.organizations.ensureForUser(userId);
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    return this.prisma.organization.update({
      where: { id: organization.id },
      data: {
        subscriptionPlan: SubscriptionPlan.PRO,
        subscriptionStatus: SubscriptionStatus.active,
        subscriptionExpiresAt: expires,
      },
    });
  }
}
