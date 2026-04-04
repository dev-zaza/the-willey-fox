import {
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { printTemplates, visualThemes } from '../../database/schema';
import { AuditLogService } from './audit-log.service';
import { CreatePrintTemplateDto } from './dto/create-print-template.dto';
import { UpdatePrintTemplateDto } from './dto/update-print-template.dto';
import { CreateVisualThemeDto } from './dto/create-visual-theme.dto';
import { UpdateVisualThemeDto } from './dto/update-visual-theme.dto';

@Injectable()
export class TagCustomizationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ── Print Templates ──────────────────────────────────────────────────────────

  async listPrintTemplates(activeOnly = false) {
    const rows = await this.db.select().from(printTemplates);
    return activeOnly ? rows.filter((r) => r.isActive) : rows;
  }

  async getPrintTemplate(id: string) {
    const [row] = await this.db
      .select()
      .from(printTemplates)
      .where(eq(printTemplates.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('PRINT_TEMPLATE_NOT_FOUND');
    return row;
  }

  async createPrintTemplate(adminId: string, dto: CreatePrintTemplateDto) {
    const [created] = await this.db
      .insert(printTemplates)
      .values({
        name: dto.name,
        formatType: dto.formatType,
        tierRequired: dto.tierRequired ?? 'free',
        backgroundColor: dto.backgroundColor ?? '#ffffff',
        logoPlacement: dto.logoPlacement ?? 'top-left',
        logoSize: dto.logoSize ?? 40,
        qrPosition: dto.qrPosition ?? 'center',
        qrSize: dto.qrSize ?? 120,
        textSlots: dto.textSlots ?? {},
        isActive: dto.isActive ?? true,
      })
      .returning();

    this.auditLogService.log(adminId, 'CREATE_PRINT_TEMPLATE', 'print_template', created.id, { name: dto.name });
    return created;
  }

  async updatePrintTemplate(adminId: string, id: string, dto: UpdatePrintTemplateDto) {
    await this.getPrintTemplate(id);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.formatType !== undefined) updateData.formatType = dto.formatType;
    if (dto.tierRequired !== undefined) updateData.tierRequired = dto.tierRequired;
    if (dto.backgroundColor !== undefined) updateData.backgroundColor = dto.backgroundColor;
    if (dto.logoPlacement !== undefined) updateData.logoPlacement = dto.logoPlacement;
    if (dto.logoSize !== undefined) updateData.logoSize = dto.logoSize;
    if (dto.qrPosition !== undefined) updateData.qrPosition = dto.qrPosition;
    if (dto.qrSize !== undefined) updateData.qrSize = dto.qrSize;
    if (dto.textSlots !== undefined) updateData.textSlots = dto.textSlots;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const [updated] = await this.db
      .update(printTemplates)
      .set(updateData)
      .where(eq(printTemplates.id, id))
      .returning();

    this.auditLogService.log(adminId, 'UPDATE_PRINT_TEMPLATE', 'print_template', id, dto as Record<string, unknown>);
    return updated;
  }

  async deletePrintTemplate(adminId: string, id: string) {
    await this.getPrintTemplate(id);
    await this.db.delete(printTemplates).where(eq(printTemplates.id, id));
    this.auditLogService.log(adminId, 'DELETE_PRINT_TEMPLATE', 'print_template', id);
    return { message: 'Print template deleted.' };
  }

  // ── Visual Themes ────────────────────────────────────────────────────────────

  async listVisualThemes(activeOnly = false) {
    const rows = await this.db.select().from(visualThemes);
    return activeOnly ? rows.filter((r) => r.isActive) : rows;
  }

  async getVisualTheme(id: string) {
    const [row] = await this.db
      .select()
      .from(visualThemes)
      .where(eq(visualThemes.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('VISUAL_THEME_NOT_FOUND');
    return row;
  }

  async createVisualTheme(adminId: string, dto: CreateVisualThemeDto) {
    const [created] = await this.db
      .insert(visualThemes)
      .values({
        name: dto.name,
        accentColor: dto.accentColor ?? '#f97316',
        backgroundStyle: dto.backgroundStyle ?? 'light',
        showLogo: dto.showLogo ?? true,
        logoUrl: dto.logoUrl ?? null,
        tierRequired: dto.tierRequired ?? 'free',
        isActive: dto.isActive ?? true,
      })
      .returning();

    this.auditLogService.log(adminId, 'CREATE_VISUAL_THEME', 'visual_theme', created.id, { name: dto.name });
    return created;
  }

  async updateVisualTheme(adminId: string, id: string, dto: UpdateVisualThemeDto) {
    await this.getVisualTheme(id);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.accentColor !== undefined) updateData.accentColor = dto.accentColor;
    if (dto.backgroundStyle !== undefined) updateData.backgroundStyle = dto.backgroundStyle;
    if (dto.showLogo !== undefined) updateData.showLogo = dto.showLogo;
    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;
    if (dto.tierRequired !== undefined) updateData.tierRequired = dto.tierRequired;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const [updated] = await this.db
      .update(visualThemes)
      .set(updateData)
      .where(eq(visualThemes.id, id))
      .returning();

    this.auditLogService.log(adminId, 'UPDATE_VISUAL_THEME', 'visual_theme', id, dto as Record<string, unknown>);
    return updated;
  }

  async deleteVisualTheme(adminId: string, id: string) {
    await this.getVisualTheme(id);
    await this.db.delete(visualThemes).where(eq(visualThemes.id, id));
    this.auditLogService.log(adminId, 'DELETE_VISUAL_THEME', 'visual_theme', id);
    return { message: 'Visual theme deleted.' };
  }
}
