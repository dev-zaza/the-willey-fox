import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QrService } from './qr.service';
import { DRIZZLE } from '../../database/database.module';
import { SettingsService } from '../settings/settings.service';

// ─── Drizzle mock factory ─────────────────────────────────────────────────────
// QrService uses two query patterns:
//   A) select().from().where().limit(1)  → enqueueLimit(result)
//   B) select({count}).from().where()    → enqueueDirect(result) — direct await, no .limit()
//
// Each call to where() consumes one entry from the queue.
// update().set().where() also consumes a queue slot (use enqueueIgnore for those).
function buildMockDb() {
  const queue: Array<{ type: 'limit' | 'direct'; value: unknown }> = [];

  const db: any = {
    _queue: queue,
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockImplementation(function (this: any) {
      const entry = queue.shift();
      if (!entry) {
        // No queued response — this is an update/delete where() call; return db for chaining
        return db;
      }
      if (entry.type === 'direct') {
        return {
          limit: jest.fn().mockResolvedValue(entry.value),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
            void Promise.resolve(entry.value).then(resolve, reject);
          },
        };
      }
      // type === 'limit': return object with both .limit() and .returning() for chaining
      return {
        limit: jest.fn().mockResolvedValue(entry.value),
        returning: jest.fn().mockResolvedValue(entry.value),
      };
    }),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  };

  const enqueueLimit = (v: unknown) => queue.push({ type: 'limit', value: v });
  // direct: resolved without .limit() — for count() queries
  const enqueueDirect = (v: unknown) => queue.push({ type: 'direct', value: v });
  // ignore: update().set().where() slot — no meaningful result
  const enqueueIgnore = () => queue.push({ type: 'limit', value: [] });

  return { db, enqueueLimit, enqueueDirect, enqueueIgnore };
}

const mockConfig = {
  get: jest.fn((key: string, def?: unknown) => {
    const vals: Record<string, unknown> = { PUBLIC_BASE_URL: 'http://localhost:3001' };
    return vals[key] ?? def;
  }),
};

const mockSettings = {
  getPricingConfig: jest.fn(),
};

