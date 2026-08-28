'use client';

import { useCallback, useEffect, useState } from 'react';
import { notifications as notificationsApi } from '@/lib/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useWebPush() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(ok);

    if (!ok) {
      setLoading(false);
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setSubscribed(Boolean(subscription)))
      .catch(() => setSubscribed(false))
      .finally(() => setLoading(false));
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const { publicKey, enabled } = await notificationsApi.getWebPushPublicKey();
    if (!enabled || !publicKey) {
      throw new Error('Web push is not configured on the server');
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      throw new Error('Invalid push subscription');
    }

    await notificationsApi.subscribeWebPush({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      userAgent: navigator.userAgent,
    });

    setSubscribed(true);
    return true;
  }, [supported]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      setSubscribed(false);
      return;
    }

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await notificationsApi.unsubscribeWebPush({ endpoint });
    setSubscribed(false);
  }, [supported]);

  return {
    supported,
    subscribed,
    loading,
    subscribe,
    unsubscribe,
  };
}
