import { Ionicons } from '@/components/Icon';
import { useAuth } from '@/hooks/useAuth';
import { extractApiErrorMessage } from '@/lib/api-error';
import { apiClient } from '@/services/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  orange:     '#FF7B14',
  orangeSoft: '#FFE9D6',
  red:        '#E94B4B',
  redSoft:    '#FDECEC',
  green:      '#3FA34D',
  greenSoft:  '#F0FDF4',
  purple:     '#6A3FB4',
  purpleSoft: '#F0EBFC',
  creamLight: '#F2F4E5',
  charcoal:   '#232323',
  mute:       '#8a8a8a',
  line:       '#ECECEC',
};

function bg(dark: boolean) { return dark ? '#0f1117' : T.creamLight; }
function cardBg(dark: boolean) { return dark ? '#1a1d27' : '#ffffff'; }
function borderColor(dark: boolean) { return dark ? '#2a2f45' : T.line; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean) { return dark ? '#64748b' : T.mute; }

const CATEGORIES = [
  { id: 'person',  label: 'Person',   icon: 'person',    color: T.orange },
  { id: 'pet',     label: 'Pet',      icon: 'paw',       color: '#22C55E' },
  { id: 'bag',     label: 'Bag',      icon: 'briefcase', color: '#3B82F6' },
  { id: 'key',     label: 'Keys',     icon: 'key',       color: '#EAB308' },
  { id: 'vehicle', label: 'Vehicle',  icon: 'car',       color: '#8B5CF6' },
  { id: 'medical', label: 'Medical',  icon: 'medkit',    color: T.red },
  { id: 'other',   label: 'Other',    icon: 'pricetag',  color: T.mute },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

interface QrPublicInfo {
  id?: string;
  uniqueCode: string;
  status?: string;
  category?: string;
  name?: string;
  isLost?: boolean;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
  ownerName?: string;
}

type ClaimStep = 'category' | 'details' | 'confirm' | 'success';

export default function ClaimScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, isAuthenticated } = useAuth();

  // QR lookup state
  const [loading, setLoading] = useState(true);
  const [qrInfo, setQrInfo] = useState<QrPublicInfo | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Claim sub-flow state
  const [claimStep, setClaimStep] = useState<ClaimStep>('category');
  const [category, setCategory] = useState<CategoryId>('person');
  const [tagName, setTagName] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [contactPhone, setContactPhone] = useState('');
  const [rewardMessage, setRewardMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [claimedTag, setClaimedTag] = useState<{ id: string; name: string; uniqueCode: string } | null>(null);

  // Finder report state (State 3)
  const [finderContact, setFinderContact] = useState(user?.email ?? '');
  const [finderNotes, setFinderNotes] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [reportSending, setReportSending] = useState(false);

  const lookup = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setLookupError(null);
    try {
      const { data } = await apiClient.get<QrPublicInfo>(`/public/q/${code}`);
      setQrInfo(data);
    } catch (e: any) {
      setLookupError(extractApiErrorMessage(e, 'QR code not found.'));
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { lookup(); }, [lookup]);

  // ── Determine which state to render ───────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bg(dark), alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.orange} />
        <Text style={{ marginTop: 16, color: textMuted(dark), fontSize: 14 }}>Looking up tag…</Text>
      </View>
    );
  }

  if (lookupError || !qrInfo) {
    return (
      <View style={{ flex: 1, backgroundColor: bg(dark), alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Ionicons name="alert-circle-outline" size={48} color={T.red} />
        <Text style={{ marginTop: 16, fontSize: 18, fontWeight: '700', color: textPrimary(dark), textAlign: 'center' }}>
          Tag Not Found
        </Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: textMuted(dark), textAlign: 'center', lineHeight: 21 }}>
          {lookupError ?? 'This QR code is not registered on TheWileyfox.'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 24, backgroundColor: T.orange, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // State 5 — not authenticated + unclaimed → must sign in to claim
  if (!isAuthenticated && qrInfo.status === 'unclaimed') {
    return <UnauthClaimScreen code={code} dark={dark} router={router} textPrimary={textPrimary} textMuted={textMuted} bg={bg} />;
  }

  // State 4 — claimed + isLost → priority missing alert
  if (qrInfo.status !== 'unclaimed' && qrInfo.isLost) {
    return <MissingAlertScreen qrInfo={qrInfo} dark={dark} router={router} code={code} textPrimary={textPrimary} textMuted={textMuted} cardBg={cardBg} borderColor={borderColor} bg={bg} finderContact={finderContact} setFinderContact={setFinderContact} finderNotes={finderNotes} setFinderNotes={setFinderNotes} reportSent={reportSent} setReportSent={setReportSent} reportSending={reportSending} setReportSending={setReportSending} />;
  }

  // State 2 — claimed + current user is owner → navigate to their tag
  // We can't tell server-side who the owner is from public info alone,
  // but if the user is authed and qrInfo has an id, we can check their own tags list;
  // simplest: just show a "this tag is registered" screen and let them go to My Tags
  if (qrInfo.status !== 'unclaimed' && !qrInfo.isLost) {
    return <AlreadyClaimedScreen qrInfo={qrInfo} dark={dark} router={router} code={code} textPrimary={textPrimary} textMuted={textMuted} cardBg={cardBg} borderColor={borderColor} bg={bg} isAuthenticated={isAuthenticated} finderContact={finderContact} setFinderContact={setFinderContact} finderNotes={finderNotes} setFinderNotes={setFinderNotes} reportSent={reportSent} setReportSent={setReportSent} reportSending={reportSending} setReportSending={setReportSending} />;
  }

  // State 1 — unclaimed + authenticated → claim flow
  async function handleClaim() {
    if (!code || !isAuthenticated) return;
    setSubmitting(true);
    try {
      const result = await apiClient.post<{ id: string; name: string; uniqueCode: string }>('/public/qr/activate', {
        code,
        category,
        name: tagName.trim(),
        ownerContactEmail: contactEmail.trim() || undefined,
        ownerContactPhone: contactPhone.trim() || undefined,
        rewardMessage: rewardMessage.trim() || undefined,
      });
      setClaimedTag(result.data);
      setClaimStep('success');
    } catch (e: any) {
      Alert.alert('Claim Failed', extractApiErrorMessage(e, 'Failed to claim this tag.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (claimStep === 'success' && claimedTag) {
    return (
      <View style={{ flex: 1, backgroundColor: bg(dark), alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: T.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Ionicons name="checkmark-circle" size={48} color={T.green} />
        </View>
        <Text style={{ fontSize: 24, fontWeight: '800', color: textPrimary(dark), textAlign: 'center' }}>Tag Claimed!</Text>
        <Text style={{ marginTop: 8, fontSize: 15, color: textMuted(dark), textAlign: 'center', lineHeight: 22 }}>
          <Text style={{ fontWeight: '700', color: textPrimary(dark) }}>{claimedTag.name}</Text>
          {' '}is now registered under your account.
        </Text>
        <View style={{ marginTop: 12, backgroundColor: dark ? '#1a2a1a' : '#f0fdf4', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={{ fontSize: 12, color: T.green, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Code: {claimedTag.uniqueCode}
          </Text>
        </View>
        <Text style={{ marginTop: 16, fontSize: 13, color: textMuted(dark), textAlign: 'center', lineHeight: 20 }}>
          Anyone who scans this tag can now reach you directly.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(app)/tags')}
          style={{ marginTop: 28, backgroundColor: T.orange, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 40 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>View in My Tags</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(app)/map')} style={{ marginTop: 12, padding: 12 }}>
          <Text style={{ color: textMuted(dark), fontSize: 14 }}>Go to Map</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Claim sub-flow (States 1 → category → details → confirm → success)
  const selectedCat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  if (claimStep === 'confirm') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bg(dark) }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ClaimHeader dark={dark} onBack={() => setClaimStep('details')} title="Confirm Claim" cardBg={cardBg} borderColor={borderColor} textPrimary={textPrimary} />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
          <View style={{ backgroundColor: cardBg(dark), borderRadius: 16, borderWidth: 1, borderColor: borderColor(dark), padding: 20, gap: 14 }}>
            <ConfirmRow label="Code" value={code} dark={dark} textPrimary={textPrimary} textMuted={textMuted} />
            <ConfirmRow label="Category" value={selectedCat.label} dark={dark} textPrimary={textPrimary} textMuted={textMuted} />
            <ConfirmRow label="Name" value={tagName} dark={dark} textPrimary={textPrimary} textMuted={textMuted} />
            {contactEmail ? <ConfirmRow label="Contact Email" value={contactEmail} dark={dark} textPrimary={textPrimary} textMuted={textMuted} /> : null}
            {contactPhone ? <ConfirmRow label="Contact Phone" value={contactPhone} dark={dark} textPrimary={textPrimary} textMuted={textMuted} /> : null}
            {rewardMessage ? <ConfirmRow label="Reward Message" value={rewardMessage} dark={dark} textPrimary={textPrimary} textMuted={textMuted} /> : null}
          </View>
          <Text style={{ fontSize: 12, color: textMuted(dark), textAlign: 'center', lineHeight: 18 }}>
            By claiming this tag you agree that finders can see your contact details when they scan it.
          </Text>
          <TouchableOpacity
            onPress={handleClaim}
            disabled={submitting}
            style={{ backgroundColor: T.orange, borderRadius: 16, paddingVertical: 16, alignItems: 'center', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Confirm & Claim Tag</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (claimStep === 'details') {
    const canContinue = tagName.trim().length > 0;
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bg(dark) }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ClaimHeader dark={dark} onBack={() => setClaimStep('category')} title="Tag Details" cardBg={cardBg} borderColor={borderColor} textPrimary={textPrimary} />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <ProgressDots step={1} dark={dark} />

          <LabeledInput
            label="Name *"
            placeholder={`e.g. ${selectedCat.id === 'pet' ? "Buddy's Tag" : selectedCat.id === 'person' ? "Sarah's Tag" : "My " + selectedCat.label}`}
            value={tagName}
            onChangeText={setTagName}
            dark={dark}
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textMuted={textMuted}
          />
          <LabeledInput
            label="Contact Email (shown to finders)"
            placeholder="your@email.com"
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            dark={dark}
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textMuted={textMuted}
          />
          <LabeledInput
            label="Contact Phone (optional)"
            placeholder="+44 7700 000000"
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
            dark={dark}
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textMuted={textMuted}
          />
          <LabeledInput
            label="Reward Message (optional)"
            placeholder="If found, please call — reward offered!"
            value={rewardMessage}
            onChangeText={setRewardMessage}
            multiline
            dark={dark}
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textMuted={textMuted}
          />

          <TouchableOpacity
            onPress={() => setClaimStep('confirm')}
            disabled={!canContinue}
            style={{ backgroundColor: canContinue ? T.orange : T.mute, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Review & Confirm</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // claimStep === 'category' (default State 1 landing)
  return (
    <View style={{ flex: 1, backgroundColor: bg(dark) }}>
      <ClaimHeader dark={dark} onBack={() => router.back()} title="Claim This Tag" cardBg={cardBg} borderColor={borderColor} textPrimary={textPrimary} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <ProgressDots step={0} dark={dark} />

        {/* Unregistered tag info */}
        <View style={{ backgroundColor: T.orangeSoft, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: T.orange, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="pricetag" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.charcoal }}>Unregistered Tag</Text>
            <Text style={{ fontSize: 12, color: T.charcoal, opacity: 0.7, marginTop: 2 }}>Code: {code}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary(dark) }}>What is this tag for?</Text>
        <Text style={{ fontSize: 13, color: textMuted(dark), marginTop: -8 }}>
          Choose the category that best describes what you're tagging.
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {CATEGORIES.map((cat) => {
            const selected = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setCategory(cat.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: selected ? cat.color + '22' : cardBg(dark),
                  borderWidth: 1.5,
                  borderColor: selected ? cat.color : borderColor(dark),
                }}
              >
                <Ionicons name={cat.icon as any} size={16} color={selected ? cat.color : textMuted(dark)} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? cat.color : textPrimary(dark) }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => setClaimStep('details')}
          style={{ backgroundColor: T.orange, borderRadius: 16, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 }}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Claim This Tag</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center', padding: 12 }}>
          <Text style={{ color: textMuted(dark), fontSize: 14 }}>This isn't mine</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Sub-screens ────────────────────────────────────────────────────────────────

function UnauthClaimScreen({ code, dark, router, textPrimary, textMuted, bg }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: bg(dark), alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: T.orangeSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Ionicons name="log-in-outline" size={36} color={T.orange} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary(dark), textAlign: 'center' }}>
        Sign in to Claim
      </Text>
      <Text style={{ marginTop: 10, fontSize: 14, color: textMuted(dark), textAlign: 'center', lineHeight: 22 }}>
        Create an account or sign in to register tag{' '}
        <Text style={{ fontWeight: '700', color: textPrimary(dark) }}>{code}</Text> to your profile.
      </Text>
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/(auth)/login' as any, params: { pendingCode: code } })}
        style={{ marginTop: 28, backgroundColor: T.orange, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 40 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/(auth)/signup' as any, params: { pendingCode: code } })}
        style={{ marginTop: 12, borderWidth: 1.5, borderColor: T.orange, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 40 }}
      >
        <Text style={{ color: T.orange, fontWeight: '700', fontSize: 15 }}>Create Account</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, padding: 12 }}>
        <Text style={{ color: textMuted(dark), fontSize: 13 }}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
}

function MissingAlertScreen({ qrInfo, dark, router, code, textPrimary, textMuted, cardBg, borderColor, bg, finderContact, setFinderContact, finderNotes, setFinderNotes, reportSent, setReportSent, reportSending, setReportSending }: any) {
  const cat = qrInfo.category ?? 'other';

  async function submitSighting() {
    if (!finderContact.trim()) {
      Alert.alert('Contact required', 'Please provide a way to reach you.');
      return;
    }
    setReportSending(true);
    try {
      await apiClient.post(`/public/q/${code}/report`, {
        finderContact: finderContact.trim(),
        finderNotes: finderNotes.trim() || 'I have seen this person / item.',
      });
      setReportSent(true);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to submit sighting.'));
    } finally {
      setReportSending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg(dark) }}>
      <View style={{
        backgroundColor: T.red, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 }}>Missing Alert</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
        {/* Alert banner */}
        <View style={{ backgroundColor: dark ? '#2d1a1a' : T.redSoft, borderRadius: 16, padding: 20, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: T.red }}>
          <Ionicons name="alert-circle" size={40} color={T.red} />
          <Text style={{ fontSize: 20, fontWeight: '800', color: T.red, textAlign: 'center' }}>
            This {cat} has been reported missing!
          </Text>
          {qrInfo.name ? (
            <Text style={{ fontSize: 15, color: dark ? '#fca5a5' : '#b91c1c', textAlign: 'center', fontWeight: '600' }}>
              {qrInfo.name}
            </Text>
          ) : null}
        </View>

        {/* Contact info */}
        {(qrInfo.ownerContactEmail || qrInfo.ownerContactPhone) && (
          <View style={{ backgroundColor: cardBg(dark), borderRadius: 14, padding: 16, borderWidth: 1, borderColor: borderColor(dark), gap: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Contact Owner Directly
            </Text>
            {qrInfo.ownerContactEmail && (
              <Text style={{ fontSize: 14, color: textPrimary(dark) }}>📧 {qrInfo.ownerContactEmail}</Text>
            )}
            {qrInfo.ownerContactPhone && (
              <Text style={{ fontSize: 14, color: textPrimary(dark) }}>📞 {qrInfo.ownerContactPhone}</Text>
            )}
          </View>
        )}

        {/* Sighting form */}
        {reportSent ? (
          <View style={{ backgroundColor: dark ? '#0f2b14' : T.greenSoft, borderRadius: 14, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: T.green }}>
            <Ionicons name="checkmark-circle" size={32} color={T.green} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.green }}>Sighting Reported</Text>
            <Text style={{ fontSize: 13, color: textMuted(dark), textAlign: 'center', lineHeight: 19 }}>
              The owner has been notified. Thank you for helping!
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary(dark) }}>Report a Sighting</Text>
            <TextInput
              style={{ backgroundColor: cardBg(dark), borderWidth: 1, borderColor: borderColor(dark), borderRadius: 12, padding: 14, color: textPrimary(dark), fontSize: 14 }}
              placeholder="Your contact (phone or email)"
              placeholderTextColor={textMuted(dark)}
              value={finderContact}
              onChangeText={setFinderContact}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={{ backgroundColor: cardBg(dark), borderWidth: 1, borderColor: borderColor(dark), borderRadius: 12, padding: 14, color: textPrimary(dark), fontSize: 14, minHeight: 80, textAlignVertical: 'top' }}
              placeholder="Where did you see them? Any additional details…"
              placeholderTextColor={textMuted(dark)}
              value={finderNotes}
              onChangeText={setFinderNotes}
              multiline
            />
            <TouchableOpacity
              onPress={submitSighting}
              disabled={reportSending}
              style={{ backgroundColor: T.red, borderRadius: 16, paddingVertical: 15, alignItems: 'center', opacity: reportSending ? 0.7 : 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {reportSending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="eye" size={17} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>I've Seen Them</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function AlreadyClaimedScreen({ qrInfo, dark, router, code, textPrimary, textMuted, cardBg, borderColor, bg, isAuthenticated, finderContact, setFinderContact, finderNotes, setFinderNotes, reportSent, setReportSent, reportSending, setReportSending }: any) {
  async function submitFoundReport() {
    if (!finderContact.trim()) {
      Alert.alert('Contact required', 'Please provide a way to reach you.');
      return;
    }
    setReportSending(true);
    try {
      await apiClient.post(`/public/q/${code}/report`, {
        finderContact: finderContact.trim(),
        finderNotes: finderNotes.trim() || 'Found this item.',
      });
      setReportSent(true);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to submit report.'));
    } finally {
      setReportSending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg(dark) }}>
      <View style={{
        backgroundColor: cardBg(dark),
        borderBottomWidth: 1, borderBottomColor: borderColor(dark),
        paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={T.orange} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary(dark), flex: 1 }}>
          {qrInfo.name ?? 'Registered Tag'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
        {/* Tag info */}
        <View style={{ backgroundColor: cardBg(dark), borderRadius: 16, padding: 20, borderWidth: 1, borderColor: borderColor(dark), gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: T.orangeSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="pricetag" size={20} color={T.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary(dark) }}>{qrInfo.name ?? 'Registered Tag'}</Text>
              <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 2 }}>Code: {code}</Text>
            </View>
            <View style={{ backgroundColor: '#f0fdf4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a' }}>ACTIVE</Text>
            </View>
          </View>
          {qrInfo.ownerName && (
            <Text style={{ fontSize: 13, color: textMuted(dark) }}>Registered by {qrInfo.ownerName}</Text>
          )}
          {qrInfo.ownerContactEmail && (
            <Text style={{ fontSize: 14, color: textPrimary(dark) }}>📧 {qrInfo.ownerContactEmail}</Text>
          )}
          {qrInfo.ownerContactPhone && (
            <Text style={{ fontSize: 14, color: textPrimary(dark) }}>📞 {qrInfo.ownerContactPhone}</Text>
          )}
          {qrInfo.rewardMessage && (
            <View style={{ backgroundColor: T.orangeSoft, borderRadius: 10, padding: 12 }}>
              <Text style={{ fontSize: 13, color: T.charcoal, lineHeight: 19 }}>{qrInfo.rewardMessage}</Text>
            </View>
          )}
        </View>

        {/* Report found form */}
        {reportSent ? (
          <View style={{ backgroundColor: dark ? '#0f2b14' : '#f0fdf4', borderRadius: 14, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: T.green }}>
            <Ionicons name="checkmark-circle" size={32} color={T.green} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.green }}>Owner Notified!</Text>
            <Text style={{ fontSize: 13, color: textMuted(dark), textAlign: 'center', lineHeight: 19 }}>
              The tag owner has been notified. Thank you for your help!
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary(dark) }}>Found this item?</Text>
            <TextInput
              style={{ backgroundColor: cardBg(dark), borderWidth: 1, borderColor: borderColor(dark), borderRadius: 12, padding: 14, color: textPrimary(dark), fontSize: 14 }}
              placeholder="Your contact (phone or email)"
              placeholderTextColor={textMuted(dark)}
              value={finderContact}
              onChangeText={setFinderContact}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={{ backgroundColor: cardBg(dark), borderWidth: 1, borderColor: borderColor(dark), borderRadius: 12, padding: 14, color: textPrimary(dark), fontSize: 14, minHeight: 80, textAlignVertical: 'top' }}
              placeholder="Where did you find it? Any notes for the owner…"
              placeholderTextColor={textMuted(dark)}
              value={finderNotes}
              onChangeText={setFinderNotes}
              multiline
            />
            <TouchableOpacity
              onPress={submitFoundReport}
              disabled={reportSending}
              style={{ backgroundColor: T.orange, borderRadius: 16, paddingVertical: 15, alignItems: 'center', opacity: reportSending ? 0.7 : 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {reportSending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="mail" size={17} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Notify Owner</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isAuthenticated && (
          <TouchableOpacity onPress={() => router.replace('/(app)/tags')} style={{ alignItems: 'center', padding: 12 }}>
            <Text style={{ color: T.orange, fontSize: 14, fontWeight: '600' }}>Go to My Tags</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ── Shared UI components ───────────────────────────────────────────────────────

function ClaimHeader({ dark, onBack, title, cardBg, borderColor, textPrimary }: any) {
  return (
    <View style={{
      backgroundColor: cardBg(dark),
      borderBottomWidth: 1, borderBottomColor: borderColor(dark),
      paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
      flexDirection: 'row', alignItems: 'center', gap: 12,
    }}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={24} color={T.orange} />
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary(dark), flex: 1 }}>{title}</Text>
    </View>
  );
}

function ProgressDots({ step, dark }: { step: number; dark: boolean }) {
  const dots = [0, 1, 2];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4 }}>
      {dots.map((i) => (
        <View
          key={i}
          style={{
            width: i === step ? 20 : 8,
            height: 8, borderRadius: 4,
            backgroundColor: i === step ? T.orange : (dark ? '#2a2f45' : T.line),
          }}
        />
      ))}
    </View>
  );
}

function ConfirmRow({ label, value, dark, textPrimary, textMuted }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <Text style={{ fontSize: 12, color: textMuted(dark), fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 14, color: textPrimary(dark), fontWeight: '600', flex: 2, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function LabeledInput({ label, placeholder, value, onChangeText, keyboardType, autoCapitalize, multiline, dark, cardBg, borderColor, textPrimary, textMuted }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary(dark) }}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: cardBg(dark),
          borderWidth: 1, borderColor: borderColor(dark),
          borderRadius: 12, padding: 14,
          color: textPrimary(dark), fontSize: 14,
          ...(multiline ? { minHeight: 80, textAlignVertical: 'top' } : {}),
        }}
        placeholder={placeholder}
        placeholderTextColor={textMuted(dark)}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'words'}
        multiline={multiline ?? false}
      />
    </View>
  );
}
