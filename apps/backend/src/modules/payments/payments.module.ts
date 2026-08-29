import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { ShopifyWebhookService } from './shopify-webhook.service';
import { ShopifyFulfilmentService } from './shopify-fulfilment.service';
import { QrModule } from '../qr/qr.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [QrModule, SettingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, ShopifyWebhookService, ShopifyFulfilmentService],
  exports: [PaymentsService, ShopifyFulfilmentService],
})
export class PaymentsModule {}
