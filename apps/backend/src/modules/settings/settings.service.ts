import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { appSettings, visualThemes, printTemplates } from '../../database/schema';
import { QR_CATEGORIES, CORE_QR_CATEGORIES } from '@safetag/shared';

export interface QrTemplateConfig {
  showLogo: boolean;
  accentColor: string;
  showCategory: boolean;
  showReward: boolean;
  showOwnerContact: boolean;
  footerText: string;
  logoUrl: string | null;
}

const QR_TEMPLATE_DEFAULTS: QrTemplateConfig = {
  showLogo: true,
  accentColor: '#f97316',
  showCategory: true,
  showReward: true,
  showOwnerContact: true,
  footerText: 'Scan to help return this item',
  logoUrl: null,
};

export interface QrCategoryConfig {
  value: string;
  label: string;
  core: boolean;
  enabled: boolean;
}

const DEFAULT_QR_CATEGORIES: QrCategoryConfig[] = [
  { value: 'person',  label: 'Person',       core: true,  enabled: true },
  { value: 'pet',     label: 'Pet',           core: false, enabled: true },
  { value: 'bag',     label: 'Bag / Luggage', core: false, enabled: true },
  { value: 'key',     label: 'Keys',          core: false, enabled: true },
  { value: 'vehicle', label: 'Vehicle',       core: false, enabled: true },
  { value: 'medical', label: 'Medical',       core: false, enabled: true },
  { value: 'place',   label: 'Place',         core: false, enabled: true },
  { value: 'other',   label: 'Other',         core: false, enabled: true },
];

export interface TierLimit {
  maxQrCodes: number;
  maxGuardians: number;
  maxEmergencyContacts: number;
  maxPinsPerDay: number;
}

export interface PricingConfig {
  monthlyPriceCents: number;
  annualPriceCents: number;
  monthlyPriceLabel: string;
  annualPriceLabel: string;
  annualSavePercent: number;
  trialDays: number;
  stripePriceIdMonthly: string;
  stripePriceIdAnnual: string;
  tierLimits: {
    free: TierLimit;
    basic: TierLimit;
    premium: TierLimit;
  };
}

/** Partial update: nested tier limits can patch individual tiers */
export type PricingConfigUpdate = Omit<Partial<PricingConfig>, 'tierLimits'> & {
  tierLimits?: Partial<PricingConfig['tierLimits']>;
};

const DEFAULTS: PricingConfig = {
  monthlyPriceCents: 999,
  annualPriceCents: 9599,
  monthlyPriceLabel: '$9.99/month',
  annualPriceLabel: '$95.99/year',
  annualSavePercent: 20,
  trialDays: 7,
  stripePriceIdMonthly: '',
  stripePriceIdAnnual: '',
  tierLimits: {
    free:    { maxQrCodes: 5,  maxGuardians: 2,  maxEmergencyContacts: 3,  maxPinsPerDay: 5 },
    basic:   { maxQrCodes: 10, maxGuardians: 5,  maxEmergencyContacts: 10, maxPinsPerDay: 20 },
    premium: { maxQrCodes: 50, maxGuardians: 20, maxEmergencyContacts: 25, maxPinsPerDay: 100 },
  },
};

@Injectable()
export class SettingsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async getPricingConfig(): Promise<PricingConfig> {
    const [row] = await this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'pricing'))
      .limit(1);

    const stored = (row?.value ?? {}) as Partial<PricingConfig>;

    return {
      ...DEFAULTS,
      ...stored,
      tierLimits: {
        ...DEFAULTS.tierLimits,
        ...(stored.tierLimits ?? {}),
      },
      // Fall back to env vars when DB value is blank
      stripePriceIdMonthly:
        stored.stripePriceIdMonthly ||
        this.configService.getOrThrow<string>('STRIPE_PRICE_ID_MONTHLY'),
      stripePriceIdAnnual:
        stored.stripePriceIdAnnual ||
        this.configService.getOrThrow<string>('STRIPE_PRICE_ID_ANNUAL'),
    };
  }

  async setPricingConfig(dto: PricingConfigUpdate): Promise<PricingConfig> {
    const current = await this.getPricingConfig();
    const tierPatch = dto.tierLimits ?? {};
    const next: PricingConfig = {
      ...current,
      ...dto,
      tierLimits: {
        ...current.tierLimits,
        ...(tierPatch.free !== undefined ? { free: { ...current.tierLimits.free, ...tierPatch.free } } : {}),
        ...(tierPatch.basic !== undefined ? { basic: { ...current.tierLimits.basic, ...tierPatch.basic } } : {}),
        ...(tierPatch.premium !== undefined
          ? { premium: { ...current.tierLimits.premium, ...tierPatch.premium } }
          : {}),
      },
    };

    // Store raw values (including blank strings for Stripe IDs, to respect explicit blanks)
    const storedValue = {
      ...next,
      // Keep blank strings as-is in DB so the fallback logic in getPricingConfig works
    };

    await this.db
      .insert(appSettings)
      .values({ key: 'pricing', value: storedValue, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: storedValue, updatedAt: new Date() },
      });

    return next;
  }

  async getQrCategories(): Promise<QrCategoryConfig[]> {
    const [row] = await this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'qr_categories'))
      .limit(1);

    const stored = (row?.value ?? null) as QrCategoryConfig[] | null;
    if (!stored || !Array.isArray(stored)) return DEFAULT_QR_CATEGORIES;

    // Merge: ensure all DB-known enum values appear; fill labels from stored config
    const storedMap = new Map(stored.map((c) => [c.value, c]));
    return DEFAULT_QR_CATEGORIES.map((def) => storedMap.get(def.value) ?? def);
  }

  async getQrTemplate(): Promise<QrTemplateConfig> {
    const [row] = await this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'qr_template'))
      .limit(1);

    const stored = (row?.value ?? {}) as Partial<QrTemplateConfig>;
    return { ...QR_TEMPLATE_DEFAULTS, ...stored };
  }

  async setQrTemplate(patch: Partial<QrTemplateConfig>): Promise<QrTemplateConfig> {
    const current = await this.getQrTemplate();
    const next: QrTemplateConfig = { ...current, ...patch };

    await this.db
      .insert(appSettings)
      .values({ key: 'qr_template', value: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: next, updatedAt: new Date() },
      });

    return next;
  }

  async listActiveVisualThemes() {
    const rows = await this.db.select().from(visualThemes);
    return rows.filter((r) => r.isActive);
  }

  async listActivePrintTemplates() {
    const rows = await this.db.select().from(printTemplates);
    return rows.filter((r) => r.isActive);
  }

  async updateQrCategory(value: string, patch: { label?: string; enabled?: boolean }): Promise<QrCategoryConfig[]> {
    if (!QR_CATEGORIES.includes(value as (typeof QR_CATEGORIES)[number])) {
      throw new BadRequestException(`Unknown category: ${value}`);
    }
    const coreValues: readonly string[] = CORE_QR_CATEGORIES;
    if (coreValues.includes(value) && patch.enabled === false) {
      throw new BadRequestException(`Category "${value}" is a core category and cannot be disabled`);
    }

    const current = await this.getQrCategories();
    const next = current.map((cat) =>
      cat.value === value ? { ...cat, ...patch } : cat,
    );

    await this.db
      .insert(appSettings)
      .values({ key: 'qr_categories', value: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: next, updatedAt: new Date() },
      });

    return next;
  }
}
