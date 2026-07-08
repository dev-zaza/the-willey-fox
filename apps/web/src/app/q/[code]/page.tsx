'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import ReportForm from '@/components/report-form';

const _rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const API_URL = _rawApiUrl.replace(/\/api\/v\d+\/?$/, '');
const API_BASE = `${API_URL}/api/v1`;

interface QrPublicInfo {
  id: string;
  category: string;
  uniqueCode: string;
  status?: string;
  isLost: boolean;
  name?: string;
  photoUrl?: string;
  description?: string;
  ownerName?: string;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
  theme?: {
    accentColor: string;
    backgroundStyle: string;
    showLogo: boolean;
    logoUrl: string | null;
  };
  customFields?: {
    medicalInfo?: Record<string, string>;
    petInfo?: Record<string, string>;
    [key: string]: unknown;
  };
}

const categoryLabels: Record<string, string> = {
  pet: 'Pet',
  bag: 'Bag / Luggage',
  key: 'Keys',
  person: 'Person',
  vehicle: 'Vehicle',
  other: 'Other Item',
  medical: 'Medical / ID',
  place: 'Place',
};

const categoryEmojis: Record<string, string> = {
  pet: '🐾',
  bag: '🎒',
  key: '🔑',
  person: '👤',
  vehicle: '🚗',
  other: '📦',
  medical: '🏥',
  place: '📍',
};

const QR_CATEGORIES = ['pet', 'bag', 'key', 'person', 'vehicle', 'other', 'medical', 'place'] as const;
type QrCategory = (typeof QR_CATEGORIES)[number];

// Which categories get medical fields
const MEDICAL_CATS: QrCategory[] = ['medical', 'person'];
// Which categories get pet fields
const PET_CATS: QrCategory[] = ['pet'];
// Which categories show return/reward fields
const REWARD_CATS: QrCategory[] = ['pet', 'bag', 'key', 'vehicle', 'other', 'person'];

interface MedicalInfo {
  bloodType: string;
  allergies: string;
  medicalConditions: string;
  medications: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  doctorName: string;
  doctorPhone: string;
  insuranceInfo: string;
  notes: string;
}

interface PetInfo {
  breed: string;
  color: string;
  vetName: string;
  vetPhone: string;
  microchipId: string;
}

interface ClaimForm {
  category: QrCategory;
  name: string;
  description: string;
  ownerContactEmail: string;
  ownerContactPhone: string;
  rewardMessage: string;
  medicalInfo: MedicalInfo;
  petInfo: PetInfo;
}

const emptyMedical: MedicalInfo = {
  bloodType: '', allergies: '', medicalConditions: '', medications: '',
  emergencyContactName: '', emergencyContactPhone: '',
  doctorName: '', doctorPhone: '', insuranceInfo: '', notes: '',
};

const emptyPet: PetInfo = {
  breed: '', color: '', vetName: '', vetPhone: '', microchipId: '',
};

