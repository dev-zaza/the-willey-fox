import { Controller, Get, Post, Put, Delete, Param, Body, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import {
  UpdateReportStatusDto,
  CreateResponseDto,
  FlagReportDto,
  EnableBroadcastDto,
  DisableBroadcastDto,
} from './dto';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BroadcastEnabledGuard } from '../broadcasts/broadcast-enabled.guard';

function buildBroadcastCtx(req: Request) {
  return {
    ipAddress: (req.ip ?? req.socket?.remoteAddress ?? null) as string | null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
  };
}

@ApiBearerAuth('JWT')
@ApiTags('reports')
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

  @UseGuards(BroadcastEnabledGuard)
  @Post(':id/broadcast')
  enableBroadcast(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnableBroadcastDto,
    @Req() req: Request,
  ) {
    return this.reportsService.enableBroadcast(id, user.id, dto, buildBroadcastCtx(req));
  }

  @UseGuards(BroadcastEnabledGuard)
  @Delete(':id/broadcast')
  disableBroadcast(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DisableBroadcastDto,
    @Req() req: Request,
  ) {
    return this.reportsService.disableBroadcast(id, user.id, dto, buildBroadcastCtx(req));
  }

  @UseGuards(BroadcastEnabledGuard)
  @Post(':id/broadcast/extend')
  extendBroadcast(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.reportsService.extendBroadcast(id, user.id, buildBroadcastCtx(req));
  }
}
