import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DRIZZLE } from '../../database/database.module';

const mockDb: any = {
  select: jest.fn(),
  from: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  offset: jest.fn(),
  orderBy: jest.fn(),
  insert: jest.fn(),
  values: jest.fn(),
  returning: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const mockNotifications = {
  sendPush: jest.fn().mockResolvedValue(undefined),
  sendEmail: jest.fn().mockResolvedValue(undefined),
};

describe('EmergencyService', () => {
  let service: EmergencyService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);
    mockDb.offset.mockReturnThis();
    mockDb.orderBy.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<EmergencyService>(EmergencyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addContact', () => {
    it('should throw NotFoundException when target user does not exist', async () => {
      // contactUser query: select().from().where().limit() → []
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.addContact('user-1', { contactUserId: 'user-2' })).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when relationship already exists', async () => {
      // contactUser found
      mockDb.limit
        .mockResolvedValueOnce([{ id: 'user-2', firstName: 'Jane', lastName: 'Doe' }]) // contactUser
        .mockResolvedValueOnce([{ id: 'existing-contact', status: 'pending' }]); // existing relationship

      await expect(service.addContact('user-1', { contactUserId: 'user-2' })).rejects.toThrow(ConflictException);
    });
  });

  describe('listContacts', () => {
    it('should return empty array when user has no contacts', async () => {
      // listContacts uses select().from().where() — no limit, so where() is terminal
      mockDb.where.mockResolvedValueOnce([]);

      const result = await service.listContacts('user-1');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
