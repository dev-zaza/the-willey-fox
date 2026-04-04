import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { authenticator } from '@otplib/preset-default';
import { AuthService } from './auth.service';
import { DRIZZLE } from '../../database/database.module';
import { NotificationsService } from '../notifications/notifications.service';

// ─── Drizzle mock ────────────────────────────────────────────────────────────
// Supports: select().from().where().limit(1) and insert().values().returning()
function makeDb(responses: unknown[][]) {
  let idx = 0;
  const next = () => { const r = responses[idx] ?? []; idx++; return r; };

  const terminalQuery = () => {
    const result = next();
    return {
      limit: jest.fn().mockResolvedValue(result),
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        void Promise.resolve(result).then(resolve, reject);
      },
    };
  };

  return {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockImplementation(() => terminalQuery()),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'new-user-1' }]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  };
}

// ─── Shared mocks ─────────────────────────────────────────────────────────────
const mockJwt = {
  sign: jest.fn().mockReturnValue('signed-token'),
  verify: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, def?: unknown) => {
    const vals: Record<string, unknown> = {
      PUBLIC_BASE_URL: 'http://localhost:3001',
      APP_NAME: 'TheWileyfox',
      ACCESS_TOKEN_EXPIRY_MINUTES: 10080,
      REFRESH_TOKEN_EXPIRY_DAYS: 30,
    };
    return vals[key] ?? def;
  }),
};

const mockNotifications = {
  sendAuthEmail: jest.fn().mockResolvedValue(undefined),
};

const baseUser = {
  id: 'user-1',
  email: 'john@test.com',
  firstName: 'John',
  lastName: 'Doe',
  passwordHash: '$2b$12$hashedpwd',
  isVerified: true,
  isBanned: false,
  subscriptionTier: 'free',
  isAdmin: false,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  oauthProvider: null,
  oauthProviderId: null,
  avatarUrl: null,
  phone: null,
  fcmToken: null,
  notificationPreferences: null,
  reputation: 0,
  language: 'en',
  verificationToken: null,
  verificationTokenExpiresAt: null,
  resetToken: null,
  resetTokenExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function buildService(db: ReturnType<typeof makeDb>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: DRIZZLE, useValue: db },
      { provide: JwtService, useValue: mockJwt },
      { provide: ConfigService, useValue: mockConfig },
      { provide: NotificationsService, useValue: mockNotifications },
    ],
  }).compile();
  return module.get<AuthService>(AuthService);
}