async function fetchQrInfo(code: string): Promise<QrPublicInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/public/q/${code}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function activateQr(code: string, form: ClaimForm): Promise<boolean> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('safetag_access_token') : null;
    if (!token) return false;

    const isMedical = MEDICAL_CATS.includes(form.category);
    const isPet = PET_CATS.includes(form.category);

    const hasMedical = isMedical && Object.values(form.medicalInfo).some((v) => v.trim());
    const hasPet = isPet && Object.values(form.petInfo).some((v) => v.trim());

    const body: Record<string, unknown> = {
      code,
      category: form.category,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      ownerContactEmail: form.ownerContactEmail.trim() || undefined,
      ownerContactPhone: form.ownerContactPhone.trim() || undefined,
      rewardMessage: form.rewardMessage.trim() || undefined,
    };

    if (hasMedical) {
      const cleaned: Partial<MedicalInfo> = {};
      (Object.keys(form.medicalInfo) as (keyof MedicalInfo)[]).forEach((k) => {
        if (form.medicalInfo[k].trim()) cleaned[k] = form.medicalInfo[k].trim();
      });
      body.medicalInfo = cleaned;
    }

    if (hasPet) {
      const cleaned: Partial<PetInfo> = {};
      (Object.keys(form.petInfo) as (keyof PetInfo)[]).forEach((k) => {
        if (form.petInfo[k].trim()) cleaned[k] = form.petInfo[k].trim();
      });
      body.petInfo = cleaned;
    }

    const res = await fetch(`${API_BASE}/public/qr/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function FinderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [qrInfo, setQrInfo] = useState<QrPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [step, setStep] = useState<'category' | 'details'>('category');

  const [form, setForm] = useState<ClaimForm>({
    category: 'other',
    name: '',
    description: '',
    ownerContactEmail: '',
    ownerContactPhone: '',
    rewardMessage: '',
    medicalInfo: { ...emptyMedical },
    petInfo: { ...emptyPet },
  });

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('safetag_access_token'));
    fetchQrInfo(code).then((info) => {
      if (!info) setNotFound(true);
      else setQrInfo(info);
      setLoading(false);
    });
  }, [code]);

  function setField<K extends keyof ClaimForm>(key: K, val: ClaimForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function setMedField(key: keyof MedicalInfo, val: string) {
    setForm((f) => ({ ...f, medicalInfo: { ...f.medicalInfo, [key]: val } }));
  }

  function setPetField(key: keyof PetInfo, val: string) {
    setForm((f) => ({ ...f, petInfo: { ...f.petInfo, [key]: val } }));
  }

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('safetag_access_token') : null;
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(`/q/${code}`)}`);
      return;
    }

    setActivating(true);
    setActivationError('');

    const ok = await activateQr(code, form);
    if (ok) {
      const updated = await fetchQrInfo(code);
      setQrInfo(updated);
      setStep('category');
    } else {
      setActivationError('Failed to register tag. It may already be claimed, or your account has reached its tag limit.');
    }
    setActivating(false);
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}><img src="/logo.png" alt="TheWileyfox" style={styles.logoImg} /></div>
        <main style={styles.main}>
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>Loading…</div>
        </main>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={styles.container}>
        <div style={styles.header}><img src="/logo.png" alt="TheWileyfox" style={styles.logoImg} /></div>
        <main style={styles.main}>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</p>
            <h2 style={{ color: '#1a1a1a', marginBottom: '8px' }}>Tag Not Found</h2>
            <p style={{ color: '#666' }}>This QR code is not registered on the platform.</p>
          </div>
        </main>
      </div>
    );
  }

  const isMedicalCat = MEDICAL_CATS.includes(form.category);
  const isPetCat = PET_CATS.includes(form.category);
  const showReward = REWARD_CATS.includes(form.category);

  // ── UNCLAIMED: Step 1 — pick category ──────────────────────────────────────
  if (qrInfo?.status === 'unclaimed' && step === 'category') {
    return (
      <div style={styles.container}>
        <div style={styles.header}><img src="/logo.png" alt="TheWileyfox" style={styles.logoImg} /></div>
        <main style={styles.main}>
          <div style={styles.card}>
            <div style={{ fontSize: '40px', marginBottom: '12px', textAlign: 'center' }}>🏷️</div>
            <h1 style={{ ...styles.itemName, marginBottom: '6px' }}>Register This Tag</h1>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px', textAlign: 'center' }}>
              What are you attaching this tag to?
            </p>

            <div style={styles.categoryGrid}>
              {QR_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setField('category', cat); setStep('details'); }}
                  style={{
                    ...styles.categoryTile,
                    ...(form.category === cat ? styles.categoryTileActive : {}),
                  }}
                >
                  <span style={{ fontSize: '28px', display: 'block', marginBottom: '6px' }}>
                    {categoryEmojis[cat]}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                    {categoryLabels[cat]}
                  </span>
                </button>
              ))}
            </div>

            {!isLoggedIn && (
              <div style={{ ...styles.loginCta, marginTop: '20px' }}>
                <p style={styles.loginCtaText}>You need an account to register this tag.</p>
                <a href={`/login?redirect=${encodeURIComponent(`/q/${code}`)}`} style={styles.activateBtn}>
                  Sign in to Register
                </a>
                <a href={`/register?redirect=${encodeURIComponent(`/q/${code}`)}`} style={styles.loginCtaLink}>
                  Create a free account →
                </a>
              </div>
            )}
          </div>
        </main>
        <footer style={styles.footer}><p>Powered by TheWileyfox</p></footer>
      </div>
    );
  }

  // ── UNCLAIMED: Step 2 — fill in details ────────────────────────────────────
  if (qrInfo?.status === 'unclaimed' && step === 'details') {
    return (
      <div style={styles.container}>
        <div style={styles.header}><img src="/logo.png" alt="TheWileyfox" style={styles.logoImg} /></div>
        <main style={styles.main}>
          <div style={styles.card}>
            <button
              type="button"
              onClick={() => setStep('category')}
              style={styles.backBtn}
            >
              ← Back
            </button>

            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '36px' }}>{categoryEmojis[form.category]}</span>
            </div>
            <h1 style={{ ...styles.itemName, marginBottom: '4px' }}>
              {categoryLabels[form.category]}
            </h1>
            <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
              Fill in the details for this tag
            </p>

            <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* ── Core fields ── */}
              <div>
                <label style={styles.label}>
                  {isPetCat ? 'Pet Name' : form.category === 'person' || isMedicalCat ? 'Full Name' : 'Item Name'} *
                </label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder={
                    isPetCat ? 'e.g. Buddy' :
                    isMedicalCat ? 'e.g. John Smith' :
                    form.category === 'bag' ? 'e.g. Black Samsonite Suitcase' :
                    form.category === 'key' ? 'e.g. House Keys' :
                    form.category === 'vehicle' ? 'e.g. Blue Honda Civic' :
                    'Name or description'
                  }
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                />
              </div>

              {/* ── Pet-specific fields ── */}
              {isPetCat && (
                <fieldset style={styles.fieldset}>
                  <legend style={styles.fieldsetLegend}>🐾 Pet Details</legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={styles.fieldRow}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Breed</label>
                        <input style={styles.input} type="text" placeholder="e.g. Labrador"
                          value={form.petInfo.breed} onChange={(e) => setPetField('breed', e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Colour</label>
                        <input style={styles.input} type="text" placeholder="e.g. Golden"
                          value={form.petInfo.color} onChange={(e) => setPetField('color', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label style={styles.label}>Microchip ID</label>
                      <input style={styles.input} type="text" placeholder="15-digit chip number"
                        value={form.petInfo.microchipId} onChange={(e) => setPetField('microchipId', e.target.value)} />
                    </div>
                    <div style={styles.fieldRow}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Vet Name</label>
                        <input style={styles.input} type="text" placeholder="e.g. City Vets"
                          value={form.petInfo.vetName} onChange={(e) => setPetField('vetName', e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Vet Phone</label>
                        <input style={styles.input} type="tel" placeholder="+44 7911 123456"
                          value={form.petInfo.vetPhone} onChange={(e) => setPetField('vetPhone', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </fieldset>
              )}

              {/* ── Medical fields ── */}
              {isMedicalCat && (
                <fieldset style={{ ...styles.fieldset, borderColor: '#fca5a5', backgroundColor: '#fff8f8' }}>
                  <legend style={{ ...styles.fieldsetLegend, color: '#dc2626' }}>🚨 Medical Information</legend>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#9ca3af' }}>
                    Only fill what you&apos;re comfortable showing to a finder in an emergency.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={styles.fieldRow}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Blood Type</label>
                        <select style={styles.input} value={form.medicalInfo.bloodType}
                          onChange={(e) => setMedField('bloodType', e.target.value)}>
                          <option value="">Select…</option>
                          {['A+','A−','B+','B−','AB+','AB−','O+','O−'].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Allergies</label>
                        <input style={styles.input} type="text" placeholder="e.g. Penicillin, nuts"
                          value={form.medicalInfo.allergies} onChange={(e) => setMedField('allergies', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label style={styles.label}>Medical Conditions</label>
                      <input style={styles.input} type="text" placeholder="e.g. Diabetes Type 1, Epilepsy"
                        value={form.medicalInfo.medicalConditions} onChange={(e) => setMedField('medicalConditions', e.target.value)} />
                    </div>
                    <div>
                      <label style={styles.label}>Medications</label>
                      <input style={styles.input} type="text" placeholder="e.g. Metformin 500mg"
                        value={form.medicalInfo.medications} onChange={(e) => setMedField('medications', e.target.value)} />
                    </div>
                    <div style={styles.fieldRow}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Emergency Contact</label>
                        <input style={styles.input} type="text" placeholder="Name"
                          value={form.medicalInfo.emergencyContactName} onChange={(e) => setMedField('emergencyContactName', e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Emergency Phone</label>
                        <input style={styles.input} type="tel" placeholder="+44 7911 123456"
                          value={form.medicalInfo.emergencyContactPhone} onChange={(e) => setMedField('emergencyContactPhone', e.target.value)} />
                      </div>
                    </div>
                    <div style={styles.fieldRow}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Doctor / GP</label>
                        <input style={styles.input} type="text" placeholder="Dr. Smith"
                          value={form.medicalInfo.doctorName} onChange={(e) => setMedField('doctorName', e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={styles.label}>Doctor Phone</label>
                        <input style={styles.input} type="tel" placeholder="+44 117 900 0000"
                          value={form.medicalInfo.doctorPhone} onChange={(e) => setMedField('doctorPhone', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label style={styles.label}>Insurance Info</label>
                      <input style={styles.input} type="text" placeholder="Policy number / provider"
                        value={form.medicalInfo.insuranceInfo} onChange={(e) => setMedField('insuranceInfo', e.target.value)} />
                    </div>
                    <div>
                      <label style={styles.label}>Additional Notes</label>
                      <input style={styles.input} type="text" placeholder="Anything else a finder should know"
                        value={form.medicalInfo.notes} onChange={(e) => setMedField('notes', e.target.value)} />
                    </div>
                  </div>
                </fieldset>
              )}

              {/* ── Description ── */}
              <div>
                <label style={styles.label}>
                  {isPetCat ? 'Additional Notes' : form.category === 'place' ? 'Description' : 'Description / Notes'}
                </label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder={
                    isPetCat ? 'Any other details about your pet' :
                    form.category === 'bag' ? 'e.g. Contains laptop and passport' :
                    form.category === 'vehicle' ? 'e.g. Reg: AB12 CDE' :
                    'Optional description'
                  }
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                />
              </div>

              {/* ── Contact fields ── */}
              <fieldset style={styles.fieldset}>
                <legend style={styles.fieldsetLegend}>📞 Contact Info</legend>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={styles.label}>Contact Email</label>
                    <input style={styles.input} type="email" placeholder="your@email.com"
                      value={form.ownerContactEmail} onChange={(e) => setField('ownerContactEmail', e.target.value)} />
                  </div>
                  <div>
                    <label style={styles.label}>Contact Phone</label>
                    <input style={styles.input} type="tel" placeholder="+44 7911 123456"
                      value={form.ownerContactPhone} onChange={(e) => setField('ownerContactPhone', e.target.value)} />
                  </div>
                </div>
              </fieldset>

              {/* ── Reward ── */}
              {showReward && (
                <div>
                  <label style={styles.label}>Reward Message</label>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="e.g. £50 reward if returned"
                    value={form.rewardMessage}
                    onChange={(e) => setField('rewardMessage', e.target.value)}
                  />
                </div>
              )}

              {activationError && (
                <p style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>{activationError}</p>
              )}

              {isLoggedIn ? (
                <button
                  type="submit"
                  disabled={activating || !form.name.trim()}
                  style={{
                    ...styles.activateBtn,
                    opacity: activating || !form.name.trim() ? 0.6 : 1,
                    cursor: activating || !form.name.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {activating ? 'Registering…' : 'Register Tag'}
                </button>
              ) : (
                <div style={styles.loginCta}>
                  <p style={styles.loginCtaText}>You need an account to register this tag.</p>
                  <a href={`/login?redirect=${encodeURIComponent(`/q/${code}`)}`} style={styles.activateBtn}>
                    Sign in to Register
                  </a>
                  <a href={`/register?redirect=${encodeURIComponent(`/q/${code}`)}`} style={styles.loginCtaLink}>
                    Create a free account →
                  </a>
                </div>
              )}
            </form>
          </div>
        </main>
        <footer style={styles.footer}><p>Powered by TheWileyfox</p></footer>
      </div>
    );
  }

  if (!qrInfo) return null;

  // ── ACTIVE: show profile card ───────────────────────────────────────────────
  const isMedical = qrInfo.category === 'medical' || qrInfo.category === 'person';
  const isPet = qrInfo.category === 'pet';
  const accentColor = qrInfo.theme?.accentColor ?? '#ea2e00';
  const isDark = qrInfo.theme?.backgroundStyle === 'dark';

  return (
    <div style={{ ...styles.container, backgroundColor: isDark ? '#0f0f14' : '#f8f9fa' }}>
      <div style={{ ...styles.header, backgroundColor: accentColor }}>
        {qrInfo.theme?.showLogo !== false && (
          qrInfo.theme?.logoUrl
            ? <img src={qrInfo.theme.logoUrl} alt="TheWileyfox" style={styles.logoImg} />
            : <img src="/logo.png" alt="TheWileyfox" style={styles.logoImg} />
        )}
      </div>

      <main style={styles.main}>
        {qrInfo.isLost && (
          <div style={styles.lostBanner}>
            <span style={styles.lostIcon}>⚠️</span>
            <div>
              <p style={styles.lostTitle}>This item has been reported lost</p>
              <p style={styles.lostSubtitle}>Please help return it — the owner is actively looking.</p>
            </div>
          </div>
        )}

        <div style={{ ...styles.card, backgroundColor: isDark ? '#1a1a2e' : '#fff', color: isDark ? '#f1f1f1' : undefined }}>
          <div style={{ ...styles.categoryBadge, backgroundColor: accentColor + '22', color: accentColor }}>
            {categoryEmojis[qrInfo.category] || ''} {categoryLabels[qrInfo.category] || qrInfo.category}
          </div>

          {qrInfo.photoUrl && (
            <img src={qrInfo.photoUrl} alt={qrInfo.name || 'Item'} style={styles.photo} />
          )}

          {qrInfo.name && <h1 style={styles.itemName}>{qrInfo.name}</h1>}

          {/* Medical info */}
          {isMedical && (qrInfo.description || qrInfo.customFields?.medicalInfo) && (
            <div style={styles.medicalBox}>
              <p style={styles.medicalHeading}>🚨 Medical / Emergency Info</p>
              {qrInfo.description && <p style={styles.medicalText}>{qrInfo.description}</p>}
              {qrInfo.customFields?.medicalInfo && (() => {
                const med = qrInfo.customFields.medicalInfo as Record<string, string>;
                const fields = [
                  { key: 'bloodType', label: 'Blood Type' },
                  { key: 'allergies', label: 'Allergies' },
                  { key: 'medicalConditions', label: 'Medical Conditions' },
                  { key: 'medications', label: 'Medications' },
                  { key: 'emergencyContactName', label: 'Emergency Contact' },
                  { key: 'emergencyContactPhone', label: 'Emergency Phone' },
                  { key: 'doctorName', label: 'Doctor' },
                  { key: 'doctorPhone', label: 'Doctor Phone' },
                  { key: 'insuranceInfo', label: 'Insurance' },
                  { key: 'notes', label: 'Notes' },
                ];
                return (
                  <div style={{ marginTop: '8px' }}>
                    {fields.map(({ key, label }) =>
                      med[key] ? (
                        <p key={key} style={{ margin: '4px 0', fontSize: '14px', color: '#7f1d1d' }}>
                          <strong>{label}:</strong> {med[key]}
                        </p>
                      ) : null
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Pet info */}
          {isPet && qrInfo.customFields?.petInfo && (() => {
            const pet = qrInfo.customFields.petInfo as Record<string, string>;
            const fields = [
              { key: 'breed', label: 'Breed' },
              { key: 'color', label: 'Colour' },
              { key: 'microchipId', label: 'Microchip ID' },
              { key: 'vetName', label: 'Vet' },
              { key: 'vetPhone', label: 'Vet Phone' },
            ];
            const hasAny = fields.some(({ key }) => pet[key]);
            if (!hasAny) return null;
            return (
              <div style={styles.petBox}>
                <p style={styles.petHeading}>🐾 Pet Details</p>
                {fields.map(({ key, label }) =>
                  pet[key] ? (
                    <p key={key} style={{ margin: '4px 0', fontSize: '14px', color: '#064e3b' }}>
                      <strong>{label}:</strong> {pet[key]}
                    </p>
                  ) : null
                )}
              </div>
            );
          })()}

          {!isMedical && qrInfo.description && (
            <p style={styles.description}>{qrInfo.description}</p>
          )}

          {qrInfo.ownerName && (
            <p style={styles.ownerInfo}>Registered by <strong>{qrInfo.ownerName}</strong></p>
          )}

          {(qrInfo.ownerContactEmail || qrInfo.ownerContactPhone) && (
            <div style={styles.contactBox}>
              <p style={styles.contactTitle}>Contact the owner directly:</p>
              {qrInfo.ownerContactEmail && (
                <a href={`mailto:${qrInfo.ownerContactEmail}`} style={styles.contactLink}>
                  📧 {qrInfo.ownerContactEmail}
                </a>
              )}
              {qrInfo.ownerContactPhone && (
                <a href={`tel:${qrInfo.ownerContactPhone}`} style={styles.contactLink}>
                  📞 {qrInfo.ownerContactPhone}
                </a>
              )}
            </div>
          )}

          {qrInfo.rewardMessage && (
            <div style={styles.rewardBox}>
              <p style={styles.rewardText}>🎁 {qrInfo.rewardMessage}</p>
            </div>
          )}
        </div>

        <div style={styles.formSection}>
          <ReportForm code={code} apiUrl={API_URL} />
        </div>
      </main>

      <footer style={styles.footer}>
        <p>Powered by TheWileyfox</p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    backgroundColor: '#ea2e00',
    padding: '16px 20px',
    textAlign: 'center',
  },
  logoImg: {
    height: '36px',
    width: 'auto',
    objectFit: 'contain' as const,
    display: 'block',
    margin: '0 auto',
  },
  main: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '20px 16px',
  },
  lostBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  lostIcon: { fontSize: '24px', flexShrink: 0 },
  lostTitle: { margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#dc2626' },
  lostSubtitle: { margin: 0, fontSize: '13px', color: '#ef4444' },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    textAlign: 'center' as const,
  },
  categoryBadge: {
    display: 'inline-block',
    padding: '6px 14px',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '16px',
  },
  photo: {
    width: '100%',
    maxHeight: '240px',
    objectFit: 'cover' as const,
    borderRadius: '8px',
    marginBottom: '16px',
  },
  itemName: { margin: '0 0 8px', fontSize: '24px', fontWeight: 700, color: '#1a1a1a' },
  description: { margin: '0 0 12px', fontSize: '15px', color: '#555', lineHeight: 1.5 },
  medicalBox: {
    backgroundColor: '#fef2f2',
    border: '2px solid #fca5a5',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '12px',
    textAlign: 'left' as const,
  },
  medicalHeading: { margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: '#dc2626' },
  medicalText: { margin: 0, fontSize: '15px', color: '#7f1d1d', lineHeight: 1.6, fontWeight: 500 },
  petBox: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '12px',
    textAlign: 'left' as const,
  },
  petHeading: { margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: '#15803d' },
  ownerInfo: { margin: '0 0 16px', fontSize: '14px', color: '#888' },
  contactBox: {
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '8px',
    padding: '12px 16px',
    marginTop: '12px',
    textAlign: 'left' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  contactTitle: {
    margin: '0 0 4px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#0369a1',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  contactLink: { fontSize: '14px', color: '#0284c7', textDecoration: 'none', fontWeight: 500 },
  rewardBox: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    padding: '12px 16px',
    marginTop: '12px',
  },
  rewardText: { margin: 0, fontSize: '14px', color: '#92400e', fontWeight: 500 },
  formSection: { marginBottom: '20px' },
  footer: { textAlign: 'center' as const, padding: '20px', fontSize: '13px', color: '#999' },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
    textAlign: 'left' as const,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#111827',
    backgroundColor: '#fff',
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  activateBtn: {
    display: 'block',
    backgroundColor: '#ea2e00',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 700,
    width: '100%',
    marginTop: '4px',
    textAlign: 'center' as const,
    textDecoration: 'none',
    boxSizing: 'border-box' as const,
  },
  loginCta: { display: 'flex', flexDirection: 'column' as const, gap: '10px', marginTop: '4px' },
  loginCtaText: { margin: 0, fontSize: '13px', color: '#6b7280', textAlign: 'center' as const },
  loginCtaLink: { textAlign: 'center' as const, fontSize: '13px', color: '#ea2e00', textDecoration: 'none', fontWeight: 500 },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px',
    marginBottom: '8px',
  },
  categoryTile: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 6px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  categoryTileActive: {
    borderColor: '#ea2e00',
    backgroundColor: '#fff5f5',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0 0 16px 0',
    display: 'block',
    textAlign: 'left' as const,
  },
  fieldset: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '14px 14px 10px',
    margin: 0,
    backgroundColor: '#fafafa',
  },
  fieldsetLegend: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#374151',
    padding: '0 6px',
  },
  fieldRow: {
    display: 'flex',
    gap: '10px',
  },
};
