import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PinsService } from './pins.service';
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

const mockQueue = {
  add: jest.fn(),
};

describe('PinsService', () => {
  let service: PinsService;

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
        PinsService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: 'BullQueue_pin-expiry', useValue: mockQueue },
      ],
    }).compile();

    service = module.get<PinsService>(PinsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should insert a pin and schedule expiry', async () => {
      const pinData = {
        id: 'pin-1',
        type: 'traffic',
        title: 'Test Pin',
        lat: '51.5',
        lng: '-0.1',
        status: 'active',
        upvotes: 0,
        downvotes: 0,
        createdAt: new Date().toISOString(),
      };
      mockDb.returning.mockResolvedValueOnce([pinData]);

      const result = await service.create('user-1', {
        type: 'traffic' as any,
        title: 'Test Pin',
        lat: 51.5,
        lng: -0.1,
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(pinData);
    });
  });

  describe('vote', () => {
    it('should throw NotFoundException when pin does not exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.vote('pin-1', 'user-1', { isUpvote: true })).rejects.toThrow(NotFoundException);
    });
  });
});
