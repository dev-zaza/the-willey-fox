import { Suspense } from 'react';
import { OAuthCallbackClient } from './oauth-callback-client';

function OAuthCallbackFallback() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[#7a6957] text-sm">Loading…</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<OAuthCallbackFallback />}>
      <OAuthCallbackClient />
    </Suspense>
  );
}
