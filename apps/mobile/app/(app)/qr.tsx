import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'react-native';
import { apiClient } from '@/services/api';
import { useModal } from '@/context/ModalContext';

interface QrPublicInfo {
  id?: string;
  uniqueCode: string;
  status?: string;
  category?: string;
  name?: string;
  description?: string;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
  isLost?: boolean;
}

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  pet: { label: 'Pet / Animal', emoji: '🐾', color: '#22C55E' },
  bag: { label: 'Bag / Luggage', emoji: '🎒', color: '#F97316' },
  key: { label: 'Keys', emoji: '🔑', color: '#EAB308' },
  person: { label: 'Person', emoji: '👤', color: '#3B82F6' },
  vehicle: { label: 'Vehicle', emoji: '🚗', color: '#8B5CF6' },
  other: { label: 'Item / Property', emoji: '📦', color: '#64748b' },
  medical: { label: 'Medical ID', emoji: '🏥', color: '#EF4444' },
};

function extractCode(url: string): string | null {
  const match = url.match(/\/q\/([A-Z0-9-]+)/i);
  return match ? match[1].toUpperCase() : null;
}

export default function QrScreen() {
  const { pendingCode } = useLocalSearchParams<{ pendingCode?: string }>();
  const { setModalOpen } = useModal();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [tagResult, setTagResult] = useState<QrPublicInfo | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [finderContact, setFinderContact] = useState('');
  const [finderNotes, setFinderNotes] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);

  // Auto-lookup when opened via deep link
  useEffect(() => {
    if (!pendingCode) return;
    lookupCode(pendingCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCode]);

  async function lookupCode(code: string) {
    setFetching(true);
    try {
      const res = await apiClient.get<QrPublicInfo>(`/public/q/${code}`);
      const info = res.data;

      if (info.status === 'unclaimed') {
        Alert.alert(
          'Unregistered Tag',
          `This tag (${code}) hasn't been registered yet. Open it in a browser to register it on the Wileyfox platform.`,
          [{ text: 'OK', onPress: () => setScanning(false) }],
        );
      } else {
        setTagResult(info);
        setModalOpen(true);
      }
    } catch {
      Alert.alert(
        'Tag Not Found',
        `Code: ${code}\n\nThis QR code is not registered on the Wileyfox platform.`,
        [{ text: 'Scan again', onPress: () => setScanning(true) }],
      );
    } finally {
      setFetching(false);
    }
  }

  async function handleScan({ data }: { data: string; type: string }) {
    if (!scanning || fetching) return;
    setScanning(false);
    const code = extractCode(data) ?? data.toUpperCase().trim();
    await lookupCode(code);
  }

  async function handleScanFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library to scan a QR code image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    setFetching(true);
    try {
      const scanned = await scanFromURLAsync(result.assets[0].uri, ['qr']);
      if (!scanned.length) {
        Alert.alert('No QR Found', 'Could not detect a QR code in the selected image. Try a clearer photo.');
        return;
      }
      const raw = scanned[0].data;
      const code = extractCode(raw) ?? raw.toUpperCase().trim();
      await lookupCode(code);
    } catch {
      Alert.alert('Error', 'Failed to scan image. Please try again.');
    } finally {
      setFetching(false);
    }
  }

  async function handleSendReport() {
    if (!tagResult?.uniqueCode) return;
    if (!finderContact.trim()) {
      Alert.alert('Contact required', 'Please enter your email or phone so the owner can reach you.');
      return;
    }
    setReportLoading(true);
    try {
      const res = await apiClient.post<{ id: string }>(`/public/q/${tagResult.uniqueCode}/report`, {
        finderContact: finderContact.trim(),
        finderNotes: finderNotes.trim() || 'Found and scanned with the Wileyfox mobile app.',
      });
      setReportId(res.data?.id ?? null);
      setShowReportForm(false);
      setReportSent(true);
    } catch {
      Alert.alert('Error', 'Failed to send report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  }

  async function handlePhotoUpload() {
    if (!reportId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setPhotoUploading(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: `report_photo_${Date.now()}.jpg` } as any);
      await apiClient.post(`/public/reports/${reportId}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotoUploaded(true);
    } catch {
      Alert.alert('Upload failed', 'Could not upload photo, but your report was sent successfully.');
    } finally {
      setPhotoUploading(false);
    }
  }

  function handleClose() {
    setTagResult(null);
    setModalOpen(false);
    setReportSent(false);
    setReportId(null);
    setShowReportForm(false);
    setFinderContact('');
    setFinderNotes('');
    setPhotoUploaded(false);
    setScanning(false);
  }

  const categoryInfo = tagResult?.category
    ? (CATEGORY_CONFIG[tagResult.category] ?? CATEGORY_CONFIG.other)
    : CATEGORY_CONFIG.other;

  // Permission denied
  if (permission && !permission.granted) {
    return (
      <View className="flex-1 bg-surface">
        <View className="bg-surface-card border-b border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 28, height: 28, borderRadius: 7 }}
            resizeMode="contain"
          />
          <Text className="text-lg font-bold text-white">QR Scanner</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8" style={{ gap: 16 }}>
          <View className="w-20 h-20 rounded-full bg-brand-500/10 border border-brand-500/20 items-center justify-center">
            <Text style={{ fontSize: 36 }}>📷</Text>
          </View>
          <Text className="text-xl font-bold text-white text-center">Camera Access Needed</Text>
          <Text className="text-sm text-slate-400 text-center leading-6">
            To scan Wileyfox QR tags, please grant camera permission in your device settings.
          </Text>
          <TouchableOpacity
            className="bg-brand-500 rounded-xl py-3.5 px-8 items-center w-full"
            onPress={() => Linking.openSettings()}
          >
            <Text className="text-white font-semibold text-sm">Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main idle state
  if (!scanning) {
    return (
      <View className="flex-1 bg-surface">
        <View className="bg-surface-card border-b border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 28, height: 28, borderRadius: 7 }}
            resizeMode="contain"
          />
          <Text className="text-lg font-bold text-white">QR Scanner</Text>
        </View>

        <View className="flex-1 items-center justify-center px-8" style={{ gap: 20 }}>
          <View className="w-24 h-24 rounded-full bg-brand-500/10 border border-brand-500/20 items-center justify-center">
            <Text style={{ fontSize: 44 }}>📷</Text>
          </View>

          <View style={{ gap: 8, alignItems: 'center' }}>
            <Text className="text-xl font-bold text-white">Scan a Wileyfox Tag</Text>
            <Text className="text-sm text-slate-400 text-center leading-6">
              Found a lost item with a QR tag? Scan it to notify the owner instantly.
            </Text>
          </View>

          <TouchableOpacity
            className="bg-brand-500 rounded-2xl py-4 px-10 items-center w-full"
            onPress={async () => {
              if (!permission?.granted) {
                await requestPermission();
              }
              setScanning(true);
            }}
          >
            <Text className="text-white font-bold text-base">Open Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="border border-brand-500/40 rounded-2xl py-3.5 px-10 items-center w-full flex-row justify-center gap-2"
            onPress={handleScanFromGallery}
            disabled={fetching}
          >
            {fetching ? (
              <ActivityIndicator color="#f97316" size="small" />
            ) : (
              <>
                <Text style={{ fontSize: 16 }}>🖼️</Text>
                <Text className="text-brand-500 font-semibold text-sm">Upload QR from Gallery</Text>
              </>
            )}
          </TouchableOpacity>

          <View className="w-full bg-surface-card border border-surface-border rounded-2xl p-4" style={{ gap: 12 }}>
            <Text className="text-xs font-semibold text-slate-500 uppercase">How it works</Text>
            {[
              { emoji: '📱', text: 'Point camera at the QR tag on the item' },
              { emoji: '🔔', text: 'Owner is notified automatically' },
              { emoji: '💬', text: 'You can send them a message or your location' },
            ].map(({ emoji, text }) => (
              <View key={text} className="flex-row items-center gap-3">
                <Text style={{ fontSize: 18 }}>{emoji}</Text>
                <Text className="text-sm text-slate-300 flex-1">{text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // Camera scanning view
  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScan}
      />

      {/* Overlay */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {/* Top bar */}
        <View style={{ paddingTop: 56, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={() => setScanning(false)}
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Scan QR Tag</Text>
          <View style={{ width: 72 }} />
        </View>

        {/* Viewfinder */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 240,
              height: 240,
              borderColor: '#f97316',
              borderWidth: 2,
              borderRadius: 16,
            }}
          >
            {[
              { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
              { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
              { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
              { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },
            ].map((style, i) => (
              <View
                key={i}
                style={[{ position: 'absolute', width: 24, height: 24, borderColor: '#f97316', borderRadius: 4 }, style]}
              />
            ))}
          </View>
          {fetching ? (
            <View style={{ marginTop: 20, alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="#f97316" />
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Looking up tag…</Text>
            </View>
          ) : (
            <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 20, fontSize: 13, textAlign: 'center' }}>
              Hold steady over the Wileyfox QR tag
            </Text>
          )}
        </View>
      </View>

      {/* Tag result modal */}
      <Modal visible={!!tagResult} transparent animationType="slide" onRequestClose={handleClose}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        {tagResult && (
          <View
            style={{
              backgroundColor: '#1a1d27',
              borderTopWidth: 1,
              borderTopColor: '#2a2f45',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: 40,
              gap: 16,
            }}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#2a2f45', alignSelf: 'center', marginBottom: 8 }} />

            {reportSent ? (
              /* ── Step 3: Success + optional photo upload ── */
              <View style={{ gap: 16, paddingVertical: 4 }}>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 48 }}>✅</Text>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>Report Sent!</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
                    The owner has been notified. Thank you for helping reunite them!
                  </Text>
                </View>
                {reportId && !photoUploaded && (
                  <View style={{ backgroundColor: '#21263a', borderRadius: 16, borderWidth: 1, borderColor: '#2a2f45', padding: 16, gap: 10 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                      Want to attach a photo as proof? (optional)
                    </Text>
                    <TouchableOpacity
                      onPress={handlePhotoUpload}
                      disabled={photoUploading}
                      style={{ backgroundColor: '#21263a', borderWidth: 1, borderColor: '#f97316', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                    >
                      {photoUploading ? (
                        <ActivityIndicator color="#f97316" />
                      ) : (
                        <Text style={{ color: '#f97316', fontWeight: '600', fontSize: 14 }}>📷 Attach a Photo</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                {photoUploaded && (
                  <View style={{ backgroundColor: '#22C55E11', borderWidth: 1, borderColor: '#22C55E55', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#22C55E', fontWeight: '600', fontSize: 13 }}>📸 Photo attached!</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={handleClose}
                  style={{ backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : showReportForm ? (
              /* ── Step 2: Report form ── */
              <View style={{ gap: 14 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Report Found Item</Text>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>Your contact (email or phone) *</Text>
                  <TextInput
                    value={finderContact}
                    onChangeText={setFinderContact}
                    placeholder="so the owner can reach you"
                    placeholderTextColor="#475569"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{ backgroundColor: '#21263a', borderWidth: 1, borderColor: '#2a2f45', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: '#fff', fontSize: 14 }}
                  />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>Notes (optional)</Text>
                  <TextInput
                    value={finderNotes}
                    onChangeText={setFinderNotes}
                    placeholder="Where did you find it? Any details..."
                    placeholderTextColor="#475569"
                    multiline
                    numberOfLines={3}
                    style={{ backgroundColor: '#21263a', borderWidth: 1, borderColor: '#2a2f45', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: '#fff', fontSize: 14, minHeight: 72, textAlignVertical: 'top' }}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleSendReport}
                  disabled={reportLoading || !finderContact.trim()}
                  style={{ backgroundColor: !finderContact.trim() ? '#374151' : '#f97316', borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: !finderContact.trim() ? 0.6 : 1 }}
                >
                  {reportLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Send Report</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowReportForm(false)} style={{ alignItems: 'center', paddingVertical: 8 }}>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>← Back</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Step 1: Tag info + action ── */
              <>
                {/* Tag header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: categoryInfo.color + '22',
                      borderColor: categoryInfo.color,
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{categoryInfo.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: categoryInfo.color, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }}>
                      {categoryInfo.label}
                    </Text>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>{tagResult.name || tagResult.uniqueCode}</Text>
                    <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>Tag #{tagResult.uniqueCode}</Text>
                  </View>
                </View>

                {/* Lost banner */}
                {tagResult.isLost && (
                  <View style={{ backgroundColor: '#dc262611', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 12, padding: 12 }}>
                    <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 13 }}>⚠️ Reported Lost — Owner is looking for this!</Text>
                  </View>
                )}

                {/* Details card */}
                <View style={{ backgroundColor: '#21263a', borderRadius: 16, borderWidth: 1, borderColor: '#2a2f45', overflow: 'hidden' }}>
                  {tagResult.description && (
                    <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: '#2a2f45', backgroundColor: tagResult.category === 'medical' ? '#EF444411' : undefined }}>
                      <Text style={{ color: tagResult.category === 'medical' ? '#EF4444' : '#94a3b8', fontSize: 12, fontWeight: tagResult.category === 'medical' ? '700' : '400', marginBottom: 4 }}>
                        {tagResult.category === 'medical' ? '🚨 Medical / Emergency Info' : 'Description'}
                      </Text>
                      <Text style={{ color: '#fff', fontSize: 14 }}>{tagResult.description}</Text>
                    </View>
                  )}
                  {tagResult.rewardMessage && (
                    <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: '#2a2f45', backgroundColor: '#22C55E11' }}>
                      <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '700', marginBottom: 2 }}>🎁 {tagResult.rewardMessage}</Text>
                    </View>
                  )}
                  {(tagResult.ownerContactEmail || tagResult.ownerContactPhone) && (
                    <View style={{ padding: 14 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Contact Owner</Text>
                      {tagResult.ownerContactEmail && (
                        <Text style={{ color: '#60a5fa', fontSize: 14 }}>📧 {tagResult.ownerContactEmail}</Text>
                      )}
                      {tagResult.ownerContactPhone && (
                        <Text style={{ color: '#60a5fa', fontSize: 14, marginTop: 2 }}>📞 {tagResult.ownerContactPhone}</Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Action */}
                <TouchableOpacity
                  onPress={() => setShowReportForm(true)}
                  style={{ backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Report Found — Notify Owner</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleClose}
                  style={{ alignItems: 'center', paddingVertical: 10 }}
                >
                  <Text style={{ color: '#64748b', fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}
