import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { ShopifyWebhookService } from './shopify-webhook.service';
import { CreateCheckoutDto, UpdateSubscriptionDto } from './dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('JWT')
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly shopifyWebhookService: ShopifyWebhookService,
  ) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  createCheckout(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.paymentsService.createCheckout(userId, dto);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentsService.handleWebhook(req.rawBody!, signature);
  }

  @Get('subscription')
  getSubscription(@CurrentUser('id') userId: string) {
    return this.paymentsService.getSubscription(userId);
  }

  @Delete('subscription')
  @HttpCode(HttpStatus.OK)
  cancelSubscription(@CurrentUser('id') userId: string) {
    return this.paymentsService.cancelSubscription(userId);
  }

  @Patch('subscription')
  @HttpCode(HttpStatus.OK)
  updateSubscription(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.paymentsService.updateSubscription(userId, dto);
  }

  @Post('billing-portal')
  @HttpCode(HttpStatus.OK)
  createBillingPortalSession(@CurrentUser('id') userId: string) {
    return this.paymentsService.createBillingPortalSession(userId);
  }

  @Public()
  @Post('webhook/shopify')
  @HttpCode(HttpStatus.OK)
  handleShopifyWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') hmac: string,
  ) {
    return this.shopifyWebhookService.handleOrderCreated(req.rawBody!, hmac);
  }

  @Get('invoices')
  getInvoices(@CurrentUser('id') userId: string) {
    return this.paymentsService.getInvoices(userId);
  }
}
