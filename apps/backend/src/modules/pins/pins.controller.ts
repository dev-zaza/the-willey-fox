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
import { PinsService } from './pins.service';
import { CreatePinDto, UpdatePinDto, ListPinsDto, VotePinDto, FlagPinDto } from './dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('JWT')
@ApiTags('pins')
@Controller('pins')
export class PinsController {
  constructor(private readonly pinsService: PinsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser('id') userId: string, @Body() dto: CreatePinDto) {
    return this.pinsService.create(userId, dto);
  }

  @Public()
  @Get()
  list(@Query() dto: ListPinsDto) {
    return this.pinsService.list(dto);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pinsService.findOne(id);
  }

  @Put(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePinDto,
  ) {
    return this.pinsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pinsService.deactivate(userId, id);
  }

  @Post(':id/vote')
  @HttpCode(HttpStatus.OK)
  vote(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VotePinDto,
  ) {
    return this.pinsService.vote(userId, id, dto);
  }

  @Post(':id/flag')
  @HttpCode(HttpStatus.CREATED)
  flagPin(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FlagPinDto,
  ) {
    return this.pinsService.flagPin(userId, id, dto);
  }
}
