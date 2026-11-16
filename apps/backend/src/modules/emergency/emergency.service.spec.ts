import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { DRIZZLE } from '../../database/database.module';

function buildMockDb() {
  const queue: Array<{ type: 'limit' | 'direct'; value: unknown }> = [];
  const db: any = {
    _inUpdate: false,
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockImplementation(() => {
      // update().set().where().returning() must not consume select queue entries
      if (db._inUpdate) {
        db._inUpdate = false;
        return db;
      }
      const entry = queue.shift();
      if (!entry) return db;
      if (entry.type === 'direct') {
        return {
          limit: jest.fn().mockResolvedValue(entry.value),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            void Promise.resolve(entry.value).then(resolve, reject),
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
    update: jest.fn().mockImplementation(() => {
      db._inUpdate = true;
      return db;
    }),
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
  sendPush: jest.fn().mockResolvedValue(undefined),
  notifyEmergencyContactRequest: jest.fn().mockResolvedValue(undefined),
  notifyEmergencyContactAccepted: jest.fn().mockResolvedValue(undefined),
};

const mockSettings = {
  getPricingConfig: jest.fn().mockResolvedValue({
    tierLimits: { free: { maxEmergencyContacts: 3 } },
  }),
};

describe('EmergencyService', () => {
  let service: EmergencyService;
  let enqueueLimit: (v: unknown) => void;
  let enqueueDirect: (v: unknown) => void;
  let db: any;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockNotifications.notifyEmergencyContactRequest.mockResolvedValue(undefined);
    mockNotifications.notifyEmergencyContactAccepted.mockResolvedValue(undefined);
    mockSettings.getPricingConfig.mockResolvedValue({
      tierLimits: { free: { maxEmergencyContacts: 3 } },
    });
    const built = buildMockDb();
    db = built.db;
    enqueueLimit = built.enqueueLimit;
    enqueueDirect = built.enqueueDirect;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: DRIZZLE, useValue: db },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get<EmergencyService>(EmergencyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addContact', () => {
    it('should throw NotFoundException when target user does not exist', async () => {
      enqueueLimit([{ subscriptionTier: 'free' }]); // requester
      enqueueDirect([{ cnt: 0 }]); // accepted count
      enqueueLimit([]); // contact user missing

      await expect(service.addContact('user-1', { contactUserId: 'user-2' })).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when relationship already exists', async () => {
      enqueueLimit([{ subscriptionTier: 'free' }]);
      enqueueDirect([{ cnt: 0 }]);
      enqueueLimit([{ id: 'user-2', firstName: 'Jane', lastName: 'Doe' }]);
      enqueueLimit([{ id: 'existing-contact', status: 'pending' }]);

      await expect(service.addContact('user-1', { contactUserId: 'user-2' })).rejects.toThrow(ConflictException);
    });
  });

  describe('acceptContact', () => {
    it('throws when pending invite is not found for this user', async () => {
      enqueueLimit([]);
      await expect(service.acceptContact('missing', 'user-2')).rejects.toThrow(NotFoundException);
    });

    it('accepts and returns enriched contact with requester name', async () => {
      const pending = {
        id: 'ec-1',
        userId: 'user-1',
        contactUserId: 'user-2',
        status: 'pending',
        isPrimarySos: false,
        acceptedAt: null,
        createdAt: new Date(),
      };
      const accepted = { ...pending, status: 'accepted', acceptedAt: new Date() };
      enqueueLimit([pending]);
      db.returning.mockResolvedValueOnce([accepted]);
      enqueueLimit([{ firstName: 'Ada', lastName: 'Lovelace' }]); // acceptor profile
      enqueueLimit([
        { id: 'user-1', firstName: 'Barry', lastName: 'Wilson', email: 'b@x.com', avatarUrl: null },
      ]); // enrich other user

      const result = await service.acceptContact('ec-1', 'user-2');
      expect(mockNotifications.notifyEmergencyContactAccepted).toHaveBeenCalled();
      expect(result.contact?.firstName).toBe('Barry');
      expect(result.status).toBe('accepted');
    });
  });

  describe('listContacts', () => {
    it('should return empty array when user has no contacts', async () => {
      enqueueDirect([]);
      const result = await service.listContacts('user-1');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });
});
