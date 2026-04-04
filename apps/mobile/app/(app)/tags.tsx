import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import QRCode from 'react-native-qrcode-svg';
import { isQrLimitReached } from '@/lib/api-error';
import { qrService, type QrCode } from '@/services/qr.service';
import { guardiansService, type GuardianMapping } from '@/services/guardians.service';
import { settingsService, type QrTemplateConfig } from '@/services/settings.service';
import { tagCustomizationService, type VisualTheme, type PrintTemplate } from '@/services/tag-customization.service';
import { buildPrintHtml } from '@/lib/generate-print-html';
import { useModal } from '@/context/ModalContext';
import { useAuth } from '@/hooks/useAuth';

const TIER_ORDER = ['free', 'basic', 'premium', 'enterprise'];
function tierIndex(t: string) { return TIER_ORDER.indexOf(t === 'pro' ? 'premium' : t); }

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1');

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? 'https://safetag.app';

type TagCategory = 'pet' | 'bag' | 'key' | 'person' | 'vehicle' | 'other';

const CATEGORY_CONFIG: Record<TagCategory, { label: string; emoji: string; color: string; namePlaceholder: string; descPlaceholder: string }> = {
  pet:     { label: 'Pet / Animal',    emoji: '🐾', color: '#22C55E', namePlaceholder: "Pet's name",                     descPlaceholder: 'Breed, age, vet contact...' },
  bag:     { label: 'Bag / Luggage',   emoji: '🎒', color: '#3B82F6', namePlaceholder: 'Bag description',                descPlaceholder: 'Brand, color, contents...' },
  key:     { label: 'Keys',            emoji: '🔑', color: '#F59E0B', namePlaceholder: 'Key description (e.g. Car keys)', descPlaceholder: 'What they belong to...' },
  person:  { label: 'Person',          emoji: '👦', color: '#F97316', namePlaceholder: "Person's name",                  descPlaceholder: 'Allergies, conditions, emergency info...' },
  vehicle: { label: 'Vehicle',         emoji: '🚗', color: '#8B5CF6', namePlaceholder: 'Vehicle name / plate',           descPlaceholder: 'Make, model, color...' },
  other:   { label: 'Other',           emoji: '🏷️', color: '#6B7280', namePlaceholder: 'Item name',                     descPlaceholder: 'Description, reward info...' },
};

type Step = 'list' | 'register-form' | 'register-success' | 'detail';

