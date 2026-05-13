import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PlacesService } from './places.service';
import { SearchPlacesDto, CreatePlaceDto, CreateReviewDto, FlagReviewDto } from './dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('JWT')
@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Public()
  @Get()
  search(@Query() dto: SearchPlacesDto) {
    return this.placesService.search(dto);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.placesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser('id') userId: string, @Body() dto: CreatePlaceDto) {
    return this.placesService.create(userId, dto);
  }

  @Post(':id/reviews')
  @HttpCode(HttpStatus.CREATED)
  createReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.placesService.createReview(id, userId, dto);
  }

  @Put(':id/reviews/:rid')
  updateReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rid', ParseUUIDPipe) rid: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.placesService.updateReview(id, rid, userId, dto);
  }

  @Delete(':id/reviews/:rid')
  @HttpCode(HttpStatus.OK)
  deleteReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rid', ParseUUIDPipe) rid: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.placesService.deleteReview(id, rid, userId);
  }

  @Post(':id/reviews/:rid/flag')
  @HttpCode(HttpStatus.OK)
  flagReview(
    @Param('rid', ParseUUIDPipe) rid: string,
    @CurrentUser('id') userId: string,
    @Body() dto: FlagReviewDto,
  ) {
    return this.placesService.flagReview(rid, userId, dto);
  }
}
