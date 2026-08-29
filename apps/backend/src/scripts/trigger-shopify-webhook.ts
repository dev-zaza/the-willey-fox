/**
 * Fire a signed Shopify `orders/paid` webhook at the local API.
 *
 * Prerequisites:
 *   1. Backend running (`pnpm --filter backend dev`)
 *   2. SHOPIFY_WEBHOOK_SECRET in safetag/.env (same file the API loads first)
 *   3. At least one product mapping in Admin → Shopify Orders
 *
 * Usage:
 *   pnpm --filter backend shopify:test-webhook
 *   pnpm --filter backend shopify:test-webhook -- --product-id 1234567890 --qty 2 --color Blue
 */
import { resolve } from 'path';
import { config } from 'dotenv';
import * as crypto from 'crypto';
import postgres from 'postgres';

// Last value wins so a real secret later in the file replaces a leftover placeholder.
config({ path: resolve(__dirname, '../../../../.env'), override: true });
config({ path: resolve(__dirname, '../../.env'), override: true });

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function isPlaceholderSecret(secret: string): boolean {
  return !secret || /your_shopify|webhook_secret_here|changeme/i.test(secret);
}

async function resolveProductId(explicit?: string): Promise<{ id: string; type?: string; label?: string | null }> {
  if (explicit) return { id: explicit };

  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error('Pass --product-id <id> (or set DATABASE_URL so the script can read mappings).');
  }

  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql<{
      shopify_product_id: string;
      product_type: string;
      label: string | null;
    }[]>`
      SELECT shopify_product_id, product_type, label
      FROM shopify_product_mappings
      ORDER BY created_at ASC
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      throw new Error(
        'No product mappings yet. Add one in Admin → Shopify Orders → Product mappings, then retry.',
      );
    }
    return { id: row.shopify_product_id, type: row.product_type, label: row.label };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

function buildPayload(opts: {
  productId: string;
  qty: number;
  color: string;
  title: string;
}): { body: string; orderId: number; orderName: string } {
  const orderId = Date.now();
  const orderName = `#DEV-${String(orderId).slice(-6)}`;
  const payload = {
    id: orderId,
    name: orderName,
    order_number: Number(String(orderId).slice(-6)),
    email: 'dev-test@thewileyfox.local',
    contact_email: 'dev-test@thewileyfox.local',
    financial_status: 'paid',
    customer: {
      first_name: 'Dev',
      last_name: 'Tester',
      email: 'dev-test@thewileyfox.local',
    },
    line_items: [
      {
        id: orderId + 1,
        product_id: Number(opts.productId) || opts.productId,
        variant_id: orderId + 2,
        title: opts.title,
        name: `${opts.title} - ${opts.color}`,
        variant_title: opts.color,
        sku: 'WF-DEV-TEST',
        quantity: opts.qty,
      },
    ],
  };
  return { body: JSON.stringify(payload), orderId, orderName };
}

async function main() {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? '';
  if (isPlaceholderSecret(secret)) {
    throw new Error(
      'SHOPIFY_WEBHOOK_SECRET is missing or still a placeholder.\n' +
        'Put the Shopify webhook signing secret in safetag/.env (the API loads that file first).\n' +
        'apps/backend/.env alone is not enough.',
    );
  }

  const port = process.env.PORT || '3002';
  const url =
    arg('url') ??
    process.env.SHOPIFY_TEST_WEBHOOK_URL ??
    `http://localhost:${port}/api/v1/payments/webhook/shopify`;

  const qty = Math.max(1, Number(arg('qty', '1')));
  const color = arg('color', 'Orange')!;
  const title = arg('title', 'Wiley Fox Safety Tag')!;
  const product = await resolveProductId(arg('product-id'));

  const { body, orderId, orderName } = buildPayload({
    productId: product.id,
    qty,
    color,
    title,
  });

  const hmac = crypto.createHmac('sha256', secret.trim()).update(body, 'utf8').digest('base64');

  console.log(`POST ${url}`);
  console.log(`  order     ${orderName} (id ${orderId})`);
  console.log(`  product   ${product.id}${product.type ? ` → ${product.type}` : ''}`);
  console.log(`  qty      ${qty}  colour ${color}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Hmac-Sha256': hmac,
      'X-Shopify-Topic': 'orders/paid',
      'X-Shopify-Shop-Domain': 'dev-test.myshopify.com',
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Webhook rejected ${res.status}: ${text || res.statusText}`);
  }

  console.log(`  status    ${res.status} OK`);
  console.log('Open Admin → Shopify Orders. You should see this order (allocated or needs stock).');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
