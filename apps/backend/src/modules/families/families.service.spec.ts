import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FamiliesService } from './families.service';
import { DRIZZLE } from '../../database/database.module';
import { NotificationsService } from '../notifications/notifications.service';

function buildMockDb() {
  const queue: Array<{ type: 'limit' | 'direct'; value: unknown }> = [];
  const db: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockImplementation(function () {
      const entry = queue.shift();
      if (!entry) return db;
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
    delete: jest.fn().mockReturnThis(),
  };
  return {
    db,
    enqueueLimit: (v: unknown) => queue.push({ type: 'limit', value: v }),
    enqueueDirect: (v: unknown) => queue.push({ type: 'direct', value: v }),
  };
}

const mockNotifications = {
  sendFamilyInviteEmail: jest.fn().mockResolvedValue(undefined),
};

const mockConfig = {
  get: jest.fn((key: string, def?: unknown) => {
    const vals: Record<string, unknown> = {
      PUBLIC_BASE_URL: 'http://localhost:3001',
      NODE_ENV: 'test',
    };
    return vals[key] ?? def;
  }),
};

describe('FamiliesService (UAT invite + create)', () => {
  let service: FamiliesService;
  let mock: ReturnType<typeof buildMockDb>;

  beforeEach(async () => {
    jest.resetAllMocks();
    mock = buildMockDb();
    mockNotifications.sendFamilyInviteEmail.mockResolvedValue(undefined);
    mockConfig.get.mockImplementation((key: string, def?: unknown) => {
      const vals: Record<string, unknown> = {
        PUBLIC_BASE_URL: 'http://localhost:3001',
        NODE_ENV: 'test',
      };
      return vals[key] ?? def;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamiliesService,
        { provide: DRIZZLE, useValue: mock.db },
        { provide: ConfigService, useValue: mockConfig },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(FamiliesService);
  });

  it('create — inserts family + owner membership', async () => {
    mock.db.returning
      .mockResolvedValueOnce([{ id: 'fam-1', name: 'Smith', ownerId: 'u-1' }])
      .mockResolvedValueOnce([{ id: 'mem-1' }]);

    const family = await service.create('u-1', 'Smith');
    expect(family.id).toBe('fam-1');
    expect(mock.db.insert).toHaveBeenCalled();
  });

  describe('addMemberByEmail', () => {
    it('unknown email → pending invite + sendFamilyInviteEmail', async () => {
      // assertOwner
      mock.enqueueLimit([{ ownerId: 'owner-1' }]);
      // user lookup by email → empty
      mock.enqueueLimit([]);
      // family name
      mock.enqueueLimit([{ name: 'Smith Family' }]);
      // inviter name
      mock.enqueueLimit([{ firstName: 'Pat', lastName: 'Owner' }]);
      // existing invite check → empty
      mock.enqueueLimit([]);
      mock.db.returning.mockResolvedValueOnce([
        {
          id: 'inv-1',
          email: 'new@test.com',
          expiresAt: new Date(Date.now() + 86400000),
        },
      ]);

      const result = await service.addMemberByEmail('fam-1', 'owner-1', 'new@test.com');
      expect(result.invited).toBe(true);
      expect(result.added).toBe(false);
      expect(mockNotifications.sendFamilyInviteEmail).toHaveBeenCalledWith(
        'new@test.com',
        'Pat Owner',
        'Smith Family',
        expect.stringContaining('/family/accept?token='),
        expect.any(Date),
        false,
      );
    });

    it('existing user → add member + alreadyAdded email', async () => {
      // assertOwner
      mock.enqueueLimit([{ ownerId: 'owner-1' }]);
      // user lookup
      mock.enqueueLimit([{ id: 'user-2' }]);
      // family name
      mock.enqueueLimit([{ name: 'Smith Family' }]);
      // inviter
      mock.enqueueLimit([{ firstName: 'Pat', lastName: 'Owner' }]);

      // addMember internals:
      // assertOwner again
      mock.enqueueLimit([{ ownerId: 'owner-1' }]);
      // target user exists
      mock.enqueueLimit([{ id: 'user-2' }]);
      // not already member
      mock.enqueueLimit([]);
      mock.db.returning.mockResolvedValueOnce([{ id: 'mem-2', familyId: 'fam-1', userId: 'user-2' }]);
      // syncGuardianMappingsForMember — family qr list
      mock.enqueueDirect([]);

      const result = await service.addMemberByEmail('fam-1', 'owner-1', 'existing@test.com');
      expect(result.added).toBe(true);
      expect(result.invited).toBe(false);
      expect(mockNotifications.sendFamilyInviteEmail).toHaveBeenCalledWith(
        'existing@test.com',
        'Pat Owner',
        'Smith Family',
        expect.stringContaining('/dashboard/family'),
        expect.any(Date),
        true,
      );
    });

    it('duplicate pending invite → ConflictException', async () => {
      mock.enqueueLimit([{ ownerId: 'owner-1' }]);
      mock.enqueueLimit([]); // no user
      mock.enqueueLimit([{ name: 'F' }]);
      mock.enqueueLimit([{ firstName: 'A', lastName: 'B' }]);
      mock.enqueueLimit([{ id: 'inv-existing' }]);

      await expect(
        service.addMemberByEmail('fam-1', 'owner-1', 'dup@test.com'),
      ).rejects.toThrow(ConflictException);
    });

    it('invalid email → BadRequestException', async () => {
      mock.enqueueLimit([{ ownerId: 'owner-1' }]);
      await expect(service.addMemberByEmail('fam-1', 'owner-1', 'not-an-email')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('acceptInvite', () => {
    it('accepts valid token for matching email', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      mock.enqueueLimit([
        {
          id: 'inv-1',
          familyId: 'fam-1',
          email: 'join@test.com',
          status: 'pending',
          role: 'member',
          expiresAt,
          token: 'abc',
        },
      ]);
      mock.enqueueLimit([{ email: 'join@test.com' }]);
      // not already member
      mock.enqueueLimit([]);
      // sync guardians qr list
      mock.enqueueDirect([]);

      const result = await service.acceptInvite('token-hex', 'user-9');
      expect(result.success).toBe(true);
      expect(result.familyId).toBe('fam-1');
      expect(mock.db.update).toHaveBeenCalled();
    });

    it('expired invite → BadRequestException', async () => {
      mock.enqueueLimit([
        {
          id: 'inv-1',
          familyId: 'fam-1',
          email: 'join@test.com',
          status: 'pending',
          role: 'member',
          expiresAt: new Date(Date.now() - 1000),
          token: 'abc',
        },
      ]);
      await expect(service.acceptInvite('token', 'user-9')).rejects.toThrow(BadRequestException);
    });

    it('email mismatch → ForbiddenException', async () => {
      mock.enqueueLimit([
        {
          id: 'inv-1',
          familyId: 'fam-1',
          email: 'join@test.com',
          status: 'pending',
          role: 'member',
          expiresAt: new Date(Date.now() + 86400000),
          token: 'abc',
        },
      ]);
      mock.enqueueLimit([{ email: 'other@test.com' }]);
      await expect(service.acceptInvite('token', 'user-9')).rejects.toThrow(ForbiddenException);
    });

    it('missing invite → NotFoundException', async () => {
      mock.enqueueLimit([]);
      await expect(service.acceptInvite('missing', 'user-9')).rejects.toThrow(NotFoundException);
    });
  });
});
