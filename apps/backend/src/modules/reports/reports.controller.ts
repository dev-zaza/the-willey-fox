import { Controller, Get, Post, Put, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { UpdateReportStatusDto, CreateResponseDto, FlagReportDto } from './dto';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.findByUserQrCodes(user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.findByIdForUser(id, user.id);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, user.id, dto);
  }

  @Post(':id/respond')
  createResponse(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateResponseDto,
  ) {
    return this.reportsService.createResponse(id, user.id, dto);
  }

  @Get(':id/responses')
  getResponses(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getResponses(id, user.id);
  }

  @Post(':id/flag')
  flagReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FlagReportDto,
  ) {
    return this.reportsService.flagReport(id, user.id, dto);
  }
}
