import { apiClient } from './api';

export type BillingInterval = 'monthly' | 'annual';

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId?: string;
  status: string;
  tier: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
}

export const paymentsService = {
  createCheckout: async (interval: BillingInterval): Promise<CheckoutResult> => {
    const { data } = await apiClient.post<{ url: string }>('/payments/checkout', {
      interval,
      successUrl: 'thewileyfox://subscription?success=true',
      cancelUrl: 'thewileyfox://subscription?canceled=true',
    });
    return { checkoutUrl: data.url };
  },

  getSubscription: async (): Promise<Subscription | null> => {
    try {
      const { data } = await apiClient.get<Subscription>('/payments/subscription');
      return data;
    } catch {
      return null;
    }
  },

  cancelSubscription: async (): Promise<void> => {
    await apiClient.delete('/payments/subscription');
  },

  getBillingPortal: async (): Promise<{ url: string }> => {
    const { data } = await apiClient.post<{ url: string }>('/payments/billing-portal');
    return data;
  },
};
