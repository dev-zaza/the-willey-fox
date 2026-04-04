import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { paymentsService, type Subscription } from '@/services/payments.service';

// ─── Plan feature lists ───────────────────────────────────────────────────────

const PLAN_FEATURES: Record<string, string[]> = {
  basic: [
    'Up to 5 QR tags',
    'Community safety pins',
    'Email notifications',
    'Basic guardian access',
  ],
  premium: [
    'Unlimited QR tags',
    'Priority safety alerts',
    'SMS + push notifications',
    'Advanced guardian management',
    'Bulk QR generation',
    'Route safety scoring',
    'Places & reviews access',
  ],
};

const PLAN_PRICES: Record<string, { monthly: string; annual: string }> = {
  basic: { monthly: '$4.99/mo', annual: '$49.99/yr' },
  premium: { monthly: '$9.99/mo', annual: '$99.99/yr' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    free: { bg: 'rgba(100,116,139,0.1)', text: '#64748b', border: 'rgba(100,116,139,0.3)' },
    basic: { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
    premium: { bg: 'rgba(249,115,22,0.1)', text: '#f97316', border: 'rgba(249,115,22,0.3)' },
  };
  const c = colors[tier] ?? colors.free;
  return (
    <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: c.text, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' }}>{tier}</Text>
    </View>
  );
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const dark = useColorScheme() === 'dark';
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const checkoutInProgress = useRef(false);

  const bg = dark ? '#1a1d27' : '#f9fafb';
  const cardBg = dark ? '#1e2235' : '#ffffff';
  const border = dark ? '#2a2f45' : '#e5e7eb';
  const textPrimary = dark ? '#ffffff' : '#111827';
  const textSecondary = dark ? '#94a3b8' : '#6b7280';

  function fetchSubscription() {
    return paymentsService
      .getSubscription()
      .then(setSubscription)
      .catch(() => setSubscription(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchSubscription();
  }, []);

  // Refresh subscription when user returns from Stripe checkout
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && checkoutInProgress.current) {
        checkoutInProgress.current = false;
        fetchSubscription();
      }
    });
    return () => sub.remove();
  }, []);

  const currentTier = subscription?.tier ?? 'free';
  const isPaid = currentTier !== 'free' && ['active', 'trialing'].includes(subscription?.status ?? '');

  async function handleUpgrade(interval: 'monthly' | 'annual') {
    setCheckoutLoading(interval);
    try {
      const { checkoutUrl } = await paymentsService.createCheckout(interval);
      checkoutInProgress.current = true;
      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, 'thewileyfox://subscription');
      if (result.type === 'success' || result.type === 'dismiss') {
        checkoutInProgress.current = false;
        await fetchSubscription();
      }
    } catch (e: any) {
      checkoutInProgress.current = false;
      Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'Could not start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleBillingPortal() {
    setPortalLoading(true);
    try {
      const { url } = await paymentsService.getBillingPortal();
      await WebBrowser.openAuthSessionAsync(url, 'thewileyfox://subscription');
      await fetchSubscription();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'Could not open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  function handleCancel() {
    Alert.alert(
      'Cancel Subscription',
      'Your plan will remain active until the end of the current billing period. Cancel anyway?',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            try {
              await paymentsService.cancelSubscription();
              setSubscription((prev) => prev ? { ...prev, cancelAtPeriodEnd: true } : prev);
              Alert.alert('Cancelled', 'Your subscription will end at the current period.');
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to cancel subscription');
            } finally {
              setCancelLoading(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: cardBg, borderBottomWidth: 1, borderBottomColor: border,
        paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#f97316', fontWeight: '600', fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18, flex: 1 }}>Subscription</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#f97316" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
          {/* Current plan card */}
          <View style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: border, borderRadius: 20, padding: 20, gap: 14 }}>
            <Text style={{ color: textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Current Plan
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TierBadge tier={currentTier} />
              {subscription?.status && (
                <Text style={{
                  color: subscription.status === 'active' ? '#22c55e' : '#f59e0b',
                  fontSize: 12, fontWeight: '600', textTransform: 'capitalize',
                }}>
                  {subscription.status}
                </Text>
              )}
            </View>
            {subscription?.currentPeriodEnd && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: textSecondary, fontSize: 13 }}>
                  {subscription.cancelAtPeriodEnd ? 'Ends on' : 'Renews on'}
                </Text>
                <Text style={{ color: textPrimary, fontSize: 13, fontWeight: '500' }}>
                  {formatDate(subscription.currentPeriodEnd)}
                </Text>
              </View>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <View style={{ backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', borderRadius: 10, padding: 10 }}>
                <Text style={{ color: '#f59e0b', fontSize: 13, textAlign: 'center' }}>
                  Your plan will not renew. You still have access until {formatDate(subscription.currentPeriodEnd)}.
                </Text>
              </View>
            )}
          </View>

          {/* Upgrade cards (shown when free) */}
          {!isPaid && (
            <>
              <Text style={{ color: textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Upgrade Your Plan
              </Text>

              {(['basic', 'premium'] as const).map((tier) => (
                <View
                  key={tier}
                  style={{
                    backgroundColor: cardBg, borderWidth: 1,
                    borderColor: tier === 'premium' ? 'rgba(249,115,22,0.4)' : border,
                    borderRadius: 20, padding: 20, gap: 14,
                  }}
                >
                  {tier === 'premium' && (
                    <View style={{ alignSelf: 'flex-start', backgroundColor: '#f97316', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>MOST POPULAR</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18, textTransform: 'capitalize' }}>{tier}</Text>
                    <Text style={{ color: '#f97316', fontWeight: '700', fontSize: 16 }}>{PLAN_PRICES[tier].monthly}</Text>
                  </View>

                  <View style={{ gap: 6 }}>
                    {PLAN_FEATURES[tier].map((feature) => (
                      <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: '#f97316', fontSize: 14 }}>✓</Text>
                        <Text style={{ color: textSecondary, fontSize: 13 }}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1, backgroundColor: '#f97316', borderRadius: 12,
                        paddingVertical: 12, alignItems: 'center',
                        opacity: checkoutLoading === 'monthly' ? 0.6 : 1,
                      }}
                      onPress={() => handleUpgrade('monthly')}
                      disabled={checkoutLoading !== null}
                    >
                      {checkoutLoading === 'monthly' ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Monthly</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1, backgroundColor: 'rgba(249,115,22,0.15)', borderWidth: 1,
                        borderColor: 'rgba(249,115,22,0.4)', borderRadius: 12,
                        paddingVertical: 12, alignItems: 'center',
                        opacity: checkoutLoading === 'annual' ? 0.6 : 1,
                      }}
                      onPress={() => handleUpgrade('annual')}
                      disabled={checkoutLoading !== null}
                    >
                      {checkoutLoading === 'annual' ? (
                        <ActivityIndicator color="#f97316" size="small" />
                      ) : (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ color: '#f97316', fontWeight: '700', fontSize: 13 }}>Annual</Text>
                          <Text style={{ color: '#f97316', fontSize: 10 }}>Save ~17%</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Paid plan actions */}
          {isPaid && (
            <View style={{ gap: 10 }}>
              {/* Upgrade to Premium (only shown on basic) */}
              {currentTier === 'basic' && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#f97316', borderRadius: 14,
                    paddingVertical: 14, alignItems: 'center',
                    opacity: checkoutLoading !== null ? 0.6 : 1,
                  }}
                  onPress={() => handleUpgrade('monthly')}
                  disabled={checkoutLoading !== null}
                >
                  {checkoutLoading !== null ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Upgrade to Premium</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Manage billing via Stripe portal */}
              <TouchableOpacity
                style={{
                  backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1,
                  borderColor: 'rgba(249,115,22,0.3)', borderRadius: 14,
                  paddingVertical: 14, alignItems: 'center',
                  opacity: portalLoading ? 0.6 : 1,
                }}
                onPress={handleBillingPortal}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <ActivityIndicator color="#f97316" />
                ) : (
                  <Text style={{ color: '#f97316', fontWeight: '600', fontSize: 14 }}>Manage Billing</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Cancel subscription (paid, not already cancelling) */}
          {isPaid && !subscription?.cancelAtPeriodEnd && (
            <TouchableOpacity
              style={{
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 14,
                paddingVertical: 14, alignItems: 'center',
                opacity: cancelLoading ? 0.6 : 1,
              }}
              onPress={handleCancel}
              disabled={cancelLoading}
            >
              {cancelLoading ? (
                <ActivityIndicator color="#ef4444" />
              ) : (
                <Text style={{ color: '#ef4444', fontWeight: '600' }}>Cancel Subscription</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}
