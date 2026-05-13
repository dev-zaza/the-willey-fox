import * as Location from 'expo-location';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { emergencyService } from '@/services/emergency.service';
import { useModal } from '@/context/ModalContext';
import { extractApiErrorMessage } from '@/lib/api-error';

// ── In-app confirmation modal (replaces Alert.alert) ─────────────────────────
function SosConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={modal.overlay}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      <View style={modal.card}>
        <View style={modal.iconCircle}>
          <Text style={modal.iconText}>🆘</Text>
        </View>
        <Text style={modal.title}>Send Emergency SOS?</Text>
        <Text style={modal.body}>
          This will immediately alert your emergency contacts and nearby users with your GPS location.
        </Text>
        <TouchableOpacity style={modal.sendBtn} onPress={onConfirm} activeOpacity={0.85}>
          <Text style={modal.sendBtnText}>Send SOS Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={modal.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={modal.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Result toast ─────────────────────────────────────────────────────────────
function SosResultToast({ success, message, onDismiss }: { success: boolean; message: string; onDismiss: () => void }) {
  return (
    <View style={[toast.wrap, success ? toast.wrapSuccess : toast.wrapError]}>
      <Text style={toast.icon}>{success ? '✅' : '⚠️'}</Text>
      <Text style={toast.msg}>{message}</Text>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={toast.dismiss}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main SOS button ───────────────────────────────────────────────────────────
export function SosButton() {
  const { isModalOpen } = useModal();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast_, setToast] = useState<{ success: boolean; message: string } | null>(null);

  function openConfirm() {
    if (loading) return;
    setShowConfirm(true);
  }

  async function fireSos() {
    setShowConfirm(false);
    setLoading(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      const result = await emergencyService.triggerSos({ lat, lng });
      setToast({
        success: true,
        message: `SOS sent to ${result.notifiedCount} contact${result.notifiedCount !== 1 ? 's' : ''}. Help is on the way.`,
      });
    } catch (e: any) {
      const msg: string = extractApiErrorMessage(e, 'Failed to send SOS');
      let friendly = msg;
      if (msg === 'SOS_RATE_LIMIT_EXCEEDED') friendly = 'Too many SOS alerts in 24 hours.';
      else if (msg === 'SOS_COOLDOWN_ACTIVE') friendly = 'Please wait before sending another SOS.';
      setToast({ success: false, message: friendly });
    } finally {
      setLoading(false);
    }
  }

  if (isModalOpen && !showConfirm) return null;

  return (
    <>
      <View style={styles.container} pointerEvents="box-none">
        <TouchableOpacity
          onPress={openConfirm}
          activeOpacity={0.85}
          disabled={loading}
          style={[styles.button, loading && { opacity: 0.7 }]}
          accessibilityLabel="Send emergency SOS"
          accessibilityRole="button"
        >
          <Text style={styles.sosIcon}>{loading ? '⏳' : '🆘'}</Text>
          <Text style={styles.sosLabel}>{loading ? '…' : 'SOS'}</Text>
        </TouchableOpacity>
      </View>

      {showConfirm && (
        <SosConfirmModal
          onConfirm={fireSos}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {toast_ && (
        <SosResultToast
          success={toast_.success}
          message={toast_.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 88,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  sosIcon: {
    fontSize: 18,
    lineHeight: 22,
  },
  sosLabel: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 1,
  },
});

// ── Confirm modal styles ──────────────────────────────────────────────────────
const modal = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  card: {
    width: '82%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 4,
  },
  sendBtn: {
    width: '100%',
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  sendBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
});

// ── Toast styles ──────────────────────────────────────────────────────────────
const toast = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 44,
    left: 16,
    right: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 998,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  wrapSuccess: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  wrapError: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  icon: {
    fontSize: 18,
  },
  msg: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    lineHeight: 18,
  },
  dismiss: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '700',
  },
});
