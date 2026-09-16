import { ForbiddenException, Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { entitlementsFor, FREE_MAX_APPLICATIONS, isProPlan } from './plan';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {
    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    this.stripe = secret ? new Stripe(secret) : null;
  }

  async getSubscription(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    return {
      plan: user.subscriptionPlan ?? 'free',
      status: user.subscriptionStatus ?? 'free',
      subscriptionId: user.stripeSubscriptionId,
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

  async createCheckoutSession(userId: number, email: string) {
    const stripe = this.requireStripe();
    const priceId = process.env.STRIPE_PRICE_ID_PRO?.trim();
    if (!priceId) {
      throw new ServiceUnavailableException(
        'STRIPE_PRICE_ID_PRO is not configured.',
      );
    }

    const frontendUrl = (
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      'http://localhost:3001'
    ).replace(/\/$/, '');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/subscription/success`,
      cancel_url: `${frontendUrl}/subscription`,
      client_reference_id: String(userId),
      metadata: { userId: String(userId) },
      subscription_data: {
        metadata: { userId: String(userId) },
      },
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: email }),
    });

    if (!session.url) {
      throw new ServiceUnavailableException(
        'Stripe did not return a checkout URL.',
      );
    }

    const organization = await this.organizations.ensureForUser(userId);
    await this.prisma.billingCustomer.upsert({
      where: { organizationId: organization.id },
      update: { stripeCustomerId: user.stripeCustomerId },
      create: {
        organizationId: organization.id,
        stripeCustomerId: user.stripeCustomerId,
      },
    });
    await this.prisma.billingCheckoutSession.create({
      data: {
        organizationId: organization.id,
        userId,
        provider: 'stripe',
        providerRef: session.id,
        plan: SubscriptionPlan.PRO,
        status: session.status ?? 'created',
        url: session.url,
      },
    });

    return { checkoutUrl: session.url };
  }

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    const stripe = this.requireStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'STRIPE_WEBHOOK_SECRET is not configured.',
      );
    }
    if (!rawBody?.length || !signature) {
      throw new BadRequestException('Missing Stripe webhook payload or signature.');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      this.logger.warn(`Stripe signature verification failed: ${String(error)}`);
      throw new BadRequestException('Invalid Stripe webhook signature.');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object);
        break;
      default:
        this.logger.debug(`Ignored Stripe event ${event.type}`);
    }

    return { received: true };
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
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    await this.applySubscriptionState({
      userId,
      subscriptionPlan: 'pro',
      subscriptionStatus: 'active',
      expiresAt: expires,
    });
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = await this.resolveUserId({
      userId: session.client_reference_id ?? session.metadata?.userId,
      customerId: customerId(session.customer),
      subscriptionId: subscriptionId(session.subscription),
    });
    if (userId == null) {
      this.logger.error(
        `checkout.session.completed has no matching user (session ${session.id})`,
      );
      return;
    }

    await this.applySubscriptionState({
      userId,
      stripeCustomerId: customerId(session.customer),
      stripeSubscriptionId: subscriptionId(session.subscription),
      subscriptionPlan: 'pro',
      subscriptionStatus: 'active',
    });
  }

  private async onSubscriptionUpdated(subscription: Stripe.Subscription) {
    const userId = await this.resolveUserId({
      userId: subscription.metadata?.userId,
      customerId: customerId(subscription.customer),
      subscriptionId: subscription.id,
    });
    if (userId == null) {
      this.logger.error(
        `customer.subscription.updated has no matching user (${subscription.id})`,
      );
      return;
    }

    const entitled = isEntitledStatus(subscription.status);
    await this.applySubscriptionState({
      userId,
      stripeCustomerId: customerId(subscription.customer),
      stripeSubscriptionId: subscription.id,
      subscriptionPlan: entitled ? 'pro' : 'free',
      subscriptionStatus: entitled ? mapStripeStatus(subscription.status) : 'inactive',
      expiresAt: periodEnd(subscription),
    });
  }

  private async onSubscriptionDeleted(subscription: Stripe.Subscription) {
    const userId = await this.resolveUserId({
      userId: subscription.metadata?.userId,
      customerId: customerId(subscription.customer),
      subscriptionId: subscription.id,
    });
    if (userId == null) {
      this.logger.error(
        `customer.subscription.deleted has no matching user (${subscription.id})`,
      );
      return;
    }

    await this.applySubscriptionState({
      userId,
      stripeCustomerId: customerId(subscription.customer),
      stripeSubscriptionId: null,
      subscriptionPlan: 'free',
      subscriptionStatus: 'inactive',
      expiresAt: null,
    });
  }

  private async resolveUserId(refs: {
    userId?: string | null;
    customerId?: string | null;
    subscriptionId?: string | null;
  }): Promise<number | null> {
    const parsed = Number.parseInt(refs.userId ?? '', 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }

    if (refs.subscriptionId) {
      const bySub = await this.prisma.user.findFirst({
        where: { stripeSubscriptionId: refs.subscriptionId },
        select: { id: true },
      });
      if (bySub) return bySub.id;
    }

    if (refs.customerId) {
      const byCustomer = await this.prisma.user.findFirst({
        where: { stripeCustomerId: refs.customerId },
        select: { id: true },
      });
      if (byCustomer) return byCustomer.id;
    }

    return null;
  }

  private async applySubscriptionState(input: {
    userId: number;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionPlan: string;
    subscriptionStatus: string;
    expiresAt?: Date | null;
  }) {
    const userUpdate: {
      subscriptionPlan: string;
      subscriptionStatus: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string | null;
    } = {
      subscriptionPlan: input.subscriptionPlan,
      subscriptionStatus: input.subscriptionStatus,
    };
    if (input.stripeCustomerId) {
      userUpdate.stripeCustomerId = input.stripeCustomerId;
    }
    if (input.stripeSubscriptionId !== undefined) {
      userUpdate.stripeSubscriptionId = input.stripeSubscriptionId;
    }

    await this.prisma.user.update({
      where: { id: input.userId },
      data: userUpdate,
    });

    const organization = await this.organizations.ensureForUser(input.userId);
    const pro = input.subscriptionPlan === 'pro';
    await this.prisma.organization.update({
      where: { id: organization.id },
      data: {
        subscriptionPlan: pro ? SubscriptionPlan.PRO : SubscriptionPlan.FREE,
        subscriptionStatus: orgStatus(input.subscriptionStatus, pro),
        subscriptionExpiresAt: input.expiresAt ?? undefined,
        ...(input.stripeCustomerId
          ? { stripeCustomerId: input.stripeCustomerId }
          : {}),
      },
    });
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'STRIPE_SECRET_KEY is not configured.',
      );
    }
    return this.stripe;
  }
}

function customerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

function subscriptionId(
  subscription: string | Stripe.Subscription | null,
): string | null {
  if (!subscription) return null;
  return typeof subscription === 'string' ? subscription : subscription.id;
}

function isEntitledStatus(status: Stripe.Subscription.Status): boolean {
  return (
    status === 'active' || status === 'trialing' || status === 'past_due'
  );
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due') return 'past_due';
  return 'active';
}

function orgStatus(
  status: string,
  pro: boolean,
): SubscriptionStatus {
  if (!pro) return SubscriptionStatus.inactive;
  if (status === 'trialing') return SubscriptionStatus.trialing;
  if (status === 'past_due') return SubscriptionStatus.past_due;
  if (status === 'canceled') return SubscriptionStatus.canceled;
  return SubscriptionStatus.active;
}

function periodEnd(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items.data[0];
  const end = item?.current_period_end;
  return typeof end === 'number' ? new Date(end * 1000) : null;
}
