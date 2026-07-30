import { Ionicons } from '@/components/Icon';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

const T = {
  orange:     '#FF7B14',
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

function ProgressDots({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? T.orange : '#d1d5db' }} />
      ))}
    </View>
  );
}

export default function OnboardGroupScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const { user } = useAuth();

  const defaultName = user?.lastName ? `${user.lastName} Family` : '';
  const [groupName, setGroupName] = useState(defaultName);

  const canContinue = groupName.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg(dark) }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={{
        backgroundColor: cardBg(dark),
        borderBottomWidth: 1, borderBottomColor: borderColor(dark),
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={T.orange} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary(dark) }}>Family Group</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 28, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <ProgressDots step={0} />

        <View style={{ gap: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: textPrimary(dark), textAlign: 'center' }}>
            Name your group
          </Text>
          <Text style={{ fontSize: 14, color: textMuted(dark), textAlign: 'center', lineHeight: 21 }}>
            This is how your group appears to family members and in safety alerts.
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary(dark) }}>Group Name</Text>
          <TextInput
            style={{
              backgroundColor: cardBg(dark),
              borderWidth: 1.5, borderColor: groupName.trim() ? T.orange : borderColor(dark),
              borderRadius: 14, padding: 16,
              color: textPrimary(dark), fontSize: 16, fontWeight: '600',
            }}
            placeholder={`e.g. ${defaultName || 'Smith Family'}`}
            placeholderTextColor={textMuted(dark)}
            value={groupName}
            onChangeText={setGroupName}
            autoFocus
            maxLength={80}
          />
          <Text style={{ fontSize: 11, color: textMuted(dark), textAlign: 'right' }}>{groupName.length}/80</Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            if (!canContinue) return;
            router.push({
              pathname: '/(app)/onboard-members' as any,
              params: { groupName: groupName.trim() },
            });
          }}
          disabled={!canContinue}
          style={{
            backgroundColor: canContinue ? T.orange : '#d1d5db',
            borderRadius: 16, paddingVertical: 16,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