export default function TagsScreen() {
  const [tags, setTags] = useState<QrCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('list');
  const [selectedTag, setSelectedTag] = useState<QrCode | null>(null);

  // Form state
  const [newCategory, setNewCategory] = useState<TagCategory>('pet');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newReward, setNewReward] = useState('');
  const [nameError, setNameError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  // Guardian state
  const [guardians, setGuardians] = useState<GuardianMapping[]>([]);
  const [guardiansLoading, setGuardiansLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);

  // QR template config
  const [qrTemplate, setQrTemplate] = useState<QrTemplateConfig | null>(null);
  useEffect(() => { settingsService.getQrTemplate().then(setQrTemplate); }, []);

  // Theme / Print state
  const [visualThemes, setVisualThemes] = useState<VisualTheme[]>([]);
  const [printTemplates, setPrintTemplates] = useState<PrintTemplate[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [selectedPrintTemplate, setSelectedPrintTemplate] = useState<PrintTemplate | null>(null);
  const [settingTheme, setSettingTheme] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [customizationLoaded, setCustomizationLoaded] = useState(false);

  function loadCustomization() {
    if (customizationLoaded) return;
    Promise.all([
      tagCustomizationService.listVisualThemes(),
      tagCustomizationService.listPrintTemplates(),
    ]).then(([themes, templates]) => {
      setVisualThemes(themes);
      setPrintTemplates(templates);
      setCustomizationLoaded(true);
    }).catch(() => {});
  }

  const { setModalOpen } = useModal();
  const { user } = useAuth();
  const userTierIndex = tierIndex(user?.subscriptionTier ?? 'free');
  const colorScheme = useColorScheme();
  const dark = colorScheme === 'dark';

  async function loadTags() {
    try {
      const data = await qrService.list();
      setTags(data);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTags(); }, []);

  async function handleRegister() {
    if (!newName.trim()) { setNameError('Name is required'); return; }
    setSubmitting(true);
    setNameError('');
    setLimitReached(false);
    try {
      const created = await qrService.create({
        name: newName.trim(),
        category: newCategory,
        ownerContactEmail: newEmail.trim() || undefined,
        ownerContactPhone: newPhone.trim() || undefined,
        rewardMessage: newReward.trim() || undefined,
      });
      setTags((prev) => [created, ...prev]);
      setNewName(''); setNewEmail(''); setNewPhone(''); setNewReward('');
      setNewCategory('pet');
      setStep('register-success');
    } catch (e: unknown) {
      if (isQrLimitReached(e)) {
        setLimitReached(true);
      } else {
        Alert.alert('Error', (e as { message?: string })?.message ?? 'Failed to register tag');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkLost(id: string) {
    try {
      const updated = await qrService.markLost(id);
      setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
      if (selectedTag?.id === id) setSelectedTag(updated);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update tag');
    }
  }

  async function handleMarkFound(id: string) {
    try {
      const updated = await qrService.markFound(id);
      setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
      if (selectedTag?.id === id) setSelectedTag(updated);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update tag');
    }
  }

  async function handleDeleteTag(id: string) {
    Alert.alert('Delete Tag', 'Remove this tag? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await qrService.delete(id);
            setTags((prev) => prev.filter((t) => t.id !== id));
            setStep('list');
            setSelectedTag(null);
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to delete tag');
          }
        },
      },
    ]);
  }

  async function loadGuardians(id: string) {
    setGuardiansLoading(true);
    try {
      const data = await guardiansService.list(id);
      setGuardians(data);
    } catch {
      // non-fatal — guardians section just stays empty
    } finally {
      setGuardiansLoading(false);
    }
  }

  async function handleInviteGuardian() {
    if (!selectedTag || !inviteEmail.trim()) return;
    setInviteSending(true);
    try {
      await guardiansService.inviteByEmail(selectedTag.id, inviteEmail.trim());
      setInviteEmail('');
      setShowInviteModal(false);
      setModalOpen(false);
      Alert.alert('Invite Sent', `An invitation has been sent to ${inviteEmail.trim()}.`);
      loadGuardians(selectedTag.id);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'Failed to send invite');
    } finally {
      setInviteSending(false);
    }
  }

  async function handleRejectGuardian(userId: string) {
    if (!selectedTag) return;
    try {
      await guardiansService.reject(selectedTag.id, userId);
      setGuardians((prev) => prev.filter((g) => g.userId !== userId));
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'Failed to reject guardian');
    }
  }

  async function handleRemoveGuardian(userId: string, name: string) {
    if (!selectedTag) return;
    Alert.alert('Remove Guardian', `Remove ${name} as a guardian of this tag?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await guardiansService.remove(selectedTag.id, userId);
            setGuardians((prev) => prev.filter((g) => g.userId !== userId));
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'Failed to remove guardian');
          }
        },
      },
    ]);
  }

  async function handleSetTheme(themeId: string | null) {
    if (!selectedTag || settingTheme) return;
    setSettingTheme(true);
    try {
      await tagCustomizationService.setTheme(selectedTag.id, themeId);
      setSelectedThemeId(themeId);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to set theme');
    } finally {
      setSettingTheme(false);
    }
  }

  async function handlePrint(template: PrintTemplate) {
    if (!selectedTag || printing) return;
    if (!qrSvgRef.current) {
      Alert.alert('Error', 'QR code not ready. Please wait and try again.');
      return;
    }
    setPrinting(true);
    try {
      // Get QR as base64 PNG directly from the rendered SVG — no network call needed
      const base64 = await new Promise<string>((resolve, reject) => {
        qrSvgRef.current!.toDataURL((data) => {
          if (data) resolve(`data:image/png;base64,${data}`);
          else reject(new Error('Failed to render QR code'));
        });
      });

      // Resolve logo: use admin-configured URL, or fall back to bundled asset as base64
      let resolvedLogoUrl: string | null = qrTemplate?.logoUrl ?? null;
      if (!resolvedLogoUrl) {
        try {
          const [asset] = await Asset.loadAsync(require('../../assets/logo.png'));
          // asset.localUri is null in Expo Go — download to cache if needed
          const localUri = asset.localUri ?? (FileSystem.cacheDirectory + 'print_logo.png');
          if (!asset.localUri) {
            await FileSystem.downloadAsync(asset.uri, localUri);
          }
          const logoB64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
          resolvedLogoUrl = `data:image/png;base64,${logoB64}`;
        } catch { /* non-fatal — logo just won't appear */ }
      }

      const html = buildPrintHtml(template, selectedTag, base64, resolvedLogoUrl);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share or print your tag' });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to generate PDF');
    } finally {
      setPrinting(false);
    }
  }

  if (step === 'register-success') {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-surface items-center justify-center px-8" style={{ gap: 16 }}>
        <View className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-500/10 border border-green-300 dark:border-green-500/30 items-center justify-center">
          <Text style={{ fontSize: 36 }}>✅</Text>
        </View>
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">Tag Registered!</Text>
        <Text className="text-gray-500 dark:text-slate-400 text-sm text-center leading-6">
          Your tag is now active. When someone scans your QR code, you'll receive an instant alert.
        </Text>
        <TouchableOpacity
          className="bg-brand-500 rounded-2xl py-4 px-10 items-center w-full mt-4"
          onPress={() => setStep('list')}
        >
          <Text className="text-white font-bold text-base">Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'register-form') {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-gray-50 dark:bg-surface"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="bg-white dark:bg-surface-card border-b border-gray-200 dark:border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => { setStep('list'); setLimitReached(false); }}>
            <Text className="text-brand-500 font-semibold text-sm">← Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1 text-center mr-10">Register Tag</Text>
        </View>
        {limitReached && (
          <View
            className="mx-4 mt-4 rounded-xl p-4 flex-row items-start gap-3"
            style={{
              backgroundColor: dark ? 'rgba(249, 115, 22, 0.12)' : 'rgba(249, 115, 22, 0.08)',
              borderWidth: 1,
              borderColor: dark ? 'rgba(249, 115, 22, 0.3)' : 'rgba(249, 115, 22, 0.25)',
            }}
          >
            <Text style={{ fontSize: 24 }}>🏷️</Text>
            <View className="flex-1" style={{ gap: 4 }}>
              <Text className="text-gray-900 dark:text-white font-semibold text-sm">
                Tag limit reached
              </Text>
              <Text className="text-gray-600 dark:text-slate-400 text-sm leading-5">
                You've reached your free plan limit of 2 tags. Upgrade your plan to register more tags for your valuables.
              </Text>
              <Text className="text-brand-500 text-xs font-medium mt-1">
                Upgrade coming soon
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setLimitReached(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-gray-500 dark:text-slate-500 text-lg">×</Text>
            </TouchableOpacity>
          </View>
        )}
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>
          {/* Category */}
          <View style={{ gap: 10 }}>
            <Text className="text-xs font-semibold text-gray-500 dark:text-slate-300 uppercase tracking-wide">What are you tagging?</Text>
            <View className="flex-row flex-wrap gap-3">
              {(Object.keys(CATEGORY_CONFIG) as TagCategory[]).map((cat) => {
                const c = CATEGORY_CONFIG[cat];
                const selected = newCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setNewCategory(cat)}
                    className="flex-col items-center gap-1 px-4 py-3 rounded-2xl border"
                    style={
                      selected
                        ? { backgroundColor: c.color + '14', borderColor: c.color, minWidth: '44%', flex: 1 }
                        : { backgroundColor: '#fff', borderColor: '#e5e7eb', minWidth: '44%', flex: 1 }
                    }
                  >
                    <Text style={{ fontSize: 24 }}>{c.emoji}</Text>
                    <Text style={{ color: selected ? c.color : '#6b7280', fontSize: 12, fontWeight: '600' }}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Name */}
          <View style={{ gap: 8 }}>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">Name *</Text>
            <TextInput
              className={`bg-white dark:bg-surface-card border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm ${nameError ? 'border-red-500' : 'border-gray-200 dark:border-surface-border'}`}
              placeholder={CATEGORY_CONFIG[newCategory].namePlaceholder}
              placeholderTextColor="#9ca3af"
              value={newName}
              onChangeText={(v) => { setNewName(v); setNameError(''); }}
            />
            {nameError ? <Text className="text-xs text-red-500">{nameError}</Text> : null}
          </View>

          {/* Contact email */}
          <View style={{ gap: 8 }}>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">Contact email (optional)</Text>
            <TextInput
              className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm"
              placeholder="you@email.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              value={newEmail}
              onChangeText={setNewEmail}
            />
          </View>

          {/* Contact phone */}
          <View style={{ gap: 8 }}>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">Contact phone (optional)</Text>
            <TextInput
              className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm"
              placeholder="+1 555 0100"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />
          </View>

          {/* Reward */}
          <View style={{ gap: 8 }}>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">Reward message (optional)</Text>
            <TextInput
              className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm"
              placeholder="$200 reward if returned"
              placeholderTextColor="#9ca3af"
              value={newReward}
              onChangeText={setNewReward}
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: 'top' }}
            />
          </View>
        </ScrollView>

        <View className="bg-white dark:bg-surface-card border-t border-gray-200 dark:border-surface-border px-6 py-4">
          <TouchableOpacity
            className="bg-brand-500 rounded-2xl py-4 items-center"
            onPress={handleRegister}
            disabled={submitting}
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white font-bold text-base">Register Tag</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const qrSvgRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);

  if (step === 'detail' && selectedTag) {
    const cat = selectedTag.category as TagCategory;
    const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.other;
    const isOwner = selectedTag.isOwner !== false; // default true for backward compat
    const pendingGuardians = guardians.filter((g) => g.status === 'pending');
    const activeGuardians = guardians.filter((g) => g.status === 'active');
    const selectedTheme = visualThemes.find((t) => t.id === selectedThemeId) ?? null;
    const accentColor = selectedTheme?.accentColor ?? qrTemplate?.accentColor ?? cfg.color;

    return (
      <View className="flex-1 bg-gray-50 dark:bg-surface">
        <View className="bg-white dark:bg-surface-card border-b border-gray-200 dark:border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => { setStep('list'); setSelectedTag(null); setGuardians([]); }}>
            <Text className="text-brand-500 font-semibold text-sm">← Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1 text-center mr-10">Tag Details</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          {/* Tag header */}
          <View className="items-center" style={{ gap: 8 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: cfg.color + '22', borderColor: cfg.color, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 36 }}>{cfg.emoji}</Text>
            </View>
            <Text className="text-gray-900 dark:text-white font-bold text-xl">{selectedTag.name}</Text>
            <View style={{ backgroundColor: cfg.color + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: cfg.color, fontSize: 12, fontWeight: '700' }}>{cfg.label}</Text>
            </View>
            {selectedTag.isLost && (
              <View className="bg-red-500/20 rounded-lg px-3 py-1">
                <Text className="text-red-400 text-xs font-semibold">MARKED AS LOST</Text>
              </View>
            )}
            {!isOwner && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#3B82F611', borderWidth: 1, borderColor: '#3B82F630', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 14 }}>🛡️</Text>
                <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }}>You're a Guardian of this tag</Text>
              </View>
            )}
          </View>

          {/* QR code card — template-aware */}
          <View
            className="rounded-2xl overflow-hidden"
            style={{ borderWidth: 1, borderColor: accentColor + '44', backgroundColor: accentColor + '08' }}
          >
            {/* QR code */}
            <View className="px-4 py-4 items-center" style={{ gap: 10, borderBottomWidth: 1, borderBottomColor: accentColor + '22' }}>
              {qrTemplate?.showCategory && (
                <View style={{ backgroundColor: accentColor + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: accentColor, fontSize: 11, fontWeight: '700' }}>{cfg.label}</Text>
                </View>
              )}
              <View className="bg-white p-4 rounded-xl border border-gray-100">
                <QRCode
                  value={`${WEB_URL}/q/${selectedTag.uniqueCode}`}
                  size={160}
                  backgroundColor="white"
                  color="#000"
                  getRef={(ref) => { (qrSvgRef as any).current = ref; }}
                />
              </View>
              <Text style={{ color: accentColor, fontFamily: 'monospace', fontWeight: '600', fontSize: 13 }}>
                {selectedTag.uniqueCode}
              </Text>
              {qrTemplate?.footerText ? (
                <Text className="text-xs text-gray-400 dark:text-slate-500 text-center">{qrTemplate.footerText}</Text>
              ) : null}
            </View>

            {qrTemplate?.showOwnerContact && selectedTag.ownerContactEmail && (
              <View className="px-4 py-3.5" style={{ borderBottomWidth: 1, borderBottomColor: accentColor + '22' }}>
                <Text className="text-xs text-gray-500 dark:text-slate-500 mb-1">Contact Email</Text>
                <Text className="text-gray-900 dark:text-white text-sm">{selectedTag.ownerContactEmail}</Text>
              </View>
            )}
            {qrTemplate?.showReward && selectedTag.rewardMessage && (
              <View className="px-4 py-3.5" style={{ borderBottomWidth: 1, borderBottomColor: accentColor + '22' }}>
                <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>🎁 {selectedTag.rewardMessage}</Text>
              </View>
            )}
            <View className="px-4 py-3.5">
              <Text className="text-xs text-gray-500 dark:text-slate-500 mb-1">Registered</Text>
              <Text className="text-gray-900 dark:text-white text-sm">{new Date(selectedTag.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>

          {/* ── Visual Theme Picker ── */}
          <View style={{ gap: 10 }}>
            <Text className="text-sm font-bold text-gray-900 dark:text-white">Finder Page Theme</Text>
            {!customizationLoaded ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                {/* Default / None */}
                <TouchableOpacity
                  onPress={() => handleSetTheme(null)}
                  disabled={settingTheme}
                  style={{
                    alignItems: 'center',
                    gap: 4,
                    padding: 8,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: selectedThemeId === null ? accentColor : '#e5e7eb',
                    backgroundColor: selectedThemeId === null ? accentColor + '11' : 'transparent',
                    minWidth: 60,
                  }}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: '#9ca3af', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, color: '#9ca3af' }}>✕</Text>
                  </View>
                  <Text style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>Default</Text>
                </TouchableOpacity>

                {visualThemes.map((theme) => {
                  const locked = tierIndex(theme.tierRequired) > userTierIndex;
                  const isSelected = selectedThemeId === theme.id;
                  return (
                    <TouchableOpacity
                      key={theme.id}
                      onPress={() => {
                        if (locked) {
                          Alert.alert('Upgrade Required', `This theme requires the ${theme.tierRequired} plan.`);
                          return;
                        }
                        handleSetTheme(theme.id);
                      }}
                      disabled={settingTheme}
                      style={{
                        alignItems: 'center',
                        gap: 4,
                        padding: 8,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isSelected ? theme.accentColor : '#e5e7eb',
                        backgroundColor: isSelected ? theme.accentColor + '11' : 'transparent',
                        minWidth: 60,
                        opacity: locked ? 0.55 : 1,
                      }}
                    >
                      <View style={{ position: 'relative' }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.accentColor, borderWidth: 2, borderColor: '#fff' }} />
                        {locked && (
                          <View style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 7, color: '#fff' }}>🔒</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 9, color: '#6b7280', textAlign: 'center', maxWidth: 56 }} numberOfLines={1}>{theme.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            {settingTheme && <Text style={{ fontSize: 11, color: '#9ca3af' }}>Saving…</Text>}
          </View>

          {/* ── Print Tag ── */}
          {isOwner && (
            <View style={{ gap: 10 }}>
              <Text className="text-sm font-bold text-gray-900 dark:text-white">Print Physical Tag</Text>
              {!customizationLoaded ? (
                <ActivityIndicator size="small" color="#f97316" />
              ) : printTemplates.length === 0 ? (
                <Text style={{ fontSize: 12, color: '#9ca3af' }}>No print templates available.</Text>
              ) : (
                <>
                  {/* Template selector */}
                  <View className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl overflow-hidden">
                    {printTemplates.map((pt, idx) => {
                      const isSelected = selectedPrintTemplate?.id === pt.id;
                      const isLast = idx === printTemplates.length - 1;
                      return (
                        <TouchableOpacity
                          key={pt.id}
                          onPress={() => setSelectedPrintTemplate(isSelected ? null : pt)}
                          className={`px-4 py-3.5 flex-row items-center justify-between${!isLast ? ' border-b border-gray-100 dark:border-surface-border' : ''}`}
                          style={{ backgroundColor: isSelected ? accentColor + '10' : 'transparent' }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: isSelected ? accentColor : '#d1d5db', backgroundColor: isSelected ? accentColor : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                              {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                            </View>
                            <View>
                              <Text className="text-gray-900 dark:text-white font-semibold text-sm">{pt.name}</Text>
                              <Text className="text-gray-500 dark:text-slate-500 text-xs capitalize">{pt.formatType} format</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Inline print preview + print button */}
                  {selectedPrintTemplate && (() => {
                    const pt = selectedPrintTemplate;
                    const slots = pt.textSlots ?? {};
                    const FORMAT_W: Record<string, number> = { square: 300, rectangle: 400, wristband: 500 };
                    const FORMAT_H: Record<string, number> = { square: 300, rectangle: 250, wristband: 120 };
                    const natW = FORMAT_W[pt.formatType] ?? 300;
                    const natH = FORMAT_H[pt.formatType] ?? 300;
                    const maxW = 260;
                    const scale = maxW / natW;
                    const previewW = maxW;
                    const previewH = Math.round(natH * scale);
                    const pad = 10;
                    const LOGO_ICON = 28;   // icon part of the brand lockup
                    const LOGO_ROW_H = 36;  // total height of the logo row
                    const qrPreviewSize = Math.round(pt.qrSize * scale);
                    const isWristband = pt.formatType === 'wristband';
                    const showLogo = pt.logoPlacement !== 'none';
                    const logoRowJustify =
                      pt.logoPlacement === 'top-right' ? 'flex-end' as const :
                      pt.logoPlacement === 'center' ? 'center' as const : 'flex-start' as const;

                    // Brand lockup: icon + name text side by side
                    const logoImg = (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Image
                          source={require('../../assets/logo.png')}
                          style={{ width: LOGO_ICON, height: LOGO_ICON, resizeMode: 'contain' }}
                        />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#f97316', letterSpacing: 0.3 }}>TheWileyfox</Text>
                      </View>
                    );

                    const qrBlock = (
                      <View style={{ width: qrPreviewSize, height: qrPreviewSize, backgroundColor: '#fff', borderRadius: 4 }}>
                        <QRCode
                          value={`${WEB_URL}/q/${selectedTag.uniqueCode}`}
                          size={qrPreviewSize}
                          backgroundColor="white"
                          color="#000"
                        />
                      </View>
                    );

                    const cardBase = {
                      width: previewW,
                      backgroundColor: pt.backgroundColor,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#d1d5db',
                      shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 }, elevation: 3,
                    };

                    return (
                      <View style={{ gap: 10 }}>
                        <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Preview</Text>

                        <View style={{ alignItems: 'center' }}>
                          {isWristband ? (
                            // ── Wristband: brand | text | QR in a horizontal row ──
                            <View style={{ ...cardBase, height: previewH, flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, gap: 8 }}>
                              {/* Always show brand lockup in wristband */}
                              {logoImg}
                              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                                {slots.showTagName && (
                                  <Text numberOfLines={1} style={{ fontSize: Math.max(Math.round(11 * scale), 9), fontWeight: '700', color: '#111' }}>{selectedTag.name}</Text>
                                )}
                                {slots.showInstructions && slots.instructionsText && (
                                  <Text numberOfLines={1} style={{ fontSize: Math.max(Math.round(9 * scale), 7), color: '#666' }}>{slots.instructionsText}</Text>
                                )}
                              </View>
                              {qrBlock}
                            </View>
                          ) : (
                            // ── Square / Rectangle: centered logo row on top, then centered content ──
                            <View style={{ ...cardBase, minHeight: previewH, flexDirection: 'column' }}>
                              {/* Logo row — centered, fixed height */}
                              <View style={{ height: showLogo ? LOGO_ROW_H + pad : pad, paddingHorizontal: pad, paddingTop: showLogo ? pad : 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                                {showLogo && logoImg}
                              </View>

                              {/* Content: QR + text, vertically centered in remaining space */}
                              <View style={{
                                flex: 1, alignItems: 'center', paddingHorizontal: pad, paddingBottom: pad, gap: 6,
                                justifyContent: pt.qrPosition === 'top' ? 'flex-start' : pt.qrPosition === 'bottom' ? 'flex-end' : 'center',
                              }}>
                                {slots.tagNamePosition === 'top' && slots.showTagName && (
                                  <Text numberOfLines={1} style={{ fontSize: Math.round(12 * scale), fontWeight: '700', color: '#111' }}>{selectedTag.name}</Text>
                                )}
                                {qrBlock}
                                {slots.tagNamePosition !== 'top' && slots.showTagName && (
                                  <Text numberOfLines={1} style={{ fontSize: Math.round(12 * scale), fontWeight: '700', color: '#111' }}>{selectedTag.name}</Text>
                                )}
                                {slots.showInstructions && slots.instructionsText && (
                                  <Text numberOfLines={2} style={{ fontSize: Math.round(9 * scale), color: '#666', textAlign: 'center' }}>{slots.instructionsText}</Text>
                                )}
                                {slots.showReward && selectedTag.rewardMessage && (
                                  <Text numberOfLines={1} style={{ fontSize: Math.round(9 * scale), color: '#22c55e', fontWeight: '600' }}>Reward: {selectedTag.rewardMessage}</Text>
                                )}
                              </View>
                            </View>
                          )}
                        </View>

                        {/* Print button */}
                        <TouchableOpacity
                          onPress={() => handlePrint(pt)}
                          disabled={printing}
                          className="rounded-xl py-3.5 items-center flex-row justify-center gap-2"
                          style={{ backgroundColor: accentColor, opacity: printing ? 0.7 : 1 }}
                        >
                          {printing ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <>
                              <Text style={{ fontSize: 16 }}>🖨️</Text>
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Print / Share PDF</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
                </>
              )}
            </View>
          )}

          {/* ── Guardians Section ── */}
          <View style={{ gap: 12 }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-gray-900 dark:text-white">Guardians</Text>
              {isOwner && (
                <TouchableOpacity
                  onPress={() => { setShowInviteModal(true); setModalOpen(true); }}
                  className="bg-brand-500/10 border border-brand-500/30 rounded-lg px-3 py-1.5"
                >
                  <Text className="text-brand-500 font-semibold text-xs">+ Invite</Text>
                </TouchableOpacity>
              )}
            </View>

            {guardiansLoading ? (
              <ActivityIndicator color="#f97316" size="small" />
            ) : guardians.length === 0 ? (
              <View className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl px-4 py-5 items-center" style={{ gap: 6 }}>
                <Text style={{ fontSize: 24 }}>🛡️</Text>
                <Text className="text-sm text-gray-500 dark:text-slate-400 text-center">
                  No guardians yet. Invite trusted people to watch over this tag.
                </Text>
              </View>
            ) : (
              <View className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl overflow-hidden">
                {pendingGuardians.length > 0 && (
                  <>
                    <View className="px-4 py-2 bg-yellow-50 dark:bg-yellow-500/10 border-b border-gray-100 dark:border-surface-border">
                      <Text className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">Pending Requests</Text>
                    </View>
                    {pendingGuardians.map((g) => {
                      const name = g.user ? `${g.user.firstName} ${g.user.lastName}` : g.userId;
                      return (
                        <View key={g.id} className="px-4 py-3 flex-row items-center gap-3 border-b border-gray-100 dark:border-surface-border">
                          <View className="w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-700 items-center justify-center">
                            <Text className="text-sm font-bold text-gray-600 dark:text-slate-300">
                              {g.user ? `${g.user.firstName[0]}${g.user.lastName[0]}` : '?'}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-medium text-gray-900 dark:text-white">{name}</Text>
                            {g.user?.email && <Text className="text-xs text-gray-500 dark:text-slate-400">{g.user.email}</Text>}
                          </View>
                          <View className="flex-row gap-2">
                            <TouchableOpacity
                              onPress={() => handleRejectGuardian(g.userId)}
                              className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5"
                            >
                              <Text className="text-red-500 text-xs font-semibold">Reject</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
                {activeGuardians.length > 0 && (
                  <>
                    <View className="px-4 py-2 bg-green-50 dark:bg-green-500/10 border-b border-gray-100 dark:border-surface-border">
                      <Text className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Active Guardians</Text>
                    </View>
                    {activeGuardians.map((g, idx) => {
                      const name = g.user ? `${g.user.firstName} ${g.user.lastName}` : g.userId;
                      const isLast = idx === activeGuardians.length - 1;
                      return (
                        <View key={g.id} className={`px-4 py-3 flex-row items-center gap-3 ${!isLast ? 'border-b border-gray-100 dark:border-surface-border' : ''}`}>
                          <View className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-500/20 items-center justify-center">
                            <Text className="text-sm font-bold text-green-600 dark:text-green-400">
                              {g.user ? `${g.user.firstName[0]}${g.user.lastName[0]}` : '?'}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-medium text-gray-900 dark:text-white">{name}</Text>
                            {g.user?.email && <Text className="text-xs text-gray-500 dark:text-slate-400">{g.user.email}</Text>}
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRemoveGuardian(g.userId, name)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text className="text-gray-400 dark:text-slate-500 text-lg">×</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}
          </View>

          {/* Tag actions — owner only */}
          {isOwner && (
            <View style={{ gap: 10 }}>
              {selectedTag.isLost ? (
                <TouchableOpacity
                  className="bg-green-500/10 border border-green-500/30 rounded-xl py-3.5 items-center"
                  onPress={() => handleMarkFound(selectedTag.id)}
                >
                  <Text className="text-green-500 font-semibold text-sm">Mark as Found</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  className="bg-red-500/10 border border-red-500/30 rounded-xl py-3.5 items-center"
                  onPress={() => handleMarkLost(selectedTag.id)}
                >
                  <Text className="text-red-500 font-semibold text-sm">Mark as Lost</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="border border-red-200 dark:border-red-500/30 rounded-xl py-3.5 items-center"
                onPress={() => handleDeleteTag(selectedTag.id)}
              >
                <Text className="text-red-500 dark:text-red-400 font-semibold text-sm">Remove Tag</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Invite Guardian Modal */}
        <Modal visible={showInviteModal} transparent animationType="slide" onRequestClose={() => { setShowInviteModal(false); setModalOpen(false); }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => { setShowInviteModal(false); setModalOpen(false); }} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View
              className="bg-white dark:bg-surface-card border-t border-gray-200 dark:border-surface-border"
              style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 }}
            >
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 4 }} />
              <Text className="text-lg font-bold text-gray-900 dark:text-white">Invite a Guardian</Text>
              <Text className="text-sm text-gray-500 dark:text-slate-400 leading-5">
                Enter the email address of someone you trust. They'll receive an invite to become a guardian of "{selectedTag.name}".
              </Text>
              <TextInput
                className="bg-gray-50 dark:bg-surface border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm"
                placeholder="guardian@email.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
                value={inviteEmail}
                onChangeText={setInviteEmail}
              />
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 border border-gray-200 dark:border-surface-border rounded-xl py-3.5 items-center"
                  onPress={() => { setShowInviteModal(false); setModalOpen(false); setInviteEmail(''); }}
                >
                  <Text className="text-gray-600 dark:text-slate-300 font-semibold text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-brand-500 rounded-xl py-3.5 items-center"
                  onPress={handleInviteGuardian}
                  disabled={inviteSending || !inviteEmail.trim()}
                  style={{ opacity: !inviteEmail.trim() ? 0.5 : 1 }}
                >
                  {inviteSending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-bold text-sm">Send Invite</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-surface">
      <View className="bg-white dark:bg-surface-card border-b border-gray-200 dark:border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
        <Image source={require('../../assets/logo.png')} style={{ width: 28, height: 28, borderRadius: 7 }} resizeMode="contain" />
        <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1">My Tags</Text>
        <TouchableOpacity
          onPress={() => setStep('register-form')}
          className="bg-brand-500/10 border border-brand-500/30 rounded-lg px-3 py-1.5"
        >
          <Text className="text-brand-500 font-semibold text-xs">+ Register</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : tags.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" style={{ gap: 16 }}>
          <Text style={{ fontSize: 36 }}>🏷️</Text>
          <Text className="text-xl font-bold text-gray-900 dark:text-white">No Tags Yet</Text>
          <Text className="text-gray-500 dark:text-slate-400 text-sm text-center leading-6">Register a tag for your pet, bag, keys, or valuables.</Text>
          <TouchableOpacity
            className="bg-brand-500 rounded-2xl py-3.5 px-8 items-center w-full"
            onPress={() => setStep('register-form')}
          >
            <Text className="text-white font-semibold text-sm">Register Your First Tag</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tags}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const cat = item.category as TagCategory;
            const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.other;
            return (
              <TouchableOpacity
                onPress={() => { setSelectedTag(item); setSelectedThemeId(item.themeId ?? null); setSelectedPrintTemplate(null); setStep('detail'); loadGuardians(item.id); loadCustomization(); }}
                className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-2xl p-4 flex-row items-center gap-4"
              >
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: cfg.color + '22', borderColor: cfg.color, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>{cfg.emoji}</Text>
                </View>
                <View className="flex-1" style={{ gap: 2 }}>
                  <Text className="text-gray-900 dark:text-white font-semibold text-sm">{item.name}</Text>
                  <Text className="text-gray-500 dark:text-slate-500 text-xs">{cfg.label}</Text>
                  <Text className="text-brand-500/70 font-mono text-xs mt-0.5">{item.uniqueCode}</Text>
                </View>
                {item.isLost && (
                  <View className="bg-red-500/20 rounded px-2 py-0.5">
                    <Text className="text-red-400 text-xs font-bold">LOST</Text>
                  </View>
                )}
                {item.isOwner === false && (
                  <View style={{ backgroundColor: '#3B82F611', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: '#3B82F6', fontSize: 9, fontWeight: '700' }}>GUARDIAN</Text>
                  </View>
                )}
                <Text className="text-gray-400 dark:text-slate-600 text-lg">›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
