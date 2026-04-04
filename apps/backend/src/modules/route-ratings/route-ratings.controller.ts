import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RouteRatingsService } from './route-ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Controller('route-ratings')
export class RouteRatingsController {
  constructor(private readonly routeRatingsService: RouteRatingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser('id') userId: string, @Body() dto: CreateRatingDto) {
    return this.routeRatingsService.create(userId, dto);
  }

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.routeRatingsService.listByUser(userId);
  }
}
