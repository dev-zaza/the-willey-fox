'use client';

import { useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import jsQR from 'jsqr';
import { publicQr, type QrCode } from '@/lib/api';
import { extractQrCode } from '@/lib/qr-utils';
import { QrCameraScanner } from '@/components/qr/qr-camera-scanner';

const CATEGORIES = ['pet', 'bag', 'key', 'person', 'vehicle', 'other', 'medical', 'place'] as const;

interface LinkBoughtTagSheetProps {
  onClose: () => void;
  onLinked: (tag: QrCode) => void;
  familyId?: string | null;
}

export function LinkBoughtTagSheet({ onClose, onLinked, familyId }: LinkBoughtTagSheetProps) {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('other');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function applyScannedCode(raw: string) {
    const parsed = extractQrCode(raw) ?? raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!parsed) {
      setError('Could not read a Wiley Fox code from that QR.');
      return;
    }
    setCode(parsed);
    setError('');
    setScanning(false);
    void (async () => {
      setSaving(true);
      try {
        const info = await publicQr.get(parsed);
        if (info.status !== 'unclaimed') {
          setError('This code is already linked to a profile.');
          return;
        }
        setCode(info.uniqueCode ?? parsed);
        setStep(2);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('QR_NOT_FOUND') || msg.toLowerCase().includes('not found')) {
          setError('Tag code not found. Check the printed code and try again.');
        } else {
          setError('Could not reach the server. Try again in a moment.');
        }
      } finally {
        setSaving(false);
      }
    })();
  }

  async function handleImageUpload(file: File | null) {
    if (!file) return;
    setDecoding(true);
    setError('');
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not read image');
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (!result?.data) {
        setError('No QR found in that image. Try a clearer photo or enter the code.');
        return;
      }
      applyScannedCode(result.data);
    } catch {
      setError('Could not read that image. Try another photo or enter the code.');
    } finally {
      setDecoding(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function continueFromCode() {
    const parsed = extractQrCode(code) ?? code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!parsed) {
      setError('Enter the code, or scan / upload the QR image.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const info = await publicQr.get(parsed);
      if (info.status !== 'unclaimed') {
        setError('This code is already linked to a profile.');
        return;
      }
      setCode(info.uniqueCode ?? parsed);
      setStep(2);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('QR_NOT_FOUND') || msg.toLowerCase().includes('not found')) {
        setError('Tag code not found. Check the printed code and try again.');
      } else {
        setError('Could not reach the server. Try again in a moment.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function linkTag() {
    setSaving(true);
    setError('');
    try {
      const created = await publicQr.activate({
        code: code.trim(),
        name: name.trim() || 'New tag',
        category,
        ...(familyId ? { familyId } : {}),
      });
      onLinked(created);
      setStep(3);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not link this tag';
      if (msg.includes('QR_ALREADY_CLAIMED') || msg.toLowerCase().includes('already been claimed')) {
        setError('This code is already linked to a profile.');
      } else if (msg.includes('QR_NOT_FOUND') || msg.toLowerCase().includes('not found')) {
        setError('Tag code not found. Check the printed code and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-lg rounded-2xl border border-[#E3D8C6] bg-white p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold tracking-wider text-[#8A7B67]">
                {step} · {step === 1 ? 'SCAN' : step === 2 ? 'ASSIGN' : 'DONE'}
              </p>
              <h3 className="mt-1 text-lg font-extrabold">Quick-add a bought tag</h3>
            </div>
            <button type="button" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          {step === 1 ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-[#5C5245]">
                Physical tags from the shop are unlimited on free. Scan, upload a photo, or type the code.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E3D8C6] bg-[#FBF7F1] px-3 py-2 text-sm font-bold"
                >
                  <Camera className="h-4 w-4" />
                  Scan
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={decoding}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E3D8C6] bg-[#FBF7F1] px-3 py-2 text-sm font-bold disabled:opacity-50"
                >
                  <ImagePlus className="h-4 w-4" />
                  {decoding ? 'Reading…' : 'Upload image'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void handleImageUpload(e.target.files?.[0] ?? null)}
                />
              </div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. DNYL4XZ6"
                className="w-full rounded-xl border border-[#E3D8C6] px-3 py-2 text-sm uppercase"
              />
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
              <button
                type="button"
                onClick={() => void continueFromCode()}
                disabled={saving}
                className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? 'Checking…' : 'Continue'}
              </button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold text-[#8A7B67]">Code {code}</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. School bag"
                className="w-full rounded-xl border border-[#E3D8C6] px-3 py-2 text-sm"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
                className="w-full rounded-xl border border-[#E3D8C6] px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void linkTag()}
                  disabled={saving}
                  className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white"
                >
                  {saving ? 'Linking…' : 'Link tag'}
                </button>
                <button type="button" onClick={() => setStep(1)} className="rounded-xl border px-4 py-2 text-sm">
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-[#5C5245]">Tag linked to your account.</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-[#17130F] px-4 py-2 text-sm font-bold text-white"
              >
                Done
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {scanning ? (
        <QrCameraScanner onScan={(scanned) => applyScannedCode(scanned)} onClose={() => setScanning(false)} />
      ) : null}
    </>
  );
}
