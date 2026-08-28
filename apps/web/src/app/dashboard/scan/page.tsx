'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Camera, ScanLine } from 'lucide-react';
import { QrCameraScanner } from '@/components/qr/qr-camera-scanner';

export default function ScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleScan(code: string) {
    setScanning(false);
    router.push(`/q/${code}`);
  }

  return (
    <div className="min-h-screen bg-[#f0e7d6]" style={{ color: '#1b1410' }}>
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-10">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-sm font-medium"
            style={{ color: '#7a6957' }}
          >
            ← Back to dashboard
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div
            className="mb-6 flex h-24 w-24 items-center justify-center rounded-full"
            style={{ background: 'rgba(234,46,0,0.12)' }}
          >
            <ScanLine className="h-10 w-10" style={{ color: '#ea2e00' }} />
          </div>
          <h1 className="text-2xl font-bold">Scan a Wileyfox Tag</h1>
          <p className="mt-3 max-w-sm text-sm leading-6" style={{ color: '#5a4a3d' }}>
            Found a lost item with a QR tag? Scan it to view details and notify the owner instantly.
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="button"
            onClick={() => {
              setError(null);
              if (!navigator.mediaDevices?.getUserMedia) {
                setError('Camera scanning is not supported in this browser.');
                return;
              }
              setScanning(true);
            }}
            className="mt-8 flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold text-white"
            style={{ background: '#ea2e00' }}
          >
            <Camera className="h-5 w-5" />
            Open Camera
          </button>
        </div>
      </div>

      {scanning && (
        <QrCameraScanner
          onScan={handleScan}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}
