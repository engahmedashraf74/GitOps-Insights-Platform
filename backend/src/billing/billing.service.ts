import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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

    const organization = await this.organizations.ensureForUser(userId);
    const entitlements = entitlementsFor(organization);
    const usage = await this.getUsage(userId);
    const status = displayStatus(
      user.subscriptionStatus,
      entitlements.isPro,
      organization.subscriptionExpiresAt,
    );

    return {
      plan: entitlements.isPro ? 'pro' : (user.subscriptionPlan ?? 'free'),
      status,
      subscriptionId: user.stripeSubscriptionId,
      customerId: user.stripeCustomerId,
      renewalDate: organization.subscriptionExpiresAt,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      isPro: entitlements.isPro,
      usage,
      entitlements: {
        fullAnalytics: entitlements.fullAnalytics,
        fullHistory: entitlements.fullHistory,
        aiFeatures: entitlements.aiFeatures,
        maxApplications: entitlements.maxApplications,
        maxArgocdIntegrations: entitlements.maxArgocdIntegrations,
        historyDays: entitlements.historyDays,
      },
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
      plan: entitlements.isPro ? 'pro' : 'free',
      status: organization.subscriptionStatus,
    };
  }

  async assertCanSyncApplications(userId: number, incomingCount: number) {
    const organization = await this.organizations.ensureForUser(userId);
    if (isProPlan(organization)) return incomingCount;
    return Math.min(incomingCount, FREE_MAX_APPLICATIONS);
  }

  async createCheckoutSession(
    userId: number,
    email: string,
    promotionCode?: string,
  ) {
    const stripe = this.requireStripe();
    const priceId = process.env.STRIPE_PRICE_ID_PRO?.trim();
    if (!priceId) {
      throw new ServiceUnavailableException(
        'STRIPE_PRICE_ID_PRO is not configured.',
      );
    }

    const frontendUrl = this.frontendUrl();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const promotion = promotionCode
      ? await this.resolvePromotionCode(stripe, promotionCode)
      : null;

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
      ...(promotion
        ? { discounts: [{ promotion_code: promotion.id }] }
        : { allow_promotion_codes: true }),
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

  async createPortalSession(userId: number) {
    const stripe = this.requireStripe();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: String(userId) },
      });
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.frontendUrl()}/billing`,
    });

    return { portalUrl: session.url };
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
      cancelAtPeriodEnd: false,
    });
    return this.getSubscription(userId);
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

    let expiresAt: Date | null = null;
    let status = 'active';
    const subId = subscriptionId(session.subscription);
    if (subId && this.stripe) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(subId);
        expiresAt = periodEnd(subscription);
        status = mapStripeStatus(subscription.status);
      } catch (error) {
        this.logger.warn(
          `Could not retrieve subscription ${subId} after checkout: ${String(error)}`,
        );
      }
    }

    await this.applySubscriptionState({
      userId,
      stripeCustomerId: customerId(session.customer),
      stripeSubscriptionId: subId,
      subscriptionPlan: 'pro',
      subscriptionStatus: status,
      expiresAt,
      cancelAtPeriodEnd: false,
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

    const expiresAt = periodEnd(subscription);
    const stillCovered = Boolean(expiresAt && expiresAt.getTime() > Date.now());
    const entitled =
      isEntitledStatus(subscription.status) ||
      (subscription.status === 'canceled' && stillCovered);

    await this.applySubscriptionState({
      userId,
      stripeCustomerId: customerId(subscription.customer),
      stripeSubscriptionId: subscription.id,
      subscriptionPlan: entitled ? 'pro' : 'free',
      subscriptionStatus: mapLifecycleStatus(subscription.status, stillCovered),
      expiresAt,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
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
      cancelAtPeriodEnd: false,
    });
  }

  private async resolvePromotionCode(stripe: Stripe, code: string) {
    const trimmed = code.trim();
    const result = await stripe.promotionCodes.list({
      code: trimmed,
      active: true,
      limit: 1,
    });
    const promotion = result.data[0];
    if (!promotion) {
      throw new BadRequestException(
        `Promotion code "${trimmed}" is invalid or expired.`,
      );
    }
    return promotion;
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
    cancelAtPeriodEnd?: boolean;
  }) {
    const userUpdate: {
      subscriptionPlan: string;
      subscriptionStatus: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string | null;
      cancelAtPeriodEnd?: boolean;
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
    if (input.cancelAtPeriodEnd !== undefined) {
      userUpdate.cancelAtPeriodEnd = input.cancelAtPeriodEnd;
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
        subscriptionExpiresAt:
          input.expiresAt === undefined ? undefined : input.expiresAt,
        ...(input.stripeCustomerId
          ? { stripeCustomerId: input.stripeCustomerId }
          : {}),
      },
    });
  }

  private frontendUrl(): string {
    return (
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      'http://localhost:3001'
    ).replace(/\/$/, '');
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
  if (status === 'canceled') return 'canceled';
  if (status === 'unpaid' || status === 'incomplete_expired') return 'expired';
  return 'active';
}

function mapLifecycleStatus(
  status: Stripe.Subscription.Status,
  stillCovered: boolean,
): string {
  if (status === 'canceled' && stillCovered) return 'canceled';
  if (status === 'canceled' && !stillCovered) return 'expired';
  return mapStripeStatus(status);
}

function orgStatus(status: string, pro: boolean): SubscriptionStatus {
  if (status === 'trialing') return SubscriptionStatus.trialing;
  if (status === 'past_due') return SubscriptionStatus.past_due;
  if (status === 'canceled') return SubscriptionStatus.canceled;
  if (!pro) return SubscriptionStatus.inactive;
  return SubscriptionStatus.active;
}

function periodEnd(subscription: Stripe.Subscription): Date | null {
  const fromItem = subscription.items.data[0]?.current_period_end;
  const fromSub = (subscription as Stripe.Subscription & {
    current_period_end?: number;
  }).current_period_end;
  const end = fromItem ?? fromSub;
  return typeof end === 'number' ? new Date(end * 1000) : null;
}

function displayStatus(
  stored: string | null | undefined,
  isPro: boolean,
  expiresAt: Date | null,
): string {
  if (expiresAt && expiresAt.getTime() < Date.now() && !isPro) {
    return stored === 'trialing' ? 'expired' : stored === 'canceled' ? 'expired' : (stored ?? 'inactive');
  }
  if (isPro) {
    return stored && stored !== 'free' ? stored : 'active';
  }
  return stored ?? 'free';
}
