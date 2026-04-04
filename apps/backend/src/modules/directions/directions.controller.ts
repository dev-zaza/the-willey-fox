import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { DirectionsService } from './directions.service';
import { RouteRequestDto } from './dto/route-request.dto';
import { SafetyOverlayDto } from './dto/safety-overlay.dto';

@Controller('directions')
export class DirectionsController {
  constructor(private readonly directionsService: DirectionsService) {}

  @Post('route')
  @HttpCode(HttpStatus.OK)
  getRoutes(@Body() dto: RouteRequestDto) {
    return this.directionsService.getRoutes(dto);
  }

  @Public()
  @Get('safety-zone')
  getSafetyZone(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    return this.directionsService.getSafetyScoreForPoint(Number(lat), Number(lng));
  }

  @Public()
  @Get('safety-overlay')
  getSafetyOverlay(@Query() dto: SafetyOverlayDto) {
    return this.directionsService.getSafetyOverlay(dto);
  }

  @Get('geocode')
  geocode(
    @Query('q') q: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.directionsService.geocode(
      q,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }
}
