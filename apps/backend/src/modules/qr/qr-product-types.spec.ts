import {
  deriveShopifyOrderStatus,
  isQrProductType,
  resolveProductType,
} from './qr-product-types';

describe('qr-product-types', () => {
  it('resolves canonical print-format keys', () => {
    expect(resolveProductType('luggage-tag')).toBe('luggage-tag');
    expect(isQrProductType('keyring')).toBe(true);
  });

  it('maps legacy batch notes from the two print runs', () => {
    expect(resolveProductType('name-tag')).toBe('name-tag-emergency');
    expect(resolveProductType('item-min')).toBe('item-mini');
  });

  it('returns null for unknown types', () => {
    expect(resolveProductType('hoodie')).toBeNull();
    expect(resolveProductType('')).toBeNull();
  });

  it('marks an order allocated only when every line is allocated', () => {
    expect(deriveShopifyOrderStatus([{ status: 'allocated' }, { status: 'allocated' }])).toBe('allocated');
    expect(deriveShopifyOrderStatus([{ status: 'allocated' }, { status: 'needs_stock' }])).toBe('needs_stock');
    expect(deriveShopifyOrderStatus([])).toBe('needs_stock');
  });
});
