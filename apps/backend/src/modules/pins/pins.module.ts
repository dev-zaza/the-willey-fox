import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PinsService, PIN_EXPIRY_QUEUE } from './pins.service';
import { PinsController } from './pins.controller';
import { PinExpiryProcessor } from './processors/pin-expiry.processor';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: PIN_EXPIRY_QUEUE }),
    MessagesModule,
    UsersModule,
  ],
  controllers: [PinsController],
  providers: [PinsService, PinExpiryProcessor],
  exports: [PinsService],
})
export class PinsModule {}