const baseQr = {
  id: 'qr-1',
  userId: 'user-1',
  uniqueCode: 'ABC12345',
  status: 'active',
  isActive: true,
  isLost: false,
  category: 'pets',
  name: 'Fluffy',
  label: 'Fluffy',
  description: 'My cat',
  visibilityConfig: { showName: true, showPhoto: true, showDescription: true, showCustomFields: false },
  customFields: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('QrService', () => {
  let service: QrService;
  let db: any;
  let enqueueLimit: (v: unknown) => void;
  let enqueueDirect: (v: unknown) => void;

  beforeEach(async () => {
    const built = buildMockDb();
    db = built.db;
    enqueueLimit = built.enqueueLimit;
    enqueueDirect = built.enqueueDirect;

    mockSettings.getPricingConfig.mockResolvedValue({
      tierLimits: {
        free: { maxQrCodes: 3, maxGuardians: 3 },
        premium: { maxQrCodes: 25, maxGuardians: 25 },
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrService,
        { provide: DRIZZLE, useValue: db },
        { provide: ConfigService, useValue: mockConfig },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get<QrService>(QrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── create ──────────────────────────────────────────────────────────────────
  // create(): count query uses direct await (enqueueDirect); then insert.returning()
  describe('create', () => {
    it('inserts a new QR code and returns it', async () => {
      enqueueDirect([{ activeCount: 0 }]);        // count() query direct await
      db.returning.mockResolvedValueOnce([baseQr]);

      const result = await service.create('user-1', 'free', { category: 'pets' as any, name: 'Fluffy' });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(baseQr);
    });

    it('throws ForbiddenException when tier limit is reached', async () => {
      enqueueDirect([{ activeCount: 3 }]); // at limit

      await expect(
        service.create('user-1', 'free', { category: 'pets' as any, name: 'Extra' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('applies default visibility config when none provided', async () => {
      enqueueDirect([{ activeCount: 0 }]);
      db.returning.mockResolvedValueOnce([baseQr]);

      await service.create('user-1', 'free', { category: 'items' as any, name: 'Keys' });

      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({ visibilityConfig: expect.objectContaining({ showName: true }) }),
      );
    });
  });

  // ── findAllByUser ───────────────────────────────────────────────────────────
  // findAllByUser: two direct-await queries (owned QRs, guardian mappings)
  describe('findAllByUser', () => {
    it('returns owned QR codes for the user', async () => {
      enqueueDirect([baseQr]); // owned QRs
      enqueueDirect([]);        // guardian mappings → empty

      const result = await service.findAllByUser('user-1');
      expect(result).toContainEqual(baseQr);
    });
  });

  // ── findById ────────────────────────────────────────────────────────────────
  // findById uses .where().limit()
  describe('findById', () => {
    it('returns the QR code when found', async () => {
      enqueueLimit([baseQr]);

      const result = await service.findById('qr-1');
      expect(result).toEqual(baseQr);
    });

    it('returns null when QR code does not exist', async () => {
      enqueueLimit([]);

      const result = await service.findById('qr-missing');
      expect(result).toBeNull();
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────
  // update: update().set().where().returning() — where() falls through to db when queue empty
  describe('update', () => {
    it('updates the QR code fields and returns updated record', async () => {
      const updated = { ...baseQr, name: 'New Name' };
      db.returning.mockResolvedValueOnce([updated]);

      const result = await service.update('qr-1', { name: 'New Name' });

      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });
  });

  // ── markLost / markFound ────────────────────────────────────────────────────
  // markLost: existence check (.limit()), then update().set().where().returning()
  describe('markLost', () => {
    it('sets isLost=true for existing QR', async () => {
      enqueueLimit([{ id: 'qr-1' }]); // existence check; update where() falls through
      const lost = { ...baseQr, isLost: true };
      db.returning.mockResolvedValueOnce([lost]);

      const result = await service.markLost('qr-1');
      expect(result).toHaveProperty('isLost', true);
    });

    it('throws NotFoundException when QR does not exist', async () => {
      enqueueLimit([]); // not found

      await expect(service.markLost('qr-missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markFound', () => {
    it('sets isLost=false for existing QR', async () => {
      enqueueLimit([{ id: 'qr-1' }]); // existence check; update where() falls through
      const found = { ...baseQr, isLost: false };
      db.returning.mockResolvedValueOnce([found]);

      const result = await service.markFound('qr-1');
      expect(result).toHaveProperty('isLost', false);
    });

    it('throws NotFoundException when QR does not exist', async () => {
      enqueueLimit([]);

      await expect(service.markFound('qr-missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── deactivate ──────────────────────────────────────────────────────────────
  describe('deactivate', () => {
    it('sets isActive=false and returns message', async () => {
      // update where() falls through when queue empty
      const result = await service.deactivate('qr-1');
      expect(db.update).toHaveBeenCalled();
      expect(result.message).toContain('deactivated');
    });
  });

  // ── claimQrCode ─────────────────────────────────────────────────────────────
  // claimQrCode: QR lookup (.limit()), then count query (direct), then update().set().where().returning()
  describe('claimQrCode', () => {
    it('transitions unclaimed QR to active and assigns owner', async () => {
      const unclaimedQr = { ...baseQr, status: 'unclaimed', userId: null, isActive: false };
      const claimedQr = { ...baseQr, status: 'active', userId: 'user-2', isActive: true };

      enqueueLimit([unclaimedQr]);              // 1. QR lookup by uniqueCode
      enqueueDirect([{ activeCount: 0 }]);       // 2. count query; update where() falls through
      db.returning.mockResolvedValueOnce([claimedQr]);

      const result = await service.claimQrCode('ABC12345', 'user-2', 'free', {
        category: 'pets' as any,
        name: 'My Tag',
      });

      expect(db.update).toHaveBeenCalled();
      expect(result).toHaveProperty('status', 'active');
    });

    it('throws NotFoundException when code does not exist', async () => {
      enqueueLimit([]); // QR not found

      await expect(
        service.claimQrCode('INVALID', 'user-1', 'free', { category: 'pets' as any, name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when QR is already claimed', async () => {
      enqueueLimit([{ ...baseQr, status: 'active' }]); // already active

      await expect(
        service.claimQrCode('ABC12345', 'user-2', 'free', { category: 'pets' as any, name: 'X' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when tier limit reached', async () => {
      enqueueLimit([{ ...baseQr, status: 'unclaimed' }]); // QR found
      enqueueDirect([{ activeCount: 5 }]);                  // at free limit (TIER_LIMITS.free.maxQrCodes = 5)

      await expect(
        service.claimQrCode('ABC12345', 'user-1', 'free', { category: 'pets' as any, name: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── bulkCreate ──────────────────────────────────────────────────────────────
  describe('bulkCreate', () => {
    it('creates multiple QR codes for premium users', async () => {
      const bulkQrs = [{ id: 'qr-a', uniqueCode: 'A1' }, { id: 'qr-b', uniqueCode: 'B2' }];
      enqueueDirect([{ activeCount: 0 }]); // count query
      db.returning.mockResolvedValueOnce(bulkQrs);

      const result = await service.bulkCreate('user-1', 'premium', { count: 2, category: 'items' as any });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('throws ForbiddenException for free-tier users', async () => {
      await expect(
        service.bulkCreate('user-1', 'free', { count: 5, category: 'items' as any }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── bulkGenerateUnclaimed ────────────────────────────────────────────────────
  describe('bulkGenerateUnclaimed', () => {
    it('generates N unclaimed QR codes with status=unclaimed', async () => {
      const generated = Array.from({ length: 3 }, (_, i) => ({ id: `qr-${i}`, uniqueCode: `CODE${i}` }));
      db.returning.mockResolvedValueOnce(generated);

      const result = await service.bulkGenerateUnclaimed(3);

      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ status: 'unclaimed', isActive: false })]),
      );
      expect(result).toHaveLength(3);
    });

    it('throws BadRequestException when count is 0 or over 500', async () => {
      await expect(service.bulkGenerateUnclaimed(0)).rejects.toThrow(BadRequestException);
      await expect(service.bulkGenerateUnclaimed(501)).rejects.toThrow(BadRequestException);
    });
  });

  // ── setTheme ─────────────────────────────────────────────────────────────────
  // setTheme: QR lookup (.limit()), optional theme lookup (.limit()), then update().set().where().returning()
  describe('setTheme', () => {
    const mockTheme = { tierRequired: 'free', isActive: true };

    it('sets themeId to null (clear theme)', async () => {
      enqueueLimit([{ id: 'qr-1', userId: 'user-1' }]); // QR ownership check; theme lookup skipped for null
      const updated = { ...baseQr, themeId: null };
      db.returning.mockResolvedValueOnce([updated]);

      const result = await service.setTheme('qr-1', 'user-1', 'free', { themeId: null });
      expect(result).toHaveProperty('themeId', null);
    });

    it('sets a free theme for a free-tier user', async () => {
      enqueueLimit([{ id: 'qr-1', userId: 'user-1' }]); // QR ownership check
      enqueueLimit([mockTheme]);                           // theme lookup
      const updated = { ...baseQr, themeId: 'theme-1' };
      db.returning.mockResolvedValueOnce([updated]);

      const result = await service.setTheme('qr-1', 'user-1', 'free', { themeId: 'theme-1' });
      expect(result).toHaveProperty('themeId', 'theme-1');
    });

    it('throws ForbiddenException when theme requires premium but user is free', async () => {
      enqueueLimit([{ id: 'qr-1', userId: 'user-1' }]);           // QR ownership check
      enqueueLimit([{ tierRequired: 'premium', isActive: true }]); // premium theme

      await expect(
        service.setTheme('qr-1', 'user-1', 'free', { themeId: 'premium-theme' }),
      ).rejects.toThrow('THEME_TIER_REQUIRED');
    });

    it('throws NotFoundException when QR does not exist', async () => {
      enqueueLimit([]); // no QR
      await expect(service.setTheme('bad-qr', 'user-1', 'free', {})).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the owner', async () => {
      enqueueLimit([{ id: 'qr-1', userId: 'owner-99' }]); // different owner
      await expect(service.setTheme('qr-1', 'user-1', 'free', {})).rejects.toThrow('QR_NOT_OWNER');
    });

    it('throws NotFoundException when theme does not exist or is inactive', async () => {
      enqueueLimit([{ id: 'qr-1', userId: 'user-1' }]); // QR ownership check
      enqueueLimit([]);                                    // theme not found
      await expect(
        service.setTheme('qr-1', 'user-1', 'free', { themeId: 'bad-theme' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── isOwnerOrGuardian ────────────────────────────────────────────────────────
  // isOwnerOrGuardian: QR lookup (.limit()), then optionally guardian lookup (.limit())
  describe('isOwnerOrGuardian', () => {
    it('returns true when user is the owner', async () => {
      enqueueLimit([{ userId: 'user-1' }]); // QR belongs to user-1

      const result = await service.isOwnerOrGuardian('qr-1', 'user-1');
      expect(result).toBe(true);
    });

    it('returns true when user is an active guardian', async () => {
      enqueueLimit([{ userId: 'owner-99' }]); // different owner
      enqueueLimit([{ id: 'gm-1' }]);          // guardian record found

      const result = await service.isOwnerOrGuardian('qr-1', 'user-1');
      expect(result).toBe(true);
    });

    it('returns false when QR does not exist', async () => {
      enqueueLimit([]); // no QR

      const result = await service.isOwnerOrGuardian('qr-missing', 'user-1');
      expect(result).toBe(false);
    });

    it('returns false when user is neither owner nor active guardian', async () => {
      enqueueLimit([{ userId: 'owner-99' }]); // different owner
      enqueueLimit([]);                          // not a guardian

      const result = await service.isOwnerOrGuardian('qr-1', 'user-1');
      expect(result).toBe(false);
    });
  });
});
