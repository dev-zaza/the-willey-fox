import { Module } from '@nestjs/common';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { QrModule } from '../qr/qr.module';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [NotificationsModule, QrModule, MessagesModule, UsersModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
