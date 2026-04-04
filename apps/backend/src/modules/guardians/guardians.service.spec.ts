import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GuardiansService } from './guardians.service';
import { DRIZZLE } from '../../database/database.module';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';

// ─── Drizzle mock factory ─────────────────────────────────────────────────────
// GuardiansService mixes:
//   A) select().from().where().limit(1)      → enqueueLimit()
//   B) select().from().where() direct await  → enqueueDirect()
//   C) innerJoin().where() result            → enqueueDirect() (list result)
//   D) update().set().where()                → falls through when queue empty
//   E) insert().values().returning()         → db.returning.mockResolvedValueOnce()
function buildMockDb() {
  const queue: Array<{ type: 'limit' | 'direct'; value: unknown }> = [];

  const db: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockImplementation(function () {
      const entry = queue.shift();
      if (!entry) {
        // update/delete chain: return db itself for continued chaining
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
  const enqueueDirect = (v: unknown) => queue.push({ type: 'direct', value: v });

  return { db, enqueueLimit, enqueueDirect };
}

const mockNotifications = {
  notifyOwnerOfGuardianRequest: jest.fn(),
  notifyGuardianOfApproval: jest.fn(),
  notifyGuardianOfRejection: jest.fn(),
  notifyGuardianOfRemoval: jest.fn(),
  sendGuardianInviteEmail: jest.fn(),
};

const mockSettings = {
  getPricingConfig: jest.fn(),
};

// addReputation is called with .catch(() => {}) — must return a real Promise
const mockUsersService = {
  addReputation: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, def?: unknown) => {
    const vals: Record<string, unknown> = { PUBLIC_BASE_URL: 'http://localhost:3001' };
    return vals[key] ?? def;
  }),
};

const baseQr = {
  id: 'qr-1',
  userId: 'owner-1',
  uniqueCode: 'ABC123',
  name: 'Fluffy',
  category: 'pets',
  isActive: true,
};

const baseMapping = {
  id: 'gm-1',
  qrCodeId: 'qr-1',
  userId: 'guardian-1',
  status: 'pending',
  addedBy: 'guardian-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseInvite = {
  id: 'inv-1',
  qrCodeId: 'qr-1',
  invitedByUserId: 'owner-1',
  email: 'invited@test.com',
  token: 'a'.repeat(64),
  status: 'pending',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
};

describe('GuardiansService', () => {
  let service: GuardiansService;
  let db: any;
  let enqueueLimit: (v: unknown) => void;
  let enqueueDirect: (v: unknown) => void;

  beforeEach(async () => {
    const built = buildMockDb();
    db = built.db;
    enqueueLimit = built.enqueueLimit;
    enqueueDirect = built.enqueueDirect;

    // Restore all notification mocks
    Object.values(mockNotifications).forEach((m) => (m as jest.Mock).mockResolvedValue(undefined));
    // addReputation must return a Promise (called with .catch())
    mockUsersService.addReputation.mockReturnValue(Promise.resolve(undefined));
    mockSettings.getPricingConfig.mockResolvedValue({
      tierLimits: { free: { maxGuardians: 3 }, premium: { maxGuardians: 25 } },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuardiansService,
        { provide: DRIZZLE, useValue: db },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: SettingsService, useValue: mockSettings },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<GuardiansService>(GuardiansService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── listGuardians ────────────────────────────────────────────────────────────
  // listGuardians: innerJoin().where() direct await → list result
  describe('listGuardians', () => {
    it('returns joined guardian + user data', async () => {
      const row = {
        id: 'gm-1', userId: 'guardian-1', status: 'active', addedBy: 'guardian-1',
        firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com', avatarUrl: null,
        createdAt: new Date(),
      };
      enqueueDirect([row]); // innerJoin().where() resolves directly

      const result = await service.listGuardians('qr-1');
      expect(result).toEqual([row]);
    });
  });

  // ── requestAccess ────────────────────────────────────────────────────────────
  // requestAccess: QR .limit(), existing mapping .limit(), then insert
  describe('requestAccess', () => {
    it('creates a pending mapping and notifies owner', async () => {
      enqueueLimit([baseQr]);    // 1. QR lookup
      enqueueLimit([]);          // 2. existing mapping → none

      db.returning.mockResolvedValueOnce([baseMapping]);

      const result = await service.requestAccess('qr-1', 'guardian-1');

      expect(db.insert).toHaveBeenCalled();
      expect(result.status).toBe('pending');
      expect(mockNotifications.notifyOwnerOfGuardianRequest).toHaveBeenCalledWith('owner-1', 'qr-1', 'guardian-1');
    });

    it('throws NotFoundException when QR does not exist', async () => {
      enqueueLimit([]); // QR not found

      await expect(service.requestAccess('qr-missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when requester is the QR owner', async () => {
      enqueueLimit([baseQr]); // QR found, requesterId === owner-1

      await expect(service.requestAccess('qr-1', 'owner-1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when already an active guardian', async () => {
      enqueueLimit([baseQr]);
      enqueueLimit([{ ...baseMapping, status: 'active' }]); // already active

      await expect(service.requestAccess('qr-1', 'guardian-1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when request is already pending', async () => {
      enqueueLimit([baseQr]);
      enqueueLimit([{ ...baseMapping, status: 'pending' }]); // already pending

      await expect(service.requestAccess('qr-1', 'guardian-1')).rejects.toThrow(ConflictException);
    });
  });

  // ── approveGuardian ──────────────────────────────────────────────────────────
  // approveGuardian queries:
  //   1. QR .limit()
  //   2. owner user .limit()
  //   3. active guardians → direct await (no .limit())
  //   4. pending mapping .limit()
  //   Then: update().set().where().returning()
  describe('approveGuardian', () => {
    it('transitions mapping to active, notifies guardian, and awards reputation', async () => {
      const activeMapping = { ...baseMapping, status: 'active' };

      enqueueLimit([{ userId: 'owner-1' }]);          // 1. QR lookup
      enqueueLimit([{ subscriptionTier: 'free' }]);   // 2. owner tier
      enqueueDirect([]);                               // 3. active guardians → 0 (direct await)
      enqueueLimit([baseMapping]);                     // 4. pending mapping found
      db.returning.mockResolvedValueOnce([activeMapping]);

      const result = await service.approveGuardian('qr-1', 'guardian-1', 'owner-1');

      expect(db.update).toHaveBeenCalled();
      expect(result.status).toBe('active');
      expect(mockNotifications.notifyGuardianOfApproval).toHaveBeenCalledWith('guardian-1', 'qr-1', 'owner-1');
      expect(mockUsersService.addReputation).toHaveBeenCalledWith('guardian-1', 2);
    });

    it('throws NotFoundException when QR does not exist', async () => {
      enqueueLimit([]); // QR not found

      await expect(service.approveGuardian('qr-missing', 'guardian-1', 'owner-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when no pending request exists', async () => {
      enqueueLimit([{ userId: 'owner-1' }]);
      enqueueLimit([{ subscriptionTier: 'free' }]);
      enqueueDirect([]);  // active guardians → 0
      enqueueLimit([]);   // no pending mapping

      await expect(service.approveGuardian('qr-1', 'guardian-1', 'owner-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when guardian limit is reached', async () => {
      const activeGuardians = [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }];

      enqueueLimit([{ userId: 'owner-1' }]);
      enqueueLimit([{ subscriptionTier: 'free' }]);
      enqueueDirect(activeGuardians); // 3 at free-tier limit of 3

      await expect(service.approveGuardian('qr-1', 'guardian-1', 'owner-1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── rejectGuardian ───────────────────────────────────────────────────────────
  // rejectGuardian: pending mapping .limit(), then update
  describe('rejectGuardian', () => {
    it('transitions mapping to rejected and notifies guardian', async () => {
      const rejectedMapping = { ...baseMapping, status: 'rejected' };
      enqueueLimit([baseMapping]); // pending mapping found
      db.returning.mockResolvedValueOnce([rejectedMapping]);

      const result = await service.rejectGuardian('qr-1', 'guardian-1', 'owner-1');

      expect(db.update).toHaveBeenCalled();
      expect(result.status).toBe('rejected');
      expect(mockNotifications.notifyGuardianOfRejection).toHaveBeenCalledWith('guardian-1', 'qr-1');
    });

    it('throws NotFoundException when no pending request exists', async () => {
      enqueueLimit([]); // no pending mapping

      await expect(service.rejectGuardian('qr-1', 'guardian-1', 'owner-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── removeGuardian ───────────────────────────────────────────────────────────
  // removeGuardian: mapping .limit(), then update
  describe('removeGuardian', () => {
    it('sets mapping status to removed and notifies guardian', async () => {
      const removedMapping = { ...baseMapping, status: 'removed' };
      enqueueLimit([{ ...baseMapping, status: 'active' }]); // mapping found
      db.returning.mockResolvedValueOnce([removedMapping]);

      const result = await service.removeGuardian('qr-1', 'guardian-1');

      expect(db.update).toHaveBeenCalled();
      expect(result.status).toBe('removed');
      expect(mockNotifications.notifyGuardianOfRemoval).toHaveBeenCalledWith('guardian-1', 'qr-1', 'owner');
    });

    it('throws NotFoundException when guardian mapping does not exist', async () => {
      enqueueLimit([]); // no mapping

      await expect(service.removeGuardian('qr-1', 'not-a-guardian')).rejects.toThrow(NotFoundException);
    });
  });

  // ── inviteGuardianByEmail ────────────────────────────────────────────────────
  // Queries (non-existing user path):
  //   1. QR .limit()
  //   2. owner tier .limit()
  //   3. active guardians → direct await
  //   4. user-by-email .limit() → []
  //   5. inviter name .limit()
  //   Then: insert invite (.returning())
  describe('inviteGuardianByEmail', () => {
    it('creates an invite token and sends email for non-existing user', async () => {
      enqueueLimit([baseQr]);                                          // 1. QR lookup
      enqueueLimit([{ subscriptionTier: 'free' }]);                   // 2. owner tier
      enqueueDirect([]);                                               // 3. active guardians → 0
      enqueueLimit([]);                                                // 4. no user by email
      enqueueLimit([{ firstName: 'Owner', lastName: 'User' }]);       // 5. inviter name
      db.returning.mockResolvedValueOnce([baseInvite]);

      const result = await service.inviteGuardianByEmail('qr-1', 'owner-1', { email: 'new@test.com' });

      expect(result).toHaveProperty('invited', true);
      expect(mockNotifications.sendGuardianInviteEmail).toHaveBeenCalledWith(
        'new@test.com',
        expect.any(String),
        baseQr.name,
        baseQr.category,
        expect.stringContaining('guardian/accept'),
        expect.any(Date),
      );
    });

    it('throws NotFoundException when QR does not exist', async () => {
      enqueueLimit([]); // QR not found

      await expect(
        service.inviteGuardianByEmail('qr-missing', 'owner-1', { email: 'x@y.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── acceptInvite ─────────────────────────────────────────────────────────────
  // acceptInvite queries:
  //   1. invite .limit()
  //   2. QR .limit()
  //   3. existingMapping .limit()
  //   Then: insert guardian mapping, update invite status
  describe('acceptInvite', () => {
    it('creates active guardian mapping for valid token', async () => {
      const activeMapping = { ...baseMapping, status: 'active' };
      enqueueLimit([baseInvite]);  // 1. invite lookup
      enqueueLimit([baseQr]);       // 2. QR lookup
      enqueueLimit([]);             // 3. no existing mapping
      db.returning
        .mockResolvedValueOnce([activeMapping])  // guardian mapping insert
        .mockResolvedValueOnce([]);              // invite update

      const result = await service.acceptInvite(baseInvite.token, 'guardian-1');

      expect(db.insert).toHaveBeenCalled();
      expect(result.status).toBe('active');
      expect(mockUsersService.addReputation).toHaveBeenCalledWith('guardian-1', 2);
    });

    it('throws NotFoundException when token is invalid', async () => {
      enqueueLimit([]); // invite not found

      await expect(service.acceptInvite('bad-token', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when invite is already used', async () => {
      enqueueLimit([{ ...baseInvite, status: 'accepted' }]); // already used

      await expect(service.acceptInvite(baseInvite.token, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when invite has expired', async () => {
      enqueueLimit([{ ...baseInvite, expiresAt: new Date(Date.now() - 1000) }]); // expired

      await expect(service.acceptInvite(baseInvite.token, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when acceptor is the QR owner', async () => {
      enqueueLimit([baseInvite]);    // invite
      enqueueLimit([baseQr]);         // QR (userId = owner-1, same as acceptor)

      await expect(service.acceptInvite(baseInvite.token, 'owner-1')).rejects.toThrow(ConflictException);
    });
  });
});
