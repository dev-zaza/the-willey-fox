import { Module } from '@nestjs/common';
import { RouteRatingsService } from './route-ratings.service';
import { RouteRatingsController } from './route-ratings.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [NotificationsModule, UsersModule],
  controllers: [RouteRatingsController],
  providers: [RouteRatingsService],
  exports: [RouteRatingsService],
})
export class RouteRatingsModule {}
