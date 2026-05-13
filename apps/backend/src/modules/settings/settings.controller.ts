import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SettingsService } from './settings.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('pricing')
  getPricing() {
    return this.settingsService.getPricingConfig();
  }

  @Public()
  @Get('qr-categories')
  getQrCategories() {
    return this.settingsService.getQrCategories();
  }

  @Public()
  @Get('qr-template')
  getQrTemplate() {
    return this.settingsService.getQrTemplate();
  }

  @Public()
  @Get('visual-themes')
  listVisualThemes() {
    return this.settingsService.listActiveVisualThemes();
  }

  @Public()
  @Get('print-templates')
  listPrintTemplates() {
    return this.settingsService.listActivePrintTemplates();
  }
}
