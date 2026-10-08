import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentsService } from './payments.service';
import { DRIZZLE } from '../../database/database.module';
import { SettingsService } from '../settings/settings.service';

jest.mock('stripe', () => {
  const subscriptionsList = jest.fn();
  const sessionsList = jest.fn();
  const subscriptionsRetrieve = jest.fn();
  const StripeMock = jest.fn().mockImplementation(() => ({
    subscriptions: {
      list: (...args: unknown[]) => subscriptionsList(...args),
      retrieve: (...args: unknown[]) => subscriptionsRetrieve(...args),
      update: jest.fn(),
    },
    checkout: { sessions: { list: (...args: unknown[]) => sessionsList(...args), create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
    billingPortal: { sessions: { create: jest.fn() } },
  }));
  return Object.assign(StripeMock, {
    __mocks: { subscriptionsList, sessionsList, subscriptionsRetrieve },
  });
});

const { subscriptionsList, sessionsList, subscriptionsRetrieve } = (
  Stripe as unknown as {
    __mocks: {
      subscriptionsList: jest.Mock;
      sessionsList: jest.Mock;
      subscriptionsRetrieve: jest.Mock;
    };
  }
).__mocks;

function stripeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    metadata: { userId: 'user-1' },
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    items: {
      data: [
        {
          price: { id: 'price_month' },
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_000_000,
        },
      ],
    },
    ...overrides,
  };
}

describe('PaymentsService.syncPaidSubscriptions', () => {
  let service: PaymentsService;
  let limit: jest.Mock;
  let insert: jest.Mock;
  let update: jest.Mock;

  beforeEach(async () => {
    subscriptionsList.mockReset();
    sessionsList.mockReset();
    subscriptionsRetrieve.mockReset();

    limit = jest.fn().mockResolvedValue([]);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });

    const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
    insert = jest.fn().mockReturnValue({ values });

    const whereUpdate = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn().mockReturnValue({ where: whereUpdate });
    update = jest.fn().mockReturnValue({ set });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: DRIZZLE, useValue: { select, insert, update } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
              throw new Error(`missing ${key}`);
            },
            get: (_key: string, fallback?: unknown) => fallback,
          },
        },
        { provide: SettingsService, useValue: { getPricingConfig: jest.fn() } },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  it('writes an active Stripe subscription that is missing locally', async () => {
    subscriptionsList.mockResolvedValue({ data: [stripeSub()], has_more: false });
    sessionsList.mockResolvedValue({ data: [], has_more: false });

    const changed = await service.syncPaidSubscriptions();

    expect(changed).toBe(1);
    expect(insert).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  it('skips a subscription that is already stored with the same status', async () => {
    subscriptionsList.mockResolvedValue({ data: [stripeSub()], has_more: false });
    sessionsList.mockResolvedValue({ data: [], has_more: false });
    limit.mockResolvedValue([{ status: 'active', cancelAtPeriodEnd: false }]);

    const changed = await service.syncPaidSubscriptions();

    expect(changed).toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it('backfills userId from a completed checkout session', async () => {
    subscriptionsList.mockResolvedValue({ data: [], has_more: false });
    sessionsList.mockResolvedValue({
      data: [
        {
          id: 'cs_1',
          mode: 'subscription',
          metadata: { userId: 'user-2' },
          subscription: 'sub_2',
        },
      ],
      has_more: false,
    });
    subscriptionsRetrieve.mockResolvedValue(
      stripeSub({ id: 'sub_2', metadata: {}, status: 'trialing' }),
    );
    limit.mockResolvedValue([]);

    const changed = await service.syncPaidSubscriptions();

    expect(subscriptionsRetrieve).toHaveBeenCalledWith('sub_2');
    expect(changed).toBe(1);
    expect(insert).toHaveBeenCalled();
  });
});