afterEach(() => jest.clearAllMocks());

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  // ── signup ──────────────────────────────────────────────────────────────────
  describe('signup', () => {
    it('creates a new user and queues verification email', async () => {
      // First query: email existence check → empty; insert.returning → new user
      const db = makeDb([[]]);
      db.returning.mockResolvedValue([{ id: 'new-user-1', email: 'new@test.com', firstName: 'New', lastName: 'User' }]);
      const service = await buildService(db);

      const result = await service.signup({
        email: 'new@test.com',
        password: 'Password1!',
        firstName: 'New',
        lastName: 'User',
      });

      expect(db.insert).toHaveBeenCalled();
      expect(mockNotifications.sendAuthEmail).toHaveBeenCalledWith(
        'new@test.com',
        'new-user-1',
        expect.any(String),
        expect.any(String),
      );
      expect(result.user.email).toBe('new@test.com');
      expect(result.message).toContain('verify');
    });

    it('throws ConflictException when email already exists', async () => {
      const db = makeDb([[{ id: 'existing-1' }]]);
      const service = await buildService(db);

      await expect(
        service.signup({ email: 'john@test.com', password: 'Password1!', firstName: 'A', lastName: 'B' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── login ───────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns accessToken and refreshToken for valid credentials', async () => {
      const hashed = await bcrypt.hash('correct-password', 1);
      const user = { ...baseUser, passwordHash: hashed, twoFactorEnabled: false };
      // login: user lookup; issueTokensForUser: insert refresh token
      const db = makeDb([[user]]);
      db.returning.mockResolvedValue([]); // refresh token insert
      const service = await buildService(db);

      const result = await service.login({ email: 'john@test.com', password: 'correct-password' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockJwt.sign).toHaveBeenCalled();
    });

    it('throws UnauthorizedException when user not found', async () => {
      const db = makeDb([[]]); // no user
      const service = await buildService(db);

      await expect(
        service.login({ email: 'nobody@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const hashed = await bcrypt.hash('real-password', 1);
      const user = { ...baseUser, passwordHash: hashed };
      const db = makeDb([[user]]);
      const service = await buildService(db);

      await expect(
        service.login({ email: 'john@test.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for OAuth-only account (no password)', async () => {
      const oauthUser = { ...baseUser, passwordHash: null };
      const db = makeDb([[oauthUser]]);
      const service = await buildService(db);

      await expect(
        service.login({ email: 'john@test.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns mfaRequired and mfaToken when 2FA is enabled', async () => {
      const hashed = await bcrypt.hash('correct-password', 1);
      const user = { ...baseUser, passwordHash: hashed, twoFactorEnabled: true };
      const db = makeDb([[user]]);
      const service = await buildService(db);

      const result = await service.login({ email: 'john@test.com', password: 'correct-password' });

      expect(result).toHaveProperty('mfaRequired', true);
      expect(result).toHaveProperty('mfaToken');
    });
  });

  // ── verifyEmail ─────────────────────────────────────────────────────────────
  describe('verifyEmail', () => {
    it('marks email as verified for a valid token', async () => {
      const db = makeDb([[{ id: 'user-1' }]]); // token lookup succeeds
      const service = await buildService(db);

      const result = await service.verifyEmail({ token: 'valid-token' });

      expect(db.update).toHaveBeenCalled();
      expect(result.message).toContain('verified');
    });

    it('throws BadRequestException on expired or invalid token', async () => {
      const db = makeDb([[]]); // no matching token
      const service = await buildService(db);

      await expect(service.verifyEmail({ token: 'bad-token' })).rejects.toThrow(BadRequestException);
    });
  });

  // ── forgotPassword ──────────────────────────────────────────────────────────
  describe('forgotPassword', () => {
    it('sends reset email when user exists', async () => {
      // forgotPassword: select user by email (limit), update reset token, select firstName (limit)
      // makeDb serves responses per terminalQuery (each where() call → next response)
      // update().set().where() also calls where() → must account for that slot
      // Sequence: [userIdResult], [updateSlot-ignored], [firstNameResult]
      const db = makeDb([[{ id: 'user-1' }], [], [{ firstName: 'John' }]]);
      const service = await buildService(db);

      const result = await service.forgotPassword({ email: 'john@test.com' });

      expect(db.update).toHaveBeenCalled();
      expect(mockNotifications.sendAuthEmail).toHaveBeenCalled();
      expect(result.message).toContain('reset link');
    });

    it('returns success silently when user not found (no enumeration)', async () => {
      const db = makeDb([[]]); // no user
      const service = await buildService(db);

      const result = await service.forgotPassword({ email: 'nobody@test.com' });

      expect(mockNotifications.sendAuthEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('reset link');
    });
  });

  // ── resetPassword ───────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    it('updates password hash on valid token', async () => {
      const db = makeDb([[{ id: 'user-1' }]]); // token lookup
      const service = await buildService(db);

      const result = await service.resetPassword({ token: 'valid-token', newPassword: 'NewPass1!' });

      expect(db.update).toHaveBeenCalled();
      expect(result.message).toContain('reset');
    });

    it('throws BadRequestException on invalid or expired token', async () => {
      const db = makeDb([[]]); // no user
      const service = await buildService(db);

      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'NewPass1!' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── refresh ─────────────────────────────────────────────────────────────────
  describe('refresh', () => {
    it('returns new tokens for valid refresh token', async () => {
      const stored = { id: 'rt-1', userId: 'user-1', tokenHash: 'hash', revokedAt: null, expiresAt: new Date(Date.now() + 9999999) };
      // refresh() flow:
      // 1. select refreshToken .where().limit() → [stored]
      // 2. update refreshToken .set().where() → slot consumed
      // 3. select user .where().limit() → [baseUser]
      const db = makeDb([[stored], [], [baseUser]]);
      db.returning.mockResolvedValue([]); // issueTokensForUser: insert refresh token
      const service = await buildService(db);

      const result = await service.refresh({ refreshToken: 'raw-refresh-token' });

      expect(result).toHaveProperty('accessToken');
      expect(db.update).toHaveBeenCalled(); // old token revoked
    });

    it('throws UnauthorizedException for expired or revoked refresh token', async () => {
      const db = makeDb([[]]); // no stored token
      const service = await buildService(db);

      await expect(service.refresh({ refreshToken: 'bad-token' })).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── logout ──────────────────────────────────────────────────────────────────
  describe('logout', () => {
    it('revokes the refresh token from DB', async () => {
      const db = makeDb([]);
      const service = await buildService(db);

      const result = await service.logout({ refreshToken: 'raw-token' });

      expect(db.update).toHaveBeenCalled();
      expect(result.message).toContain('Logged out');
    });
  });

  // ── findOrCreateOAuthUser ───────────────────────────────────────────────────
  describe('findOrCreateOAuthUser', () => {
    const googleProfile = {
      id: 'google-123',
      email: 'google@test.com',
      firstName: 'Google',
      lastName: 'User',
      avatarUrl: 'https://example.com/avatar.jpg',
    };

    it('returns tokens when OAuth user already exists (by provider ID)', async () => {
      const db = makeDb([[baseUser]]); // found by provider
      db.returning.mockResolvedValue([]); // refresh token insert
      const service = await buildService(db);

      const result = await service.findOrCreateOAuthUser(googleProfile);

      expect(result).toHaveProperty('accessToken');
      expect(db.insert).toHaveBeenCalled(); // refresh token stored
    });

    it('links OAuth to existing email account when provider lookup misses', async () => {
      // provider lookup → empty, email lookup → existing user
      const db = makeDb([[], [baseUser]]);
      db.returning.mockResolvedValue([]);
      const service = await buildService(db);

      const result = await service.findOrCreateOAuthUser(googleProfile);

      expect(db.update).toHaveBeenCalled(); // links oauthProvider fields
      expect(result).toHaveProperty('accessToken');
    });

    it('creates a new user when no existing account found', async () => {
      // provider lookup → empty, email lookup → empty, insert → new user
      const db = makeDb([[], []]);
      db.returning.mockResolvedValue([{ ...baseUser, id: 'new-oauth-user' }]);
      const service = await buildService(db);

      const result = await service.findOrCreateOAuthUser(googleProfile);

      expect(db.insert).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken');
    });

    it('stores oauthProvider=google and passwordHash=null for new OAuth user', async () => {
      const db = makeDb([[], []]);
      db.returning.mockResolvedValue([{ ...baseUser, id: 'oauth-new' }]);
      const service = await buildService(db);

      await service.findOrCreateOAuthUser(googleProfile);

      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({ oauthProvider: 'google', passwordHash: null }),
      );
    });
  });

  // ── 2FA ─────────────────────────────────────────────────────────────────────
  describe('generate2faSecret', () => {
    it('returns a QR code data URL and secret', async () => {
      const user = { email: 'john@test.com', twoFactorEnabled: false };
      const db = makeDb([[user]]);
      const service = await buildService(db);

      const result = await service.generate2faSecret('user-1');

      expect(result).toHaveProperty('qrCode');
      expect(result).toHaveProperty('secret');
      expect(result.qrCode).toMatch(/^data:image\/png/);
      expect(db.update).toHaveBeenCalled(); // stores pending secret
    });

    it('throws BadRequestException if 2FA already enabled', async () => {
      const user = { email: 'john@test.com', twoFactorEnabled: true };
      const db = makeDb([[user]]);
      const service = await buildService(db);

      await expect(service.generate2faSecret('user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('enable2fa', () => {
    it('enables 2FA when TOTP code is valid', async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      const user = { twoFactorSecret: secret, twoFactorEnabled: false };
      const db = makeDb([[user]]);
      const service = await buildService(db);

      const result = await service.enable2fa('user-1', validCode);

      expect(db.update).toHaveBeenCalled();
      expect(result.message).toContain('enabled');
    });

    it('throws BadRequestException on invalid TOTP code', async () => {
      const secret = authenticator.generateSecret();
      const user = { twoFactorSecret: secret, twoFactorEnabled: false };
      const db = makeDb([[user]]);
      const service = await buildService(db);

      await expect(service.enable2fa('user-1', '000000')).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirm2faLogin', () => {
    it('returns full tokens when mfaToken and TOTP are valid', async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      mockJwt.verify.mockReturnValue({ sub: 'user-1', scope: 'mfa' });

      const user = { ...baseUser, twoFactorSecret: secret };
      const db = makeDb([[user]]);
      db.returning.mockResolvedValue([]);
      const service = await buildService(db);

      const result = await service.confirm2faLogin('mfa-jwt', validCode);

      expect(result).toHaveProperty('accessToken');
    });

    it('throws UnauthorizedException on invalid mfaToken', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      const db = makeDb([]);
      const service = await buildService(db);

      await expect(service.confirm2faLogin('bad-mfa', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when mfaToken scope is not mfa', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', scope: 'access' });
      const db = makeDb([]);
      const service = await buildService(db);

      await expect(service.confirm2faLogin('wrong-scope', '123456')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('disable2fa', () => {
    it('disables 2FA when TOTP code is valid', async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      const user = { twoFactorSecret: secret, twoFactorEnabled: true };
      const db = makeDb([[user]]);
      const service = await buildService(db);

      const result = await service.disable2fa('user-1', validCode);

      expect(db.update).toHaveBeenCalled();
      expect(result.message).toContain('disabled');
    });

    it('throws BadRequestException when 2FA is not enabled', async () => {
      const user = { twoFactorSecret: null, twoFactorEnabled: false };
      const db = makeDb([[user]]);
      const service = await buildService(db);

      await expect(service.disable2fa('user-1', '000000')).rejects.toThrow(BadRequestException);
    });
  });

  // ── security checks ──────────────────────────────────────────────────────────
  describe('security', () => {
    it('does not expose passwordHash in signup response', async () => {
      const db = makeDb([[]]);
      db.returning.mockResolvedValue([{ id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B' }]);
      const service = await buildService(db);

      const result = await service.signup({ email: 'a@b.com', password: 'P@ssword1', firstName: 'A', lastName: 'B' });

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('does not expose passwordHash in login response', async () => {
      const hashed = await bcrypt.hash('pass', 1);
      const db = makeDb([[{ ...baseUser, passwordHash: hashed }]]);
      db.returning.mockResolvedValue([]);
      const service = await buildService(db);

      const result = await service.login({ email: 'john@test.com', password: 'pass' }) as any;

      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });
});
