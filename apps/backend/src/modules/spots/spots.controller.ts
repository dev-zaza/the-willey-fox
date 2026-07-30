import {
  Body, Controller, Get, Post, Delete, Param, Query,
  BadRequestException, Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SpotsService } from './spots.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('spots')
@Controller('spots')
export class SpotsController {
  constructor(private readonly spotsService: SpotsService) {}

  @Public()
  @Get()
  list(
    @Query('lat') latStr?: string,
    @Query('lng') lngStr?: string,
    @Query('radius') radiusStr?: string,
  ) {
    const lat = Number(latStr);
    const lng = Number(lngStr);
    const radius = Number(radiusStr) || 10000;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('lat and lng required');
    }
    return this.spotsService.findNearby(lat, lng, radius);
  }

  @Post()
  create(
    @Body() body: {
      locationName: string;
      lat: number;
      lng: number;
      instagramUrl?: string;
      imageUrl?: string;
      caption?: string;
    },
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.spotsService.create({ ...body, userId: req.user?.sub ?? null });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user?: { sub?: string } }) {
    return this.spotsService.remove(id, req.user?.sub ?? null);
  }
}
