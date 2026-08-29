/** Storefront URL for the Shop button (not Shopify Admin). */
export function getShopifyShopUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SHOPIFY_SHOP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN?.trim();
  if (!domain) return null;
  const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `https://${host}`;
}
