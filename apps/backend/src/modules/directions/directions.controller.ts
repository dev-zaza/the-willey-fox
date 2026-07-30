import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus, BadRequestException, Inject } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { DirectionsService } from './directions.service';
import { RouteRequestDto } from './dto/route-request.dto';
import { SafetyOverlayDto } from './dto/safety-overlay.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { checkRouteSafety } from '../safety-engine/lib/route-safety-check';
import type { Feature, LineString } from 'geojson';

@ApiBearerAuth('JWT')
@ApiTags('directions')
@Controller('directions')
export class DirectionsController {
  constructor(
    private readonly directionsService: DirectionsService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

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

  @Public()
  @Post('route-safety-check')
  @HttpCode(HttpStatus.OK)
  async routeSafetyCheck(
    @Body() body: { lineString: Feature<LineString>; resolution?: number },
  ) {
    if (!body?.lineString) throw new BadRequestException('lineString required');
    const resolution = body.resolution ?? 9;
    if (![7, 9, 11].includes(resolution)) {
      throw new BadRequestException('resolution must be 7, 9 or 11');
    }
    return checkRouteSafety(this.db, body.lineString, resolution);
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
