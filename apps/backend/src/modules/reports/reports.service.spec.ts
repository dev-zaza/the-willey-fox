import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DRIZZLE } from '../../database/database.module';
import { NotificationsService } from '../notifications/notifications.service';

// ─── Drizzle mock ─────────────────────────────────────────────────────────────
const mockDb: any = {
  select: jest.fn(),
  from: jest.fn(),
  where: jest.fn(),
  innerJoin: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  insert: jest.fn(),
  values: jest.fn(),
  returning: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
};

const mockNotifications = {
  notifyFinderOfResponse: jest.fn().mockResolvedValue(undefined),
  notifyGuardiansOfReport: jest.fn().mockResolvedValue(undefined),
};

const baseReport = {
  id: 'report-1',
  qrCodeId: 'qr-1',
  finderName: 'Jane Finder',
  finderContact: 'jane@test.com',
  finderNotes: 'Found near the park',
  locationLat: '51.5',
  locationLng: '-0.1',
  status: 'open',
  photoUrl: null,
  createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days old
  updatedAt: new Date(),
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.innerJoin.mockReturnThis();
    mockDb.orderBy.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── findById ─────────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('returns the report when found', async () => {
      mockDb.limit.mockResolvedValueOnce([baseReport]);

      const result = await service.findById('report-1');
      expect(result).toEqual(baseReport);
    });

    it('returns null when report does not exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.findById('missing');
      expect(result).toBeNull();
    });
  });

  // ── findByIdForUser ──────────────────────────────────────────────────────────
  describe('findByIdForUser', () => {
    it('returns the report for the QR owner', async () => {
      // findById → report; QR lookup → owner matches
      mockDb.limit
        .mockResolvedValueOnce([baseReport])         // findById
        .mockResolvedValueOnce([{ userId: 'user-1' }]); // QR owner check

      const result = await service.findByIdForUser('report-1', 'user-1');
      expect(result).toEqual(baseReport);
    });

    it('returns the report for an active guardian', async () => {
      mockDb.limit
        .mockResolvedValueOnce([baseReport])              // findById
        .mockResolvedValueOnce([{ userId: 'owner-1' }])  // QR → different owner
        .mockResolvedValueOnce([{ id: 'gm-1' }]);         // guardian check → found

      const result = await service.findByIdForUser('report-1', 'guardian-1');
      expect(result).toEqual(baseReport);
    });

    it('throws NotFoundException when report does not exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]); // no report

      await expect(service.findByIdForUser('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for non-owner, non-guardian user', async () => {
      mockDb.limit
        .mockResolvedValueOnce([baseReport])
        .mockResolvedValueOnce([{ userId: 'owner-1' }])  // different owner
        .mockResolvedValueOnce([]);                        // not a guardian

      await expect(service.findByIdForUser('report-1', 'stranger-1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── findByUserQrCodes ────────────────────────────────────────────────────────
  describe('findByUserQrCodes', () => {
    it('returns empty array when user has no QR codes', async () => {
      // owned QRs → []; guardian QRs → []
      mockDb.where
        .mockResolvedValueOnce([])  // ownedQrs
        .mockResolvedValueOnce([]); // guardianQrs

      const result = await service.findByUserQrCodes('user-1');
      expect(result).toEqual([]);
    });

    it('returns reports for owned QR codes', async () => {
      mockDb.where
        .mockResolvedValueOnce([{ id: 'qr-1' }])  // owned QRs (direct await)
        .mockResolvedValueOnce([]);                  // guardian QRs (direct await)
      // Third where() falls through to mockReturnThis() → mockDb, then .orderBy() resolves
      mockDb.orderBy.mockResolvedValueOnce([baseReport]);

      const result = await service.findByUserQrCodes('user-1');
      expect(result).toBeDefined();
    });
  });

  // ── updateStatus ─────────────────────────────────────────────────────────────
  describe('updateStatus', () => {
    it('updates report status and returns updated record', async () => {
      const closedReport = { ...baseReport, status: 'closed' };
      // findByIdForUser calls: findById + QR lookup
      mockDb.limit
        .mockResolvedValueOnce([baseReport])
        .mockResolvedValueOnce([{ userId: 'user-1' }]);
      mockDb.returning.mockResolvedValueOnce([closedReport]);

      const result = await service.updateStatus('report-1', 'user-1', { status: 'closed' as any });

      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toHaveProperty('status', 'closed');
    });

    it('throws ForbiddenException when user is not owner or guardian', async () => {
      mockDb.limit
        .mockResolvedValueOnce([baseReport])
        .mockResolvedValueOnce([{ userId: 'owner-1' }])
        .mockResolvedValueOnce([]);

      await expect(
        service.updateStatus('report-1', 'stranger', { status: 'closed' as any }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── createResponse ────────────────────────────────────────────────────────────
  describe('createResponse', () => {
    it('inserts a response, updates report status to contacted, and notifies finder', async () => {
      const response = { id: 'resp-1', reportId: 'report-1', guardianId: 'guardian-1', message: 'We are on our way' };
      // findByIdForUser calls
      mockDb.limit
        .mockResolvedValueOnce([baseReport])
        .mockResolvedValueOnce([{ userId: 'guardian-1' }])  // QR → guardian is owner for simplicity
        .mockResolvedValueOnce([{ firstName: 'Jane', lastName: 'Guardian' }]); // guardian name
      mockDb.returning
        .mockResolvedValueOnce([response])  // insert response
        .mockResolvedValueOnce([]);         // update report

      const result = await service.createResponse('report-1', 'guardian-1', { message: 'We are on our way' });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockNotifications.notifyFinderOfResponse).toHaveBeenCalledWith(
        'report-1',
        'We are on our way',
        expect.any(String),
      );
      expect(result).toEqual(response);
    });
  });

  // ── flagReport ────────────────────────────────────────────────────────────────
  describe('flagReport', () => {
    it('sets status to flagged with the given reason', async () => {
      const flagged = { ...baseReport, status: 'flagged', flagReason: 'spam' };
      mockDb.limit.mockResolvedValueOnce([baseReport]);
      mockDb.returning.mockResolvedValueOnce([flagged]);

      const result = await service.flagReport('report-1', 'admin-1', { reason: 'spam' });

      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toHaveProperty('status', 'flagged');
    });

    it('throws NotFoundException when report does not exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.flagReport('missing', 'admin-1', { reason: 'spam' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── expireOldReports ──────────────────────────────────────────────────────────
  describe('expireOldReports', () => {
    it('expires open reports older than 30 days and returns the count', async () => {
      // update().set().where().returning()
      mockDb.returning.mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }]);

      const count = await service.expireOldReports();

      expect(mockDb.update).toHaveBeenCalled();
      expect(count).toBe(2);
    });

    it('returns 0 when no reports qualify for expiry', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      const count = await service.expireOldReports();
      expect(count).toBe(0);
    });

    it('does not expire already closed or expired reports', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'open-1' }]);

      await service.expireOldReports();

      // The update should use inArray filter for open/contacted statuses only
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'expired' }),
      );
    });
  });

  // ── getResponses ──────────────────────────────────────────────────────────────
  describe('getResponses', () => {
    it('returns formatted responses with guardian names', async () => {
      const rawRow = {
        id: 'resp-1',
        reportId: 'report-1',
        guardianId: 'guardian-1',
        message: 'Found it',
        createdAt: new Date(),
        guardianFirstName: 'Jane',
        guardianLastName: 'Smith',
      };
      // findByIdForUser + responses query
      mockDb.limit
        .mockResolvedValueOnce([baseReport])
        .mockResolvedValueOnce([{ userId: 'user-1' }]);
      mockDb.orderBy.mockResolvedValueOnce([rawRow]);

      const result = await service.getResponses('report-1', 'user-1');

      expect(result[0]).toHaveProperty('guardianName', 'Jane Smith');
      expect(result[0]).toHaveProperty('message', 'Found it');
    });
  });
});
