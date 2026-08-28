'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X } from 'lucide-react';
import { extractQrCode } from '@/lib/qr-utils';

interface QrCameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function QrCameraScanner({ onScan, onClose }: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const handleDetected = useCallback(
    (raw: string) => {
      const code = extractQrCode(raw);
      if (!code) return;
      stopCamera();
      onScan(code);
    },
    [onScan, stopCamera],
  );

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        const tick = () => {
          const canvas = canvasRef.current;
          if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (result?.data) {
            handleDetected(result.data);
            return;
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        setStarting(false);
      } catch {
        setError('Camera access is required to scan QR tags. Check browser permissions and try again.');
        setStarting(false);
      }
    }

    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [handleDetected, stopCamera]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute inset-0 flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 safe-top">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white"
          >
            Cancel
          </button>
          <span className="text-sm font-semibold text-white">Scan QR Tag</span>
          <div className="w-16" />
        </div>

        <div className="flex flex-1 items-center justify-center px-8">
          <div
            className="relative h-60 w-60 rounded-2xl border-2 border-brand-500"
            style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
          />
        </div>

        <div className="px-6 pb-8 text-center safe-bottom">
          {error ? (
            <div className="mx-auto max-w-sm rounded-2xl bg-[#fffdf8] p-4 text-left" style={{ color: '#1b1410' }}>
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Camera className="h-4 w-4 text-[#ea2e00]" />
                Camera unavailable
              </div>
              <p className="text-sm" style={{ color: '#5a4a3d' }}>
                {error}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: '#ea2e00' }}
              >
                Close
              </button>
            </div>
          ) : (
            <p className="text-sm text-white/80">
              {starting ? 'Starting camera…' : 'Hold steady over the Wileyfox QR tag'}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          stopCamera();
          onClose();
        }}
        className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white"
        aria-label="Close scanner"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
