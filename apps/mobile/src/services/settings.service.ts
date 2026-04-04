import { apiClient } from './api';

export interface QrTemplateConfig {
  showLogo: boolean;
  accentColor: string;
  showCategory: boolean;
  showReward: boolean;
  showOwnerContact: boolean;
  footerText: string;
  logoUrl: string | null;
}

const DEFAULT_TEMPLATE: QrTemplateConfig = {
  showLogo: true,
  accentColor: '#f97316',
  showCategory: true,
  showReward: true,
  showOwnerContact: true,
  footerText: 'Scan to help return this item',
  logoUrl: null,
};

let _cached: QrTemplateConfig | null = null;

export const settingsService = {
  getQrTemplate: async (): Promise<QrTemplateConfig> => {
    if (_cached) return _cached;
    try {
      const { data } = await apiClient.get<QrTemplateConfig>('/settings/qr-template');
      _cached = { ...DEFAULT_TEMPLATE, ...data };
      return _cached;
    } catch {
      return DEFAULT_TEMPLATE;
    }
  },
};
