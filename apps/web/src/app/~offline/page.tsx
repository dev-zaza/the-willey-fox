'use client';

export default function OfflinePage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: '#f0e7d6', color: '#1b1410' }}
    >
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl"
        style={{ background: 'rgba(234,46,0,0.12)' }}
      >
        📡
      </div>
      <h1 className="text-xl font-bold">You&apos;re offline</h1>
      <p className="mt-3 max-w-sm text-sm leading-6" style={{ color: '#5a4a3d' }}>
        TheWileyfox needs an internet connection for live maps, alerts, and messaging. Cached pages
        may still be available — reconnect to sync.
      </p>
      <OfflineRetryButton />
    </div>
  );
}

function OfflineRetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-8 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
      style={{ background: '#ea2e00' }}
    >
      Try again
    </button>
  );
}
