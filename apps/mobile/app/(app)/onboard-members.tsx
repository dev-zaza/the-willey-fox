import { Ionicons } from '@/components/Icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { familiesService } from '@/services/families.service';
import { qrService } from '@/services/qr.service';
import { extractApiErrorMessage } from '@/lib/api-error';

const T = {
  orange:     '#FF7B14',
  orangeSoft: '#FFE9D6',
  purple:     '#6A3FB4',
  purpleSoft: '#F0EBFC',
  green:      '#3FA34D',
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

const QUICK_ADD = [
  { label: 'Partner', icon: 'heart', category: 'person' as const },
  { label: 'Child',   icon: 'happy', category: 'person' as const },
  { label: 'Parent',  icon: 'people', category: 'person' as const },
  { label: 'Pet',     icon: 'paw',   category: 'pet' as const },
];

interface DraftMember {
  name: string;
  relationship: string;
  category: 'person' | 'pet' | 'bag' | 'key' | 'vehicle' | 'other';
}

export default function OnboardMembersScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const { groupName } = useLocalSearchParams<{ groupName: string }>();

  const [members, setMembers] = useState<DraftMember[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftRelationship, setDraftRelationship] = useState('');
  const [draftCategory, setDraftCategory] = useState<DraftMember['category']>('person');
  const [submitting, setSubmitting] = useState(false);

  function openSheet(prefillRelationship = '', prefillCategory: DraftMember['category'] = 'person') {
    setDraftName('');
    setDraftRelationship(prefillRelationship);
    setDraftCategory(prefillCategory);
    setShowSheet(true);
  }

  function addMember() {
    if (!draftName.trim()) return;
    setMembers((prev) => [...prev, { name: draftName.trim(), relationship: draftRelationship.trim(), category: draftCategory }]);
    setShowSheet(false);
  }

  function removeMember(idx: number) {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (members.length === 0) {
      Alert.alert('Add at least one member', 'Add a family member to create QR profiles for them.');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create the family group
      const family = await familiesService.create(groupName ?? 'My Family');

      // 2. Create a QR code for each member
      const created = await Promise.all(
        members.map((m) =>
          qrService.create({ name: m.name, category: m.category }).catch(() => null),
        ),
      );

      // 3. Link created QR codes to the family
      await Promise.all(
        created
          .filter(Boolean)
          .map((qr) => familiesService.addQrCode(family.id, qr!.id).catch(() => null)),
      );

      router.replace({
        pathname: '/(app)/onboard-generating' as any,
        params: {
          groupName: family.name,
          members: JSON.stringify(created.filter(Boolean).map((q) => ({ name: q!.name, code: q!.uniqueCode }))),
        },
      });
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to create family group.'));
    } finally {
      setSubmitting(false);
    }
  }

  const categoryLabels: Record<DraftMember['category'], string> = {
    person: 'Person', pet: 'Pet', bag: 'Bag', key: 'Keys', vehicle: 'Vehicle', other: 'Other',
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bg(dark) }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
          <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary(dark) }}>
            {groupName ?? 'Family Group'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 48 }}>
        <ProgressDots step={1} />

        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary(dark), textAlign: 'center' }}>
            Who's in your group?
          </Text>
          <Text style={{ fontSize: 14, color: textMuted(dark), textAlign: 'center', lineHeight: 21 }}>
            Each person or pet gets a QR safety profile. Add as many as you need.
          </Text>
        </View>

        {/* Quick-add chips */}
        <View>
          <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            Quick Add
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_ADD.map((qa) => (
              <TouchableOpacity
                key={qa.label}
                onPress={() => openSheet(qa.label, qa.category)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 9,
                  borderRadius: 20, backgroundColor: cardBg(dark),
                  borderWidth: 1, borderColor: borderColor(dark),
                }}
              >
                <Ionicons name={qa.icon as any} size={14} color={T.orange} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary(dark) }}>{qa.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Member list */}
        {members.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Members ({members.length})
            </Text>
            {members.map((m, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: cardBg(dark),
                  borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: borderColor(dark),
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.orangeSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={m.category === 'pet' ? 'paw' : 'person'} size={18} color={T.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary(dark) }}>{m.name}</Text>
                  <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 1 }}>
                    {m.relationship || categoryLabels[m.category]}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeMember(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={22} color={textMuted(dark)} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Add member */}
        <TouchableOpacity
          onPress={() => openSheet()}
          style={{
            backgroundColor: cardBg(dark),
            borderRadius: 14, padding: 14,
            borderWidth: 1.5, borderColor: T.orange, borderStyle: 'dashed',
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Ionicons name="add-circle-outline" size={20} color={T.orange} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: T.orange }}>Add a member</Text>
        </TouchableOpacity>

        {/* Create button */}
        <TouchableOpacity
          onPress={handleCreate}
          disabled={submitting || members.length === 0}
          style={{
            backgroundColor: members.length > 0 ? T.orange : '#d1d5db',
            borderRadius: 16, paddingVertical: 16,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
            opacity: submitting ? 0.7 : 1,
            marginTop: 8,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Create QR Profiles</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Add member bottom sheet */}
      <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setShowSheet(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{
            backgroundColor: cardBg(dark),
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, gap: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 24,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: textPrimary(dark) }}>Add Member</Text>
              <TouchableOpacity onPress={() => setShowSheet(false)}>
                <Ionicons name="close" size={22} color={textMuted(dark)} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary(dark) }}>Name *</Text>
              <TextInput
                style={{ backgroundColor: bg(dark), borderWidth: 1, borderColor: borderColor(dark), borderRadius: 12, padding: 14, color: textPrimary(dark), fontSize: 15 }}
                placeholder="e.g. Sarah"
                placeholderTextColor={textMuted(dark)}
                value={draftName}
                onChangeText={setDraftName}
                autoFocus
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary(dark) }}>Relationship (optional)</Text>
              <TextInput
                style={{ backgroundColor: bg(dark), borderWidth: 1, borderColor: borderColor(dark), borderRadius: 12, padding: 14, color: textPrimary(dark), fontSize: 15 }}
                placeholder="e.g. Partner, Child, Parent"
                placeholderTextColor={textMuted(dark)}
                value={draftRelationship}
                onChangeText={setDraftRelationship}
              />
            </View>

            {/* Category row */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['person', 'pet'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setDraftCategory(cat)}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
                    backgroundColor: draftCategory === cat ? T.orange + '22' : bg(dark),
                    borderWidth: 1.5, borderColor: draftCategory === cat ? T.orange : borderColor(dark),
                  }}
                >
                  <Ionicons name={cat === 'pet' ? 'paw' : 'person'} size={18} color={draftCategory === cat ? T.orange : textMuted(dark)} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: draftCategory === cat ? T.orange : textMuted(dark), marginTop: 3 }}>
                    {cat === 'pet' ? 'Pet' : 'Person'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={addMember}
              disabled={!draftName.trim()}
              style={{ backgroundColor: draftName.trim() ? T.orange : '#d1d5db', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Add to Group</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
