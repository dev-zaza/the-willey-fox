import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { TagCustomizationService } from './tag-customization.service';
import { AdminGuard } from './guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BulkGenerateQrDto } from '../qr/dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { UpdateQrCategoryDto } from './dto/update-qr-category.dto';
import { CreatePrintTemplateDto } from './dto/create-print-template.dto';
import { UpdatePrintTemplateDto } from './dto/update-print-template.dto';
import { CreateVisualThemeDto } from './dto/create-visual-theme.dto';
import { UpdateVisualThemeDto } from './dto/update-visual-theme.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly tagCustomizationService: TagCustomizationService,
  ) {}

  @Get('users')
  listUsers(
    @Query('q') q?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listUsers(q, limit, offset);
  }

  @Put('users/:id/ban')
  banUser(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BanUserDto,
  ) {
    return this.adminService.banUser(user.id, id, dto);
  }

  @Put('users/:id/unban')
  unbanUser(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.unbanUser(user.id, id);
  }

  @Get('qr-codes')
  listQrCodes(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listQrCodes(limit, offset);
  }

  @Get('reports')
  listReports(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
    @Query('status') status?: string,
  ) {
    return this.adminService.listReports(limit, offset, status);
  }

  @Patch('reports/:id/status')
  updateReportStatus(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.adminService.updateReportStatus(user.id, id, dto.status);
  }

  @Get('pins')
  listPins(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listPins(limit, offset);
  }

  @Delete('pins/:id')
  deletePin(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.deletePin(user.id, id);
  }

  @Post('qr/bulk-generate')
  bulkGenerateUnclaimed(
    @CurrentUser() user: { id: string },
    @Body() dto: BulkGenerateQrDto,
  ) {
    return this.adminService.bulkGenerateUnclaimed(user.id, dto.count, dto.shopifyOrderId);
  }

  @Get('settings/pricing')
  getPricing() {
    return this.adminService.getPricingConfig();
  }

  @Put('settings/pricing')
  updatePricing(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePricingDto,
  ) {
    return this.adminService.updatePricingConfig(user.id, dto);
  }

  @Get('settings/qr-categories')
  getQrCategories() {
    return this.adminService.getQrCategories();
  }

  @Patch('settings/qr-categories/:value')
  updateQrCategory(
    @CurrentUser() user: { id: string },
    @Param('value') value: string,
    @Body() dto: UpdateQrCategoryDto,
  ) {
    return this.adminService.updateQrCategory(user.id, value, dto);
  }

  @Get('settings/qr-template')
  getQrTemplate() {
    return this.adminService.getQrTemplate();
  }

  @Put('settings/qr-template')
  updateQrTemplate(
    @CurrentUser() user: { id: string },
    @Body() dto: Record<string, unknown>,
  ) {
    return this.adminService.updateQrTemplate(user.id, dto);
  }

  @Get('analytics')
  getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('safety/ingestion-logs')
  listIngestionLogs(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listIngestionLogs(limit, offset);
  }

  @Get('safety/zones')
  listSafetyZones(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listSafetyZones(limit, offset);
  }

  @Get('audit-logs')
  listAuditLogs(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listAuditLogs(limit, offset);
  }

  @Get('user-reports')
  listUserReports(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listUserReports(limit, offset);
  }

  @Delete('user-reports/:id')
  dismissUserReport(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.dismissUserReport(user.id, id);
  }

  // ── Print Templates ──────────────────────────────────────────────────────────

  @Get('print-templates')
  listPrintTemplates() {
    return this.tagCustomizationService.listPrintTemplates();
  }

  @Post('print-templates')
  createPrintTemplate(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePrintTemplateDto,
  ) {
    return this.tagCustomizationService.createPrintTemplate(user.id, dto);
  }

  @Get('print-templates/:id')
  getPrintTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.tagCustomizationService.getPrintTemplate(id);
  }

  @Put('print-templates/:id')
  updatePrintTemplate(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrintTemplateDto,
  ) {
    return this.tagCustomizationService.updatePrintTemplate(user.id, id, dto);
  }

  @Delete('print-templates/:id')
  deletePrintTemplate(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tagCustomizationService.deletePrintTemplate(user.id, id);
  }

  // ── Visual Themes ────────────────────────────────────────────────────────────

  @Get('visual-themes')
  listVisualThemes() {
    return this.tagCustomizationService.listVisualThemes();
  }

  @Post('visual-themes')
  createVisualTheme(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateVisualThemeDto,
  ) {
    return this.tagCustomizationService.createVisualTheme(user.id, dto);
  }

  @Get('visual-themes/:id')
  getVisualTheme(@Param('id', ParseUUIDPipe) id: string) {
    return this.tagCustomizationService.getVisualTheme(id);
  }

  @Put('visual-themes/:id')
  updateVisualTheme(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisualThemeDto,
  ) {
    return this.tagCustomizationService.updateVisualTheme(user.id, id, dto);
  }

  @Delete('visual-themes/:id')
  deleteVisualTheme(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tagCustomizationService.deleteVisualTheme(user.id, id);
  }
}
