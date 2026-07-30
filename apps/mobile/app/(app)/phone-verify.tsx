import { Ionicons } from '@/components/Icon';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { usersService } from '@/services/users.service';
import { authService } from '@/services/auth.service';
import { extractApiErrorMessage } from '@/lib/api-error';

const T = {
  orange:     '#FF7B14',
  orangeDark: '#E2620A',
  orangeSoft: '#FFE9D6',
  creamLight: '#F2F4E5',
  charcoal:   '#232323',
  mute:       '#8a8a8a',
  line:       '#ECECEC',
  green:      '#4CAF7D',
  greenSoft:  '#E8F8EF',
};

function bg(dark: boolean)          { return dark ? '#0f1117' : T.creamLight; }
function cardBg(dark: boolean)      { return dark ? '#1a1d27' : '#ffffff'; }
function border(dark: boolean)      { return dark ? '#2a2f45' : T.line; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean)   { return dark ? '#64748b' : T.mute; }

type Step = 'phone' | 'otp' | 'done';

export default function PhoneVerifyScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const dark = useColorScheme() === 'dark';

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState((user as any)?.phone ?? '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const otpRef = useRef<TextInput>(null);

  async function handleSavePhone() {
    const trimmed = phone.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await usersService.updateProfile({ phone: trimmed });
      await usersService.sendPhoneOtp();
      const updated = await authService.getProfile();
      setUser(updated as any);
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to send OTP'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.trim().length !== 6) return;
    setLoading(true);
    try {
      await usersService.verifyPhoneOtp(otp.trim());
      const updated = await authService.getProfile();
      setUser(updated as any);
      setStep('done');
    } catch (e: any) {
      Alert.alert('Invalid code', extractApiErrorMessage(e, 'Code is wrong or expired'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);
    try {
      await usersService.sendPhoneOtp();
      setOtp('');
      Alert.alert('Sent', 'A new code was sent to your phone.');
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to resend'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg(dark) }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={{
        backgroundColor: cardBg(dark),
        borderBottomWidth: 1, borderBottomColor: border(dark),
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => (step === 'otp' ? setStep('phone') : router.back())}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: dark ? '#1e2236' : T.creamLight,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={20} color={dark ? '#f1f5f9' : T.charcoal} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: textPrimary(dark) }}>
          {step === 'phone' ? 'Phone Number' : step === 'otp' ? 'Enter Code' : 'Verified'}
        </Text>
      </View>

      <View style={{ flex: 1, padding: 24, gap: 20 }}>

        {/* ── Step: phone entry ─────────────────────────────────────────── */}
        {step === 'phone' && (
          <>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: textPrimary(dark) }}>
                Add your number
              </Text>
              <Text style={{ fontSize: 14, color: textMuted(dark), lineHeight: 20 }}>
                We'll send a 6-digit verification code via SMS. Standard rates may apply.
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Phone Number
              </Text>
              <TextInput
                style={{
                  backgroundColor: cardBg(dark),
                  borderWidth: 1, borderColor: border(dark),
                  borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
                  color: textPrimary(dark), fontSize: 18, letterSpacing: 1,
                }}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+1 234 567 8900"
                placeholderTextColor={textMuted(dark)}
                autoFocus
                maxLength={20}
                onSubmitEditing={handleSavePhone}
                returnKeyType="send"
              />
            </View>

            <TouchableOpacity
              onPress={handleSavePhone}
              disabled={loading || !phone.trim()}
              style={{
                backgroundColor: T.orange,
                borderRadius: 14, paddingVertical: 16,
                alignItems: 'center',
                opacity: !phone.trim() ? 0.5 : 1,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Send Code</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {/* ── Step: OTP entry ───────────────────────────────────────────── */}
        {step === 'otp' && (
          <>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: textPrimary(dark) }}>
                Check your messages
              </Text>
              <Text style={{ fontSize: 14, color: textMuted(dark), lineHeight: 20 }}>
                Enter the 6-digit code sent to{' '}
                <Text style={{ color: textPrimary(dark), fontWeight: '600' }}>{phone}</Text>
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Verification Code
              </Text>
              <TextInput
                ref={otpRef}
                style={{
                  backgroundColor: cardBg(dark),
                  borderWidth: 1, borderColor: border(dark),
                  borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
                  color: textPrimary(dark), fontSize: 28, fontWeight: '700',
                  letterSpacing: 8, textAlign: 'center',
                }}
                value={otp}
                onChangeText={(t) => {
                  setOtp(t.replace(/[^0-9]/g, '').slice(0, 6));
                }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="––––––"
                placeholderTextColor={textMuted(dark)}
                onSubmitEditing={handleVerifyOtp}
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              onPress={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
              style={{
                backgroundColor: T.orange,
                borderRadius: 14, paddingVertical: 16,
                alignItems: 'center',
                opacity: otp.length !== 6 ? 0.5 : 1,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Verify</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResend}
              disabled={loading}
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ color: T.orange, fontWeight: '600', fontSize: 14 }}>
                Didn't receive it? Resend code
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step: done ────────────────────────────────────────────────── */}
        {step === 'done' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: dark ? '#0e2a1a' : T.greenSoft,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="checkmark-circle" size={52} color={T.green} />
            </View>

            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: textPrimary(dark) }}>
                Phone verified!
              </Text>
              <Text style={{ fontSize: 14, color: textMuted(dark), textAlign: 'center', lineHeight: 20 }}>
                Your number{' '}
                <Text style={{ color: textPrimary(dark), fontWeight: '600' }}>{phone}</Text>
                {' '}is now verified and linked to your account.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                backgroundColor: T.orange,
                borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40,
                alignItems: 'center', marginTop: 8,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
