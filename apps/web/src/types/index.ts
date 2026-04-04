// ── Map / Pin types ───────────────────────────────────────────────────────────
// Must match backend CreatePinDto PIN_TYPES exactly

export type PinCategory =
  | 'hazard'
  | 'roadblock'
  | 'construction'
  | 'safety_alert'
  | 'traffic'
  | 'event'
  | 'other';

export const TAG_CATEGORY_LABELS: Record<PinCategory, string> = {
  hazard: 'Hazard',
  roadblock: 'Roadblock',
  construction: 'Construction',
  safety_alert: 'Safety Alert',
  traffic: 'Traffic',
  event: 'Event',
  other: 'Other',
};

export const PIN_COLORS: Record<PinCategory, string> = {
  hazard: '#f59e0b',
  roadblock: '#ef4444',
  construction: '#f97316',
  safety_alert: '#8b5cf6',
  traffic: '#3b82f6',
  event: '#22c55e',
  other: '#94a3b8',
};

export interface LatLng {
  lat: number;
  lng: number;
}

// Re-export PinData from api for component use
export type { PinData } from '@/lib/api';

// ── Tag / QR types ────────────────────────────────────────────────────────────

export type TagCategory = 'pet' | 'bag' | 'key' | 'person' | 'vehicle' | 'other' | 'medical' | 'place';

export const QR_CATEGORY_LABELS: Record<TagCategory, string> = {
  pet: 'Pet',
  bag: 'Bag / Luggage',
  key: 'Keys',
  person: 'Person',
  vehicle: 'Vehicle',
  medical: 'Medical',
  place: 'Place',
  other: 'Other',
};

export interface TrackedItem {
  id: string;
  label: string;
  category: TagCategory;
  code: string;
  isLost: boolean;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
  guardianCount: number;
  createdAt: string;
}

// ── Lost alert ────────────────────────────────────────────────────────────────

export interface LostAlert {
  id: string;
  itemId: string;
  itemLabel: string;
  category: TagCategory;
  reportedAt: string;
  lastSeenLocation?: LatLng;
  finderContact?: string;
  message?: string;
}

// ── Emergency Contact ─────────────────────────────────────────────────────────

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

// ── UI State ──────────────────────────────────────────────────────────────────

export type ModalState =
  | 'none'
  | 'pin-detail'
  | 'create-pin'
  | 'options'
  | 'profile'
  | 'messages'
  | 'chat'
  | 'emergency'
  | 'qr-scanner'
  | 'qr-result'
  | 'report-found'
  | 'my-tags'
  | 'register-tag'
  | 'tag-detail'
  | 'lost-alerts'
  | 'notifications'
  | 'directions';
