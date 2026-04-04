import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { MessagesService } from './messages.service';
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
  execute: jest.fn(),
};

describe('MessagesService', () => {
  let service: MessagesService;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should throw ForbiddenException when user is not a participant', async () => {
      // assertParticipant returns empty
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.sendMessage('user-1', 'convo-1', 'Hello')).rejects.toThrow(ForbiddenException);
    });

    it('should insert message and return it', async () => {
      const participant = { id: 'part-1', conversationId: 'convo-1', userId: 'user-1' };
      const message = {
        id: 'msg-1',
        conversationId: 'convo-1',
        senderId: 'user-1',
        body: 'Hello',
        isRead: false,
        createdAt: new Date(),
      };
      mockDb.limit.mockResolvedValueOnce([participant]); // assertParticipant
      mockDb.returning.mockResolvedValueOnce([message]); // insert returning

      const result = await service.sendMessage('user-1', 'convo-1', 'Hello');
      expect(result).toEqual(message);
    });
  });
});
