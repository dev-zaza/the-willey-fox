export const QR_PRODUCT_TYPES = [
  { key: 'name-tag-emergency', label: 'Name Tag (Emergency)' },
  { key: 'name-tag-square', label: 'Name Tag (Square)' },
  { key: 'item-sticker', label: 'Item Sticker' },
  { key: 'item-mini', label: 'Item Mini' },
  { key: 'luggage-tag', label: 'Luggage Tag' },
  { key: 'keyring', label: 'Keyring' },
  { key: 'wristband-medical', label: 'Wristband (Medical)' },
  { key: 'wristband-event', label: 'Wristband (Event / Kids)' },
  { key: 'luggage-bar', label: 'Luggage Bar' },
] as const;

export type QrProductType = (typeof QR_PRODUCT_TYPES)[number]['key'];

export const QR_PRODUCT_TYPE_KEYS: QrProductType[] = QR_PRODUCT_TYPES.map((t) => t.key);

const TYPE_SET = new Set<string>(QR_PRODUCT_TYPE_KEYS);

/** Legacy batch `notes` values from the two print runs. */
const NOTES_ALIASES: Record<string, QrProductType> = {
  'name-tag': 'name-tag-emergency',
  'item-min': 'item-mini',
};

export function isQrProductType(value: string): value is QrProductType {
  return TYPE_SET.has(value);
}

export function resolveProductType(value: string | null | undefined): QrProductType | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (isQrProductType(trimmed)) return trimmed;
  return NOTES_ALIASES[trimmed] ?? null;
}

export function deriveShopifyOrderStatus(
  items: { status: string }[],
): 'allocated' | 'needs_stock' {
  if (items.length === 0) return 'needs_stock';
  if (items.every((item) => item.status === 'allocated')) return 'allocated';
  return 'needs_stock';
}
