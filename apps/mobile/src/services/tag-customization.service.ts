import { apiClient as api } from './api';

export interface VisualTheme {
  id: string;
  name: string;
  accentColor: string;
  backgroundStyle: string;
  showLogo: boolean;
  logoUrl: string | null;
  tierRequired: string;
  isActive: boolean;
}

export interface TextSlots {
  showTagName?: boolean;
  showInstructions?: boolean;
  instructionsText?: string;
  showReward?: boolean;
  tagNamePosition?: string;
  instructionsPosition?: string;
}

export interface PrintTemplate {
  id: string;
  name: string;
  formatType: string;
  tierRequired: string;
  backgroundColor: string;
  logoPlacement: string;
  logoSize: number;
  qrPosition: string;
  qrSize: number;
  textSlots: TextSlots;
  isActive: boolean;
}

export const tagCustomizationService = {
  listVisualThemes: async (): Promise<VisualTheme[]> => {
    const { data } = await api.get<VisualTheme[]>('/settings/visual-themes');
    return data;
  },

  listPrintTemplates: async (): Promise<PrintTemplate[]> => {
    const { data } = await api.get<PrintTemplate[]>('/settings/print-templates');
    return data;
  },

  setTheme: async (qrId: string, themeId: string | null): Promise<void> => {
    await api.patch(`/qr-codes/${qrId}/theme`, { themeId });
  },
};
