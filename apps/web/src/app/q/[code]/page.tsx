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
}

interface ActivationFormData {
  name: string;
  category: string;
  ownerContactEmail: string;
  ownerContactPhone: string;
  rewardMessage: string;
}

const categoryLabels: Record<string, string> = {
  pet: 'Pet',
  bag: 'Bag',
  key: 'Key',
  person: 'Person',
  vehicle: 'Vehicle',
  other: 'Other',
  medical: 'Medical / ID',
};

const categoryEmojis: Record<string, string> = {
  pet: '🐾',
  bag: '🎒',
  key: '🔑',
  person: '👤',
  vehicle: '🚗',
  other: '📦',
  medical: '🏥',
};

const QR_CATEGORIES = ['pet', 'bag', 'key', 'person', 'vehicle', 'other', 'medical'] as const;

async function fetchQrInfo(code: string): Promise<QrPublicInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/public/q/${code}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function activateQr(code: string, formData: ActivationFormData): Promise<QrPublicInfo | null> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('safetag_access_token') : null;
    if (!token) return null;

    const res = await fetch(`${API_BASE}/public/qr/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, ...formData }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default function FinderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [qrInfo, setQrInfo] = useState<QrPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Activation form state
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [form, setForm] = useState<ActivationFormData>({
    name: '',
    category: 'other',
    ownerContactEmail: '',
    ownerContactPhone: '',
    rewardMessage: '',
  });

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('safetag_access_token'));
    fetchQrInfo(code).then((info) => {
      if (!info) {
        setNotFound(true);
      } else {
        setQrInfo(info);
      }
      setLoading(false);
    });
  }, [code]);

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

    const result = await activateQr(code, form);
    if (result) {
      // Re-fetch the public info to show the active card
      const updated = await fetchQrInfo(code);
      setQrInfo(updated);
    } else {
      setActivationError('Failed to register tag. The tag may already be claimed, or your account has reached its tag limit.');
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

  // Unclaimed — show activation/registration form
  if (qrInfo?.status === 'unclaimed') {
    return (
      <div style={styles.container}>
        <div style={styles.header}><img src="/logo.png" alt="TheWileyfox" style={styles.logoImg} /></div>
        <main style={styles.main}>
          <div style={styles.card}>
            <div style={{ fontSize: '48px', marginBottom: '12px', textAlign: 'center' }}>🏷️</div>
            <h1 style={{ ...styles.itemName, marginBottom: '8px' }}>Register This Tag</h1>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px', textAlign: 'center' }}>
              This tag hasn&apos;t been registered yet. Set it up to protect what matters.
            </p>

            <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={styles.label}>Name *</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="e.g. Max the Labrador"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label style={styles.label}>Category *</label>
                <select
                  style={styles.input}
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {QR_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {categoryEmojis[cat]} {categoryLabels[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Contact Email</label>
                <input
                  style={styles.input}
                  type="email"
                  placeholder="your@email.com"
                  value={form.ownerContactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, ownerContactEmail: e.target.value }))}
                />
              </div>

              <div>
                <label style={styles.label}>Contact Phone</label>
                <input
                  style={styles.input}
                  type="tel"
                  placeholder="+44 7911 123456"
                  value={form.ownerContactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, ownerContactPhone: e.target.value }))}
                />
              </div>

              <div>
                <label style={styles.label}>Reward Message</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="e.g. £50 reward if returned"
                  value={form.rewardMessage}
                  onChange={(e) => setForm((f) => ({ ...f, rewardMessage: e.target.value }))}
                />
              </div>

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
                  <a
                    href={`/login?redirect=${encodeURIComponent(`/q/${code}`)}`}
                    style={styles.activateBtn}
                  >
                    Sign in to Register
                  </a>
                  <a
                    href={`/register?redirect=${encodeURIComponent(`/q/${code}`)}`}
                    style={styles.loginCtaLink}
                  >
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

  const isMedical = qrInfo.category === 'medical';
  const accentColor = qrInfo.theme?.accentColor ?? '#f97316';
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

          {/* Medical info — shown prominently with red alert box */}
          {isMedical && qrInfo.description ? (
            <div style={styles.medicalBox}>
              <p style={styles.medicalHeading}>🚨 Medical / Emergency Info</p>
              <p style={styles.medicalText}>{qrInfo.description}</p>
            </div>
          ) : (
            qrInfo.description && <p style={styles.description}>{qrInfo.description}</p>
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
    backgroundColor: '#f97316',
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
  lostIcon: {
    fontSize: '24px',
    flexShrink: 0,
  },
  lostTitle: {
    margin: '0 0 4px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#dc2626',
  },
  lostSubtitle: {
    margin: 0,
    fontSize: '13px',
    color: '#ef4444',
  },
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
  itemName: {
    margin: '0 0 8px',
    fontSize: '24px',
    fontWeight: 700,
    color: '#1a1a1a',
  },
  description: {
    margin: '0 0 12px',
    fontSize: '15px',
    color: '#555',
    lineHeight: 1.5,
  },
  medicalBox: {
    backgroundColor: '#fef2f2',
    border: '2px solid #fca5a5',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '12px',
    textAlign: 'left' as const,
  },
  medicalHeading: {
    margin: '0 0 8px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#dc2626',
  },
  medicalText: {
    margin: 0,
    fontSize: '15px',
    color: '#7f1d1d',
    lineHeight: 1.6,
    fontWeight: 500,
  },
  ownerInfo: {
    margin: '0 0 16px',
    fontSize: '14px',
    color: '#888',
  },
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
  contactLink: {
    fontSize: '14px',
    color: '#0284c7',
    textDecoration: 'none',
    fontWeight: 500,
  },
  rewardBox: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    padding: '12px 16px',
    marginTop: '12px',
  },
  rewardText: {
    margin: 0,
    fontSize: '14px',
    color: '#92400e',
    fontWeight: 500,
  },
  formSection: {
    marginBottom: '20px',
  },
  footer: {
    textAlign: 'center' as const,
    padding: '20px',
    fontSize: '13px',
    color: '#999',
  },
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
    backgroundColor: '#f97316',
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
  loginCta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    marginTop: '4px',
  },
  loginCtaText: {
    margin: 0,
    fontSize: '13px',
    color: '#6b7280',
    textAlign: 'center' as const,
  },
  loginCtaLink: {
    textAlign: 'center' as const,
    fontSize: '13px',
    color: '#f97316',
    textDecoration: 'none',
    fontWeight: 500,
  },
};
