import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, desc } from 'drizzle-orm';
import Stripe from 'stripe';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { subscriptions, transactions, users } from '../../database/schema';
import { CreateCheckoutDto, BillingInterval, UpdateSubscriptionDto } from './dto';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {
    this.stripe = new Stripe(
      this.configService.getOrThrow<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2026-02-25.clover' },
    );
  }

  async createCheckout(userId: string, dto: CreateCheckoutDto): Promise<{ url: string }> {
    // Prevent duplicate active subscriptions (allow if already set to cancel)
    const [existing] = await this.db
      .select({ id: subscriptions.id, status: subscriptions.status, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (existing && ['active', 'trialing'].includes(existing.status) && !existing.cancelAtPeriodEnd) {
      throw new ConflictException('SUBSCRIPTION_ALREADY_ACTIVE');
    }

    const [user] = await this.db
      .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    const pricing = await this.settingsService.getPricingConfig();
    const priceId = dto.interval === BillingInterval.ANNUAL
      ? pricing.stripePriceIdAnnual
      : pricing.stripePriceIdMonthly;

    const trialDays = pricing.trialDays;
    const publicBaseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:3001');

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: { userId },
      },
      metadata: { userId },
      success_url: dto.successUrl ?? `${publicBaseUrl}/subscription?success=true`,
      cancel_url: dto.cancelUrl ?? `${publicBaseUrl}/subscription?canceled=true`,
    });

    if (!session.url) {
      throw new BadRequestException('Failed to create Stripe checkout session');
    }

    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await this.onInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  async getSubscription(userId: string) {
    const [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!sub) {
      return { tier: 'free', status: 'none', subscription: null };
    }

    return { tier: sub.tier, status: sub.status, subscription: sub };
  }

  async cancelSubscription(userId: string): Promise<{ message: string }> {
    const [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!sub || !sub.stripeSubscriptionId) {
      throw new NotFoundException('SUBSCRIPTION_NOT_FOUND');
    }

    if (!['active', 'trialing'].includes(sub.status)) {
      throw new BadRequestException('Subscription is not active');
    }

    // Cancel at period end so the user keeps access until their billing period ends
    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await this.db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));

    return { message: 'Subscription will be cancelled at the end of the current billing period.' };
  }

  async updateSubscription(userId: string, dto: UpdateSubscriptionDto): Promise<{ message: string }> {
    const [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!sub || !sub.stripeSubscriptionId) {
      throw new NotFoundException('SUBSCRIPTION_NOT_FOUND');
    }

    if (!['active', 'trialing'].includes(sub.status)) {
      throw new BadRequestException('Subscription is not active');
    }

    const pricing = await this.settingsService.getPricingConfig();
    const priceId = dto.interval === 'annual'
      ? pricing.stripePriceIdAnnual
      : pricing.stripePriceIdMonthly;

    const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0]?.id;

    if (!itemId) {
      throw new BadRequestException('SUBSCRIPTION_ITEM_NOT_FOUND');
    }

    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
    });

    return { message: 'Subscription updated' };
  }

  async createBillingPortalSession(userId: string): Promise<{ url: string }> {
    const [sub] = await this.db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!sub?.stripeCustomerId) {
      throw new NotFoundException('SUBSCRIPTION_NOT_FOUND');
    }

    const publicBaseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:3001');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${publicBaseUrl}/dashboard/subscription`,
    });

    return { url: session.url };
  }

  async getInvoices(userId: string) {
    return this.db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  // ------- Webhook handlers -------

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId) {
      this.logger.warn('checkout.session.completed missing userId in metadata');
      return;
    }

    const stripeSubscriptionId = session.subscription as string;
    if (!stripeSubscriptionId) return;

    const stripeSub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
    await this.upsertSubscription(userId, stripeSub);
  }

  private async onSubscriptionUpdated(stripeSub: Stripe.Subscription) {
    const userId = stripeSub.metadata?.userId;
    if (!userId) return;
    await this.upsertSubscription(userId, stripeSub);
  }

  private async onSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    const userId = stripeSub.metadata?.userId;
    if (!userId) return;

    await this.db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSub.id));

    // Downgrade user tier
    await this.db
      .update(users)
      .set({ subscriptionTier: 'free', updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  private async onInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    const stripeSubscriptionId = this.getInvoiceSubscriptionId(invoice);
    if (!stripeSubscriptionId) return;

    const [sub] = await this.db
      .select({ id: subscriptions.id, userId: subscriptions.userId })
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);

    if (!sub) return;

    await this.db.insert(transactions).values({
      userId: sub.userId,
      subscriptionId: sub.id,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: null,
      amountCents: invoice.amount_paid,
      currency: invoice.currency,
      status: 'paid',
    }).onConflictDoNothing();
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const stripeSubscriptionId = this.getInvoiceSubscriptionId(invoice);
    if (!stripeSubscriptionId) return;

    const [sub] = await this.db
      .select({ id: subscriptions.id, userId: subscriptions.userId })
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);

    if (!sub) return;

    await this.db.insert(transactions).values({
      userId: sub.userId,
      subscriptionId: sub.id,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: null,
      amountCents: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
    }).onConflictDoNothing();

    this.logger.warn(`Payment failed for subscription ${stripeSubscriptionId}`);
  }

  /**
   * In Stripe API v2026, subscription id moved from invoice.subscription
   * to invoice.parent.subscription_details.subscription
   */
  private getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
    const subDetails = invoice.parent?.subscription_details;
    if (!subDetails) return null;
    const sub = subDetails.subscription;
    if (!sub) return null;
    return typeof sub === 'string' ? sub : sub.id;
  }

  // ------- Helpers -------

  private async upsertSubscription(userId: string, stripeSub: Stripe.Subscription) {
    const priceId = stripeSub.items.data[0]?.price.id;
    const monthlyPriceId = this.configService.get<string>('STRIPE_PRICE_ID_MONTHLY');
    const tier = priceId === monthlyPriceId ? 'basic' : 'premium';

    // In Stripe API v2026, current_period_start/end moved to items.data[0]
    const firstItem = stripeSub.items.data[0];
    const currentPeriodStart = firstItem?.current_period_start
      ? new Date(firstItem.current_period_start * 1000)
      : null;
    const currentPeriodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null;

    const subData = {
      userId,
      tier: tier as 'basic' | 'premium',
      stripeCustomerId: stripeSub.customer as string,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: priceId ?? null,
      status: stripeSub.status,
      trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
      updatedAt: new Date(),
    };

    await this.db
      .insert(subscriptions)
      .values({ ...subData, createdAt: new Date() })
      .onConflictDoUpdate({
        target: subscriptions.stripeSubscriptionId,
        set: subData,
      });

    // Sync tier to users table
    if (['active', 'trialing'].includes(stripeSub.status)) {
      await this.db
        .update(users)
        .set({ subscriptionTier: tier as 'basic' | 'premium', updatedAt: new Date() })
        .where(eq(users.id, userId));
    }
  }
}
