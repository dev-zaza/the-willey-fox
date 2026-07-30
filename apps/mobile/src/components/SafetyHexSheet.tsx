import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@/components/Icon';

const BAND_META: Record<string, { label: string; color: string; bg: string; num: number }> = {
  band5:     { label: 'Safe',         color: '#3FA34D', bg: '#F0FDF4', num: 5 },
  band4:     { label: 'Low Risk',     color: '#A4C957', bg: '#F7FBE8', num: 4 },
  band3:     { label: 'Stay Aware',   color: '#FFC857', bg: '#FFFBEB', num: 3 },
  band2:     { label: 'Elevated',     color: '#F46036', bg: '#FFF1ED', num: 2 },
  band1:     { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', num: 1 },
  low_count: { label: 'Low Data',     color: '#9ED2B2', bg: '#F0FDF9', num: 0 },
  // legacy bands from old scorer
  green:  { label: 'Safe',         color: '#3FA34D', bg: '#F0FDF4', num: 5 },
  amber:  { label: 'Stay Aware',   color: '#FFC857', bg: '#FFFBEB', num: 3 },
  red:    { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', num: 1 },
  purple: { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', num: 1 },
};

export interface SelectedHex {
  h3: string;
  score: number | null;
  band: string;
  color: string;
  incidentCount: number;
  centLat: number;
  centLng: number;
}

interface Props {
  hex: SelectedHex | null;
  onClose: () => void;
  onViewAreaReport: (hex: SelectedHex) => void;
}

export function SafetyHexSheet({ hex, onClose, onViewAreaReport }: Props) {
  const dark = useColorScheme() === 'dark';

  if (!hex) return null;

  const meta = BAND_META[hex.band] ?? BAND_META.band3;
  const score = hex.score != null ? Math.round(hex.score) : null;

  const cardBg = dark ? '#1a1d27' : '#ffffff';
  const textPrimary = dark ? '#f1f5f9' : '#232323';
  const textMuted = dark ? '#64748b' : '#8a8a8a';
  const borderCol = dark ? '#2a2f45' : '#ECECEC';

  const BAND_COLORS = ['#D7263D', '#F46036', '#FFC857', '#A4C957', '#3FA34D'];

  return (
    <Modal
      visible={!!hex}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }} pointerEvents="box-none">
        {/* Tap-away dismiss */}
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Sheet */}
        <View style={{
          backgroundColor: cardBg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 40,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
          elevation: 16,
        }}>
          {/* Handle */}
          <View style={{
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: borderCol,
            alignSelf: 'center',
            marginTop: 12, marginBottom: 20,
          }} />

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            {/* Score + band row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: meta.bg,
                borderWidth: 3, borderColor: meta.color,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {score != null ? (
                  <Text style={{ fontSize: 24, fontWeight: '800', color: meta.color }}>{score}</Text>
                ) : (
                  <Ionicons name="help" size={24} color={meta.color} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary }}>{meta.label}</Text>
                <Text style={{ fontSize: 13, color: textMuted, marginTop: 2 }}>
                  Wiley Fox Safety Score
                </Text>
                {score != null && (
                  <Text style={{ fontSize: 12, color: textMuted, marginTop: 1 }}>
                    {score}/100 · Band {meta.num > 0 ? meta.num : '–'}
                  </Text>
                )}
              </View>
            </View>

            {/* 5-band progress bar */}
            <View style={{ flexDirection: 'row', gap: 3, marginBottom: 6, borderRadius: 6, overflow: 'hidden', height: 10 }}>
              {BAND_COLORS.map((c, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    backgroundColor: c,
                    opacity: (meta.num === 0 || i + 1 === meta.num) ? 1 : 0.25,
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ fontSize: 10, color: textMuted }}>High Caution</Text>
              <Text style={{ fontSize: 10, color: textMuted }}>Safe</Text>
            </View>

            {/* Stats row */}
            <View style={{
              flexDirection: 'row', gap: 12, marginBottom: 20,
            }}>
              <View style={{
                flex: 1, backgroundColor: dark ? '#0f1117' : '#F2F4E5',
                borderRadius: 12, padding: 14, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary }}>{hex.incidentCount}</Text>
                <Text style={{ fontSize: 11, color: textMuted, marginTop: 2, textAlign: 'center' }}>Crimes{'\n'}Recorded</Text>
              </View>
              <View style={{
                flex: 1, backgroundColor: dark ? '#0f1117' : '#F2F4E5',
                borderRadius: 12, padding: 14, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary }}>~150m</Text>
                <Text style={{ fontSize: 11, color: textMuted, marginTop: 2, textAlign: 'center' }}>Hex Cell{'\n'}Radius</Text>
              </View>
            </View>

            {meta.num === 0 && (
              <View style={{
                backgroundColor: '#F0FDF9', borderRadius: 10, padding: 12, marginBottom: 20,
                flexDirection: 'row', gap: 8, alignItems: 'flex-start',
              }}>
                <Ionicons name="information-circle" size={16} color="#9ED2B2" />
                <Text style={{ flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 18 }}>
                  Fewer than 3 incidents recorded in this cell. Score not available — low data area.
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 11, color: textMuted, marginBottom: 20, lineHeight: 16 }}>
              70% live police data · 30% Numbeo · population-adjusted
            </Text>

            {/* CTA */}
            <TouchableOpacity
              onPress={() => onViewAreaReport(hex)}
              style={{
                backgroundColor: '#FF7B14', borderRadius: 14,
                paddingVertical: 14, flexDirection: 'row',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Ionicons name="analytics" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                View Area Safety Report
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
