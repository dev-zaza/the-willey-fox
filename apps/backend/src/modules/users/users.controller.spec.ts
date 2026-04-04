import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// ─── UsersService mock ────────────────────────────────────────────────────────
const mockUsersService = {
  getProfile: jest.fn(),
  getPublicProfile: jest.fn(),
  updateProfile: jest.fn(),
  uploadAvatar: jest.fn(),
  updateLocation: jest.fn(),
  search: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  listBlocked: jest.fn(),
  reportUser: jest.fn(),
  sendPhoneOtp: jest.fn(),
  verifyPhoneOtp: jest.fn(),
};

const authedUser = { id: 'user-1', email: 'u@test.com', tier: 'free', isAdmin: false };

async function buildController() {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [UsersController],
    providers: [{ provide: UsersService, useValue: mockUsersService }],
  }).compile();

  return module.get<UsersController>(UsersController);
}

afterEach(() => jest.resetAllMocks());

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UsersController', () => {
  // ── TC-01-056: GET /users/me — protected ──────────────────────────────────
  describe('getMyProfile', () => {
    it('TC-01-056 — returns profile for authenticated user', async () => {
      const controller = await buildController();
      const profile = { id: 'user-1', email: 'u@test.com', firstName: 'U', lastName: 'T' };
      mockUsersService.getProfile.mockResolvedValue(profile);

      const result = await controller.getMyProfile(authedUser as any);

      expect(mockUsersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(profile);
    });

    it('propagates NotFoundException when user is not found', async () => {
      const controller = await buildController();
      mockUsersService.getProfile.mockRejectedValue(new NotFoundException());

      await expect(controller.getMyProfile(authedUser as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ── TC-01-057: PATCH /users/me — 200 on valid profile update ─────────────
  describe('updateMyProfile', () => {
    it('TC-01-057 — delegates to usersService.updateProfile and returns result', async () => {
      const controller = await buildController();
      const updated = { id: 'user-1', firstName: 'NewName' };
      mockUsersService.updateProfile.mockResolvedValue(updated);

      const result = await controller.updateMyProfile(authedUser as any, { firstName: 'NewName' } as any);

      expect(mockUsersService.updateProfile).toHaveBeenCalledWith('user-1', { firstName: 'NewName' });
      expect(result).toEqual(updated);
    });
  });

  // ── TC-01-055: POST /users/me/avatar — multipart upload ──────────────────
  describe('uploadAvatar', () => {
    it('TC-01-055 — accepts valid image file and returns avatarUrl', async () => {
      const controller = await buildController();
      mockUsersService.uploadAvatar.mockResolvedValue({ avatarUrl: 'https://cdn.example.com/avatar.jpg' });
      const file = { mimetype: 'image/jpeg', buffer: Buffer.from('fake-image'), originalname: 'avatar.jpg' };

      const result = await controller.uploadAvatar(authedUser as any, file as any);

      expect(mockUsersService.uploadAvatar).toHaveBeenCalledWith('user-1', file.buffer);
      expect(result).toHaveProperty('avatarUrl');
    });

    it('TC-01-037 — throws BadRequestException for non-image MIME type', async () => {
      const controller = await buildController();
      const file = { mimetype: 'application/pdf', buffer: Buffer.from('pdf'), originalname: 'doc.pdf' };

      await expect(controller.uploadAvatar(authedUser as any, file as any)).rejects.toThrow(BadRequestException);
      expect(mockUsersService.uploadAvatar).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when no file provided', async () => {
      const controller = await buildController();

      await expect(controller.uploadAvatar(authedUser as any, undefined as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ── GET /users/search — public ────────────────────────────────────────────
  describe('searchUsers', () => {
    it('delegates query to usersService.search', async () => {
      const controller = await buildController();
      const hits = [{ id: 'u2', firstName: 'Jane', lastName: 'Doe' }];
      mockUsersService.search.mockResolvedValue(hits);

      const result = await controller.searchUsers('Jane');

      expect(mockUsersService.search).toHaveBeenCalledWith('Jane');
      expect(result).toEqual(hits);
    });

    it('passes empty string when no query provided', async () => {
      const controller = await buildController();
      mockUsersService.search.mockResolvedValue([]);

      await controller.searchUsers(undefined as any);

      expect(mockUsersService.search).toHaveBeenCalledWith('');
    });
  });

  // ── GET /users/:id — public profile ──────────────────────────────────────
  describe('getPublicProfile', () => {
    it('returns public user profile', async () => {
      const controller = await buildController();
      const pub = { id: 'user-2', firstName: 'Jane', lastName: 'Doe', reputation: 5 };
      mockUsersService.getPublicProfile.mockResolvedValue(pub);

      const result = await controller.getPublicProfile('user-2');

      expect(mockUsersService.getPublicProfile).toHaveBeenCalledWith('user-2');
      expect(result).toEqual(pub);
    });

    it('propagates NotFoundException for unknown user', async () => {
      const controller = await buildController();
      mockUsersService.getPublicProfile.mockRejectedValue(new NotFoundException());

      await expect(controller.getPublicProfile('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── POST /users/me/location ────────────────────────────────────────────────
  describe('updateLocation', () => {
    it('delegates to usersService.updateLocation', async () => {
      const controller = await buildController();
      mockUsersService.updateLocation.mockResolvedValue(undefined);

      await controller.updateLocation(authedUser as any, { lat: 51.5, lng: -0.1 } as any);

      expect(mockUsersService.updateLocation).toHaveBeenCalledWith('user-1', { lat: 51.5, lng: -0.1 });
    });
  });

  // ── Block / Unblock / List ─────────────────────────────────────────────────
  describe('blockUser', () => {
    it('delegates to usersService.blockUser', async () => {
      const controller = await buildController();
      mockUsersService.blockUser.mockResolvedValue({ message: 'User blocked.' });

      const result = await controller.blockUser(authedUser as any, 'user-2');

      expect(mockUsersService.blockUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toHaveProperty('message');
    });

    it('propagates ForbiddenException when blocking yourself', async () => {
      const controller = await buildController();
      mockUsersService.blockUser.mockRejectedValue(new ForbiddenException('Cannot block yourself'));

      await expect(controller.blockUser(authedUser as any, 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('propagates ConflictException when already blocked', async () => {
      const controller = await buildController();
      mockUsersService.blockUser.mockRejectedValue(new ConflictException('USER_ALREADY_BLOCKED'));

      await expect(controller.blockUser(authedUser as any, 'user-2')).rejects.toThrow(ConflictException);
    });
  });

  describe('unblockUser', () => {
    it('delegates to usersService.unblockUser', async () => {
      const controller = await buildController();
      mockUsersService.unblockUser.mockResolvedValue({ message: 'User unblocked.' });

      const result = await controller.unblockUser(authedUser as any, 'user-2');

      expect(mockUsersService.unblockUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toHaveProperty('message');
    });
  });

  describe('listBlocked', () => {
    it('returns list of blocked users', async () => {
      const controller = await buildController();
      const blocked = [{ id: 'b1', blockedId: 'user-2' }];
      mockUsersService.listBlocked.mockResolvedValue(blocked);

      const result = await controller.listBlocked(authedUser as any);

      expect(mockUsersService.listBlocked).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(blocked);
    });
  });

  // ── POST /users/:id/report ──────────────────────────────────────────────────
  describe('reportUser', () => {
    it('delegates to usersService.reportUser', async () => {
      const controller = await buildController();
      const report = { id: 'r1', reporterId: 'user-1', reportedId: 'user-2' };
      mockUsersService.reportUser.mockResolvedValue(report);

      const result = await controller.reportUser(authedUser as any, 'user-2', { reason: 'spam' } as any);

      expect(mockUsersService.reportUser).toHaveBeenCalledWith('user-1', 'user-2', { reason: 'spam' });
      expect(result).toEqual(report);
    });
  });

  // ── Phone OTP ──────────────────────────────────────────────────────────────
  describe('sendPhoneOtp', () => {
    it('TC-01-042 — delegates to usersService.sendPhoneOtp', async () => {
      const controller = await buildController();
      mockUsersService.sendPhoneOtp.mockResolvedValue({ message: 'OTP sent.' });

      const result = await controller.sendPhoneOtp(authedUser as any);

      expect(mockUsersService.sendPhoneOtp).toHaveBeenCalledWith('user-1');
      expect(result).toHaveProperty('message');
    });
  });

  describe('verifyPhoneOtp', () => {
    it('TC-01-043 — delegates to usersService.verifyPhoneOtp with code', async () => {
      const controller = await buildController();
      mockUsersService.verifyPhoneOtp.mockResolvedValue({ message: 'Phone number verified.' });

      const result = await controller.verifyPhoneOtp(authedUser as any, { code: '654321' } as any);

      expect(mockUsersService.verifyPhoneOtp).toHaveBeenCalledWith('user-1', { code: '654321' });
      expect(result).toHaveProperty('message');
    });

    it('TC-01-044 — propagates BadRequestException on wrong/expired OTP', async () => {
      const controller = await buildController();
      mockUsersService.verifyPhoneOtp.mockRejectedValue(new BadRequestException('INVALID_OTP'));

      await expect(
        controller.verifyPhoneOtp(authedUser as any, { code: 'bad' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
