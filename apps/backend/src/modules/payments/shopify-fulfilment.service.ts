import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import {
  qrBatches,
  qrCodes,
  shopifyOrderItems,
  shopifyOrders,
  shopifyProductMappings,
} from '../../database/schema';
import {
  deriveShopifyOrderStatus,
  isQrProductType,
  QR_PRODUCT_TYPES,
  type QrProductType,
} from '../qr/qr-product-types';

type Tx = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0];

@Injectable()
export class ShopifyFulfilmentService {
  private readonly logger = new Logger(ShopifyFulfilmentService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  listProductTypes() {
    return QR_PRODUCT_TYPES;
  }

  async listMappings() {
    return this.db
      .select()
      .from(shopifyProductMappings)
      .orderBy(asc(shopifyProductMappings.productType));
  }

  async createMapping(shopifyProductId: string, productType: string, label?: string) {
    if (!isQrProductType(productType)) {
      throw new BadRequestException('SHOPIFY_UNKNOWN_PRODUCT_TYPE');
    }
    const id = shopifyProductId.trim();
    if (!id) throw new BadRequestException('SHOPIFY_PRODUCT_ID_REQUIRED');

    const [row] = await this.db
      .insert(shopifyProductMappings)
      .values({
        shopifyProductId: id,
        productType,
        label: label?.trim() || null,
      })
      .onConflictDoUpdate({
        target: shopifyProductMappings.shopifyProductId,
        set: {
          productType,
          label: label?.trim() || null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async deleteMapping(id: string) {
    const [row] = await this.db
      .delete(shopifyProductMappings)
      .where(eq(shopifyProductMappings.id, id))
      .returning({ id: shopifyProductMappings.id });
    if (!row) throw new NotFoundException('SHOPIFY_MAPPING_NOT_FOUND');
    return { deleted: true };
  }

  async ingestPaidOrder(order: Record<string, any>): Promise<void> {
    const shopifyOrderId = order['id'] != null ? String(order['id']) : null;
    if (!shopifyOrderId) {
      this.logger.warn('Shopify payload missing order id');
      return;
    }

    const [existing] = await this.db
      .select({ id: shopifyOrders.id, status: shopifyOrders.status })
      .from(shopifyOrders)
      .where(eq(shopifyOrders.shopifyOrderId, shopifyOrderId))
      .limit(1);

    if (existing) {
      if (existing.status !== 'allocated') {
        await this.autoAssign(existing.id);
      }
      return;
    }

    const mappings = await this.db.select().from(shopifyProductMappings);
    const mapByProductId = new Map(mappings.map((m) => [m.shopifyProductId, m]));

    const lineItems: any[] = order['line_items'] ?? [];
    const mappedLines: Array<{
      shopifyLineItemId: string | null;
      shopifyProductId: string;
      shopifyVariantId: string | null;
      title: string | null;
      variantTitle: string | null;
      sku: string | null;
      quantity: number;
      productType: QrProductType;
    }> = [];

    for (const item of lineItems) {
      const productId = item.product_id != null ? String(item.product_id) : '';
      const mapping = mapByProductId.get(productId);
      if (!mapping || !isQrProductType(mapping.productType)) continue;
      const quantity = Number(item.quantity ?? 1);
      if (quantity <= 0) continue;
      mappedLines.push({
        shopifyLineItemId: item.id != null ? String(item.id) : null,
        shopifyProductId: productId,
        shopifyVariantId: item.variant_id != null ? String(item.variant_id) : null,
        title: item.title ?? item.name ?? null,
        variantTitle: item.variant_title ?? null,
        sku: item.sku ?? null,
        quantity,
        productType: mapping.productType,
      });
    }

    if (mappedLines.length === 0) {
      this.logger.log(`Shopify order ${shopifyOrderId}: no mapped QR products, skipping`);
      return;
    }

    const customer = order['customer'] ?? {};
    const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim()
      || order['billing_address']?.name
      || null;
    const orderNumber = order['name'] != null
      ? String(order['name'])
      : order['order_number'] != null
        ? `#${order['order_number']}`
        : null;

    const [created] = await this.db
      .insert(shopifyOrders)
      .values({
        shopifyOrderId,
        orderNumber,
        customerEmail: order['email'] || order['contact_email'] || customer.email || null,
        customerName,
        status: 'needs_stock',
      })
      .returning();

    await this.db.insert(shopifyOrderItems).values(
      mappedLines.map((line) => ({
        orderId: created.id,
        shopifyLineItemId: line.shopifyLineItemId,
        shopifyProductId: line.shopifyProductId,
        shopifyVariantId: line.shopifyVariantId,
        title: line.title,
        variantTitle: line.variantTitle,
        sku: line.sku,
        quantity: line.quantity,
        productType: line.productType,
        allocatedCount: 0,
        status: 'needs_stock',
      })),
    );

    this.logger.log(`Shopify order ${shopifyOrderId}: ingested ${mappedLines.length} QR line(s), auto-assigning`);
    await this.autoAssign(created.id);
  }

  async listOrders(limit = 50, offset = 0, status?: string) {
    const filtered = status
      ? this.db
          .select()
          .from(shopifyOrders)
          .where(eq(shopifyOrders.status, status))
          .$dynamic()
      : this.db.select().from(shopifyOrders).$dynamic();

    const rows = await filtered.orderBy(desc(shopifyOrders.createdAt)).limit(limit).offset(offset);

    const orderIds = rows.map((r) => r.id);
    if (orderIds.length === 0) return { rows: [], total: await this.countOrders(status) };

    const items = await this.db
      .select()
      .from(shopifyOrderItems)
      .where(inArray(shopifyOrderItems.orderId, orderIds));

    const itemsByOrder = new Map<string, typeof items>();
    for (const item of items) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    return {
      rows: rows.map((order) => ({ ...order, items: itemsByOrder.get(order.id) ?? [] })),
      total: await this.countOrders(status),
    };
  }

  async getOrderDetail(orderId: string) {
    const [order] = await this.db
      .select()
      .from(shopifyOrders)
      .where(eq(shopifyOrders.id, orderId))
      .limit(1);
    if (!order) throw new NotFoundException('SHOPIFY_ORDER_NOT_FOUND');

    const items = await this.db
      .select()
      .from(shopifyOrderItems)
      .where(eq(shopifyOrderItems.orderId, orderId))
      .orderBy(asc(shopifyOrderItems.createdAt));

    const itemIds = items.map((i) => i.id);
    const codes = itemIds.length
      ? await this.db
          .select({
            id: qrCodes.id,
            uniqueCode: qrCodes.uniqueCode,
            status: qrCodes.status,
            shopifyOrderItemId: qrCodes.shopifyOrderItemId,
            batchId: qrCodes.batchId,
          })
          .from(qrCodes)
          .where(inArray(qrCodes.shopifyOrderItemId, itemIds))
          .orderBy(asc(qrCodes.uniqueCode))
      : [];

    const codesByItem = new Map<string, typeof codes>();
    for (const code of codes) {
      if (!code.shopifyOrderItemId) continue;
      const list = codesByItem.get(code.shopifyOrderItemId) ?? [];
      list.push(code);
      codesByItem.set(code.shopifyOrderItemId, list);
    }

    return {
      ...order,
      items: items.map((item) => ({ ...item, codes: codesByItem.get(item.id) ?? [] })),
    };
  }

  async listAvailableInventory(productType: string, limit = 100) {
    if (!isQrProductType(productType)) {
      throw new BadRequestException('SHOPIFY_UNKNOWN_PRODUCT_TYPE');
    }
    return this.db
      .select({
        id: qrCodes.id,
        uniqueCode: qrCodes.uniqueCode,
        batchId: qrCodes.batchId,
        createdAt: qrCodes.createdAt,
      })
      .from(qrCodes)
      .innerJoin(qrBatches, eq(qrCodes.batchId, qrBatches.id))
      .where(
        and(
          eq(qrCodes.status, 'unclaimed'),
          isNull(qrCodes.shopifyOrderItemId),
          eq(qrBatches.productType, productType),
        ),
      )
      .orderBy(asc(qrCodes.createdAt))
      .limit(limit);
  }

  async autoAssign(orderId: string) {
    const [order] = await this.db
      .select()
      .from(shopifyOrders)
      .where(eq(shopifyOrders.id, orderId))
      .limit(1);
    if (!order) throw new NotFoundException('SHOPIFY_ORDER_NOT_FOUND');

    const items = await this.db
      .select()
      .from(shopifyOrderItems)
      .where(eq(shopifyOrderItems.orderId, orderId));

    await this.db.transaction(async (tx) => {
      for (const item of items) {
        const remaining = item.quantity - item.allocatedCount;
        if (remaining <= 0) continue;
        const ids = await this.lockAvailableIds(tx, item.productType, remaining);
        if (ids.length > 0) {
          await tx
            .update(qrCodes)
            .set({
              shopifyOrderId: order.shopifyOrderId,
              shopifyOrderItemId: item.id,
              updatedAt: new Date(),
            })
            .where(inArray(qrCodes.id, ids));
        }
        const allocatedCount = item.allocatedCount + ids.length;
        await tx
          .update(shopifyOrderItems)
          .set({
            allocatedCount,
            status: allocatedCount >= item.quantity ? 'allocated' : 'needs_stock',
            updatedAt: new Date(),
          })
          .where(eq(shopifyOrderItems.id, item.id));
      }
      await this.recomputeOrderStatus(tx, orderId);
    });

    return this.getOrderDetail(orderId);
  }

  async assignSpecific(orderId: string, itemId: string, qrCodeIds: string[]) {
    if (!qrCodeIds.length) throw new BadRequestException('SHOPIFY_QR_IDS_REQUIRED');

    const [order] = await this.db
      .select()
      .from(shopifyOrders)
      .where(eq(shopifyOrders.id, orderId))
      .limit(1);
    if (!order) throw new NotFoundException('SHOPIFY_ORDER_NOT_FOUND');

    const [item] = await this.db
      .select()
      .from(shopifyOrderItems)
      .where(and(eq(shopifyOrderItems.id, itemId), eq(shopifyOrderItems.orderId, orderId)))
      .limit(1);
    if (!item) throw new NotFoundException('SHOPIFY_ORDER_ITEM_NOT_FOUND');

    const remaining = item.quantity - item.allocatedCount;
    if (qrCodeIds.length > remaining) {
      throw new BadRequestException('SHOPIFY_ASSIGN_EXCEEDS_QUANTITY');
    }

    await this.db.transaction(async (tx) => {
      const eligible = await tx
        .select({ id: qrCodes.id, productType: qrBatches.productType })
        .from(qrCodes)
        .innerJoin(qrBatches, eq(qrCodes.batchId, qrBatches.id))
        .where(
          and(
            inArray(qrCodes.id, qrCodeIds),
            eq(qrCodes.status, 'unclaimed'),
            isNull(qrCodes.shopifyOrderItemId),
            eq(qrBatches.productType, item.productType),
          ),
        );

      if (eligible.length !== qrCodeIds.length) {
        throw new BadRequestException('SHOPIFY_QR_NOT_AVAILABLE');
      }

      const ids = eligible.map((r) => r.id);
      await tx
        .update(qrCodes)
        .set({
          shopifyOrderId: order.shopifyOrderId,
          shopifyOrderItemId: item.id,
          updatedAt: new Date(),
        })
        .where(inArray(qrCodes.id, ids));

      const allocatedCount = item.allocatedCount + ids.length;
      await tx
        .update(shopifyOrderItems)
        .set({
          allocatedCount,
          status: allocatedCount >= item.quantity ? 'allocated' : 'needs_stock',
          updatedAt: new Date(),
        })
        .where(eq(shopifyOrderItems.id, item.id));

      await this.recomputeOrderStatus(tx, orderId);
    });

    return this.getOrderDetail(orderId);
  }

  async unassign(orderId: string, itemId: string, qrCodeIds: string[]) {
    if (!qrCodeIds.length) throw new BadRequestException('SHOPIFY_QR_IDS_REQUIRED');

    const [item] = await this.db
      .select()
      .from(shopifyOrderItems)
      .where(and(eq(shopifyOrderItems.id, itemId), eq(shopifyOrderItems.orderId, orderId)))
      .limit(1);
    if (!item) throw new NotFoundException('SHOPIFY_ORDER_ITEM_NOT_FOUND');

    await this.db.transaction(async (tx) => {
      const attached = await tx
        .select({ id: qrCodes.id })
        .from(qrCodes)
        .where(
          and(
            inArray(qrCodes.id, qrCodeIds),
            eq(qrCodes.shopifyOrderItemId, itemId),
            eq(qrCodes.status, 'unclaimed'),
          ),
        );

      if (attached.length !== qrCodeIds.length) {
        throw new BadRequestException('SHOPIFY_QR_CANNOT_UNASSIGN');
      }

      await tx
        .update(qrCodes)
        .set({
          shopifyOrderId: null,
          shopifyOrderItemId: null,
          updatedAt: new Date(),
        })
        .where(inArray(qrCodes.id, qrCodeIds));

      const allocatedCount = Math.max(0, item.allocatedCount - attached.length);
      await tx
        .update(shopifyOrderItems)
        .set({
          allocatedCount,
          status: allocatedCount >= item.quantity ? 'allocated' : 'needs_stock',
          updatedAt: new Date(),
        })
        .where(eq(shopifyOrderItems.id, item.id));

      await this.recomputeOrderStatus(tx, orderId);
    });

    return this.getOrderDetail(orderId);
  }

  private async lockAvailableIds(tx: Tx, productType: string, limit: number): Promise<string[]> {
    const rows = await tx.execute(sql`
      SELECT qc.id
      FROM qr_codes qc
      INNER JOIN qr_batches qb ON qc.batch_id = qb.id
      WHERE qc.status = 'unclaimed'
        AND qc.shopify_order_item_id IS NULL
        AND qb.product_type = ${productType}
      ORDER BY qc.created_at ASC
      LIMIT ${limit}
      FOR UPDATE OF qc SKIP LOCKED
    `);

    return Array.from(rows).map((r) => (r as { id: string }).id);
  }

  private async recomputeOrderStatus(tx: Tx, orderId: string) {
    const items = await tx
      .select({ status: shopifyOrderItems.status })
      .from(shopifyOrderItems)
      .where(eq(shopifyOrderItems.orderId, orderId));
    const status = deriveShopifyOrderStatus(items);
    await tx
      .update(shopifyOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(shopifyOrders.id, orderId));
  }

  private async countOrders(status?: string) {
    const [row] = status
      ? await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(shopifyOrders)
          .where(eq(shopifyOrders.status, status))
      : await this.db.select({ count: sql<number>`count(*)::int` }).from(shopifyOrders);
    return Number(row?.count ?? 0);
  }
}
