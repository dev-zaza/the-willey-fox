export interface QrCode {
  id: string;
  userId: string;
  category: QrCategory;
  uniqueCode: string;
  name: string;
  description?: string;
  photoUrl?: string;
  visibilityConfig: VisibilityConfig;
  customFields: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type QrCategory = 'pet' | 'bag' | 'key' | 'person' | 'vehicle' | 'other' | 'medical' | 'place';

export interface VisibilityConfig {
  showName: boolean;
  showPhoto: boolean;
  showDescription: boolean;
  showCustomFields: boolean;
}

export type GuardianStatus = 'pending' | 'active' | 'removed';
export type ReportStatus = 'open' | 'contacted' | 'resolved' | 'closed';
