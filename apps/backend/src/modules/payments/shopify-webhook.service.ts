import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ShopifyFulfilmentService } from './shopify-fulfilment.service';

@Injectable()
export class ShopifyWebhookService {
  private readonly logger = new Logger(ShopifyWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly fulfilmentService: ShopifyFulfilmentService,
  ) {}

  async handleOrderCreated(rawBody: Buffer | undefined, hmacHeader: string | undefined): Promise<void> {
    const body = this.verifyHmac(rawBody, hmacHeader);

    let order: Record<string, any>;
    try {
      order = JSON.parse(body.toString('utf8'));
    } catch {
      this.logger.warn('Failed to parse Shopify order JSON');
      return;
    }

    await this.fulfilmentService.ingestPaidOrder(order);
  }

  private verifyHmac(rawBody: Buffer | undefined, hmacHeader: string | undefined): Buffer {
    const secret = (this.configService.get<string>('SHOPIFY_WEBHOOK_SECRET') ?? '').trim();
    if (!secret || /your_shopify|webhook_secret_here/i.test(secret)) {
      this.logger.warn('SHOPIFY_WEBHOOK_SECRET is missing or still a placeholder — HMAC cannot match');
      throw new ForbiddenException('SHOPIFY_INVALID_SIGNATURE');
    }
    if (!rawBody || rawBody.length === 0 || !hmacHeader) {
      this.logger.warn('Shopify webhook missing raw body or HMAC header');
      throw new ForbiddenException('SHOPIFY_INVALID_SIGNATURE');
    }

    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    const digest = Buffer.from(computed);
    const received = Buffer.from(hmacHeader);
    if (digest.length !== received.length || !crypto.timingSafeEqual(digest, received)) {
      this.logger.warn('Shopify HMAC verification failed');
      throw new ForbiddenException('SHOPIFY_INVALID_SIGNATURE');
    }

    return rawBody;
  }
}
