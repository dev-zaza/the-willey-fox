import {
  Injectable,
  Logger,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { QrService } from '../qr/qr.service';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { qrBatches } from '../../database/schema';

@Injectable()
export class ShopifyWebhookService {
  private readonly logger = new Logger(ShopifyWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly qrService: QrService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async handleOrderCreated(rawBody: Buffer, hmacHeader: string): Promise<void> {
    this.verifyHmac(rawBody, hmacHeader);

    let order: Record<string, any>;
    try {
      order = JSON.parse(rawBody.toString('utf8'));
    } catch {
      this.logger.warn('Failed to parse Shopify order JSON');
      return;
    }

    const orderId = order['id'] as number | undefined;
    const lineItems: any[] = order['line_items'] ?? [];

    const filterProductId = this.configService.get<string>('SHOPIFY_QR_PRODUCT_ID');

    let quantity = 0;
    if (filterProductId) {
      for (const item of lineItems) {
        if (String(item.product_id) === filterProductId) {
          quantity += Number(item.quantity ?? 1);
        }
      }
    } else {
      // No product filter — sum all line items
      for (const item of lineItems) {
        quantity += Number(item.quantity ?? 1);
      }
    }

    if (quantity <= 0) {
      this.logger.log(`Shopify order ${orderId}: no matching QR products, skipping`);
      return;
    }

    this.logger.log(`Shopify order ${orderId}: generating ${quantity} unclaimed QR codes`);
    const orderIdStr = orderId?.toString();

    const [batch] = await this.db
      .insert(qrBatches)
      .values({
        createdByAdminId: null,
        count: quantity,
        shopifyOrderId: orderIdStr ?? null,
        notes: `Auto-generated from Shopify order`,
        source: 'shopify_webhook',
      })
      .returning();

    await this.qrService.bulkGenerateUnclaimed(quantity, orderIdStr, batch.id);
    this.logger.log(`Shopify order ${orderId}: ${quantity} QR codes created in batch ${batch.id}`);
  }

  private verifyHmac(rawBody: Buffer, hmacHeader: string): void {
    const secret = this.configService.getOrThrow<string>('SHOPIFY_WEBHOOK_SECRET');
    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    if (computed !== hmacHeader) {
      this.logger.warn('Shopify HMAC verification failed');
      throw new ForbiddenException('SHOPIFY_INVALID_SIGNATURE');
    }
  }
}
