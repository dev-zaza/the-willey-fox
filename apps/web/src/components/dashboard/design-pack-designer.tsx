'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOURS = ['#E0380D', '#F4C430', '#0F766E', '#1D4ED8', '#17130F', '#FFFFFF'];
const ICONS = ['🦊', '⭐', '⚽', '🐱', '🌸', '🚀'];
const FONTS = [
  { id: 'round', label: 'Rounded' },
  { id: 'classic', label: 'Classic' },
  { id: 'simple', label: 'Simple' },
] as const;

export function DesignPackDesigner({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<'qr' | 'plain'>('qr');
  const [name, setName] = useState('Zoe');
  const [colour, setColour] = useState(COLOURS[0]);
  const [icon, setIcon] = useState(ICONS[0]);
  const [font, setFont] = useState<(typeof FONTS)[number]['id']>('round');
  const [sticker, setSticker] = useState(52);
  const [mini, setMini] = useState(24);
  const [shoe, setShoe] = useState(8);
  const [ice, setIce] = useState({ name: true, contacts: true, allergies: false, note: false });
  const [created, setCreated] = useState(false);

  const summary = useMemo(() => {
    const parts = [];
    if (sticker) parts.push(`${sticker} stick-on`);
    if (mini) parts.push(`${mini} mini`);
    if (shoe) parts.push(`${shoe} shoe`);
    return `${kind === 'qr' ? 'Wiley Fox QR pack' : 'Plain name pack'} for ${name || '—'} · ${parts.join(', ')}`;
  }, [kind, name, sticker, mini, shoe]);

  function createPack() {
    try {
      const packs = JSON.parse(localStorage.getItem('wf_label_packs') || '[]') as unknown[];
      packs.unshift({ name, kind, colour, icon, font, sticker, mini, shoe, ice, createdAt: new Date().toISOString() });
      localStorage.setItem('wf_label_packs', JSON.stringify(packs.slice(0, 20)));
    } catch {
      /* ignore */
    }
    setCreated(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl border border-[#E3D8C6] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#E3D8C6] px-5 py-4">
          <div>
            <p className="text-[11px] font-extrabold tracking-wider text-[#8A7B67]">NAME LABELS</p>
            <h3 className="text-lg font-extrabold">Design a pack</h3>
            <p className="text-xs text-[#8A7B67]">Type a name, pick a look, choose what&apos;s in the pack.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            <Fieldset k="Pack type">
              <Seg
                options={[
                  { id: 'qr', label: 'Wiley Fox QR pack' },
                  { id: 'plain', label: 'Plain name pack' },
                ]}
                value={kind}
                onChange={setKind}
              />
            </Fieldset>
            <Fieldset k="Name on the label">
              <input
                maxLength={14}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[#E3D8C6] px-3 py-2 text-lg font-extrabold"
              />
            </Fieldset>
            <Fieldset k="Colour">
              <div className="flex flex-wrap gap-2">
                {COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColour(c)}
                    className={cn('h-8 w-8 rounded-full border-2', colour === c ? 'border-[#17130F]' : 'border-transparent')}
                    style={{ background: c, boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px #ddd' : undefined }}
                    aria-label={c}
                  />
                ))}
              </div>
            </Fieldset>
            <Fieldset k="Icon">
              <div className="flex flex-wrap gap-2">
                {ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={cn('h-10 w-10 rounded-xl border text-lg', icon === i ? 'border-[#17130F] bg-[#F1E7D8]' : 'border-[#E3D8C6]')}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </Fieldset>
            <Fieldset k="Lettering">
              <Seg
                options={FONTS.map((f) => ({ id: f.id, label: f.label }))}
                value={font}
                onChange={setFont}
              />
            </Fieldset>
            <Fieldset k="What's in the pack">
              <Qty label="Stick-on name stickers" sub="Lunchboxes, bottles, books" value={sticker} onChange={setSticker} />
              <Qty label="Mini stickers" sub="Pens, rulers, small things" value={mini} onChange={setMini} />
              <Qty label="Shoe labels" sub="Sized for insoles" value={shoe} onChange={setShoe} />
            </Fieldset>
            {kind === 'qr' ? (
              <Fieldset k="What a scan shows on these labels">
                {(
                  [
                    ['name', 'Name and age'],
                    ['contacts', 'Emergency contacts (relayed)'],
                    ['allergies', 'Allergies'],
                    ['note', 'Guardian note'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={ice[key]}
                      onChange={(e) => setIce((prev) => ({ ...prev, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </Fieldset>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#8A7B67]">Live preview</p>
            <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 rounded-2xl border border-[#E3D8C6] bg-[#FBF7F1] p-4">
              <div
                className="flex h-16 w-40 items-center justify-center gap-2 rounded-xl border-2 shadow-sm"
                style={{
                  background: colour === '#FFFFFF' ? '#fff' : colour,
                  color: colour === '#F4C430' || colour === '#FFFFFF' ? '#17130F' : '#fff',
                  fontFamily: font === 'classic' ? 'Georgia, serif' : 'inherit',
                  letterSpacing: font === 'simple' ? '0.08em' : undefined,
                }}
              >
                <span>{icon}</span>
                <span className="text-lg font-extrabold uppercase">{name || 'NAME'}</span>
              </div>
              {kind === 'qr' ? <span className="text-[10px] font-bold text-[#8A7B67]">QR on every label</span> : null}
            </div>
            <p className="mt-3 text-[12.5px] leading-5 text-[#5C5245]">
              <b className="text-[#17130F]">{summary}</b>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E3D8C6] px-5 py-3">
          <p className="mr-auto text-xs text-[#8A7B67]">
            {created ? 'Pack saved in this browser. Store opens soon — pricing follows the print partner.' : 'Store opens soon — pricing follows the print partner.'}
          </p>
          <button type="button" onClick={onClose} className="rounded-xl border px-3 py-2 text-sm font-bold">
            Cancel
          </button>
          <button type="button" onClick={createPack} className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-bold text-white">
            Create pack
          </button>
        </div>
      </div>
    </div>
  );
}

function Fieldset({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-extrabold tracking-wider text-[#8A7B67]">{k.toUpperCase()}</p>
      {children}
    </div>
  );
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-bold',
            value === o.id ? 'bg-[#17130F] text-white' : 'bg-[#F1E7D8] text-[#5C5245]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Qty({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl border border-[#E3D8C6] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[11px] text-[#8A7B67]">{sub}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="h-7 w-7 rounded-lg border" onClick={() => onChange(Math.max(0, value - 1))}>
          −
        </button>
        <b className="w-8 text-center text-sm">{value}</b>
        <button type="button" className="h-7 w-7 rounded-lg border" onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}
