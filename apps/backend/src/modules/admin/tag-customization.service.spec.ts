import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TagCustomizationService } from './tag-customization.service';
import { AuditLogService } from './audit-log.service';
import { DRIZZLE } from '../../database/database.module';

const mockDb: any = {
  select: jest.fn(),
  from: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  insert: jest.fn(),
  values: jest.fn(),
  returning: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const mockAuditLog = { log: jest.fn() };

const MOCK_THEME = {
  id: 'theme-1',
  name: 'Default Orange',
  accentColor: '#f97316',
  backgroundStyle: 'light',
  showLogo: true,
  logoUrl: null,
  tierRequired: 'free',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_TEMPLATE = {
  id: 'tpl-1',
  name: 'Standard Square',
  formatType: 'square',
  tierRequired: 'free',
  backgroundColor: '#ffffff',
  logoPlacement: 'top-left',
  logoSize: 40,
  qrPosition: 'center',
  qrSize: 120,
  textSlots: {},
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('TagCustomizationService', () => {
  let service: TagCustomizationService;

  beforeEach(async () => {
    jest.resetAllMocks();

    mockDb.select.mockReturnThis();
    mockDb.from.mockResolvedValue([]);
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagCustomizationService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<TagCustomizationService>(TagCustomizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Visual Themes ──────────────────────────────────────────────────────────

  describe('listVisualThemes', () => {
    it('returns all themes when activeOnly=false', async () => {
      const inactive = { ...MOCK_THEME, id: 'theme-2', isActive: false };
      mockDb.from.mockResolvedValue([MOCK_THEME, inactive]);
      const result = await service.listVisualThemes(false);
      expect(result).toHaveLength(2);
    });

    it('filters inactive themes when activeOnly=true', async () => {
      const inactive = { ...MOCK_THEME, id: 'theme-2', isActive: false };
      mockDb.from.mockResolvedValue([MOCK_THEME, inactive]);
      const result = await service.listVisualThemes(true);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('theme-1');
    });
  });

  describe('getVisualTheme', () => {
    it('returns a theme by id', async () => {
      mockDb.limit.mockResolvedValue([MOCK_THEME]);
      const result = await service.getVisualTheme('theme-1');
      expect(result).toEqual(MOCK_THEME);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockDb.limit.mockResolvedValue([]);
      await expect(service.getVisualTheme('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createVisualTheme', () => {
    it('creates a theme and writes audit log', async () => {
      mockDb.returning.mockResolvedValue([MOCK_THEME]);
      const result = await service.createVisualTheme('admin-1', { name: 'Default Orange' });
      expect(result).toEqual(MOCK_THEME);
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        'admin-1',
        'CREATE_VISUAL_THEME',
        'visual_theme',
        'theme-1',
        expect.objectContaining({ name: 'Default Orange' }),
      );
    });
  });

  describe('updateVisualTheme', () => {
    it('updates a theme and writes audit log', async () => {
      mockDb.limit.mockResolvedValue([MOCK_THEME]);
      const updated = { ...MOCK_THEME, name: 'Renamed' };
      mockDb.returning.mockResolvedValue([updated]);
      const result = await service.updateVisualTheme('admin-1', 'theme-1', { name: 'Renamed' });
      expect(result.name).toBe('Renamed');
      expect(mockAuditLog.log).toHaveBeenCalledWith('admin-1', 'UPDATE_VISUAL_THEME', 'visual_theme', 'theme-1', expect.any(Object));
    });

    it('throws NotFoundException if theme does not exist', async () => {
      mockDb.limit.mockResolvedValue([]);
      await expect(service.updateVisualTheme('admin-1', 'bad-id', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteVisualTheme', () => {
    it('deletes a theme and writes audit log', async () => {
      mockDb.limit.mockResolvedValue([MOCK_THEME]);
      const result = await service.deleteVisualTheme('admin-1', 'theme-1');
      expect(result).toEqual({ message: 'Visual theme deleted.' });
      expect(mockAuditLog.log).toHaveBeenCalledWith('admin-1', 'DELETE_VISUAL_THEME', 'visual_theme', 'theme-1');
    });

    it('throws NotFoundException if theme does not exist', async () => {
      mockDb.limit.mockResolvedValue([]);
      await expect(service.deleteVisualTheme('admin-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Print Templates ────────────────────────────────────────────────────────

  describe('listPrintTemplates', () => {
    it('returns all templates when activeOnly=false', async () => {
      const inactive = { ...MOCK_TEMPLATE, id: 'tpl-2', isActive: false };
      mockDb.from.mockResolvedValue([MOCK_TEMPLATE, inactive]);
      const result = await service.listPrintTemplates(false);
      expect(result).toHaveLength(2);
    });

    it('filters inactive templates when activeOnly=true', async () => {
      const inactive = { ...MOCK_TEMPLATE, id: 'tpl-2', isActive: false };
      mockDb.from.mockResolvedValue([MOCK_TEMPLATE, inactive]);
      const result = await service.listPrintTemplates(true);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tpl-1');
    });
  });

  describe('createPrintTemplate', () => {
    it('creates a template and writes audit log', async () => {
      mockDb.returning.mockResolvedValue([MOCK_TEMPLATE]);
      const result = await service.createPrintTemplate('admin-1', { name: 'Standard Square', formatType: 'square' });
      expect(result).toEqual(MOCK_TEMPLATE);
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        'admin-1',
        'CREATE_PRINT_TEMPLATE',
        'print_template',
        'tpl-1',
        expect.objectContaining({ name: 'Standard Square' }),
      );
    });
  });

  describe('deletePrintTemplate', () => {
    it('deletes a template and writes audit log', async () => {
      mockDb.limit.mockResolvedValue([MOCK_TEMPLATE]);
      const result = await service.deletePrintTemplate('admin-1', 'tpl-1');
      expect(result).toEqual({ message: 'Print template deleted.' });
      expect(mockAuditLog.log).toHaveBeenCalledWith('admin-1', 'DELETE_PRINT_TEMPLATE', 'print_template', 'tpl-1');
    });
  });
});
