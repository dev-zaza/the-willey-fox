import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// ─── AuthService mock ─────────────────────────────────────────────────────────
const mockAuthService = {
  signup: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  findOrCreateOAuthUser: jest.fn(),
  issueOAuthRedirectCode: jest.fn(),
  consumeOAuthRedirectCode: jest.fn(),
  generate2faSecret: jest.fn(),
  enable2fa: jest.fn(),
  disable2fa: jest.fn(),
  confirm2faLogin: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('http://localhost:3001'),
};

async function buildController() {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: mockAuthService },
      { provide: ConfigService, useValue: mockConfigService },
    ],
  }).compile();

  return module.get<AuthController>(AuthController);
}

afterEach(() => jest.resetAllMocks());

describe('AuthController', () => {
  // ── TC-01-045: POST /auth/signup → 201 on valid payload ────────────────────
  describe('signup', () => {
    it('TC-01-045 — returns result from authService.signup for valid payload', async () => {
      const controller = await buildController();
      const dto = { email: 'new@test.com', password: 'Password1!', firstName: 'New', lastName: 'User' };
      const expected = { user: { id: 'u1', email: dto.email }, message: 'Please verify your email.' };
      mockAuthService.signup.mockResolvedValue(expected);

      const result = await controller.signup(dto as any);

      expect(mockAuthService.signup).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });

    it('TC-01-046 — propagates ConflictException (409) on duplicate email', async () => {
      const controller = await buildController();
      mockAuthService.signup.mockRejectedValue(new ConflictException('EMAIL_TAKEN'));

      await expect(controller.signup({ email: 'dup@test.com' } as any)).rejects.toThrow(ConflictException);
    });

    it('TC-01-047 — propagates BadRequestException (400) on invalid DTO', async () => {
      const controller = await buildController();
      mockAuthService.signup.mockRejectedValue(new BadRequestException('Invalid DTO'));

      await expect(controller.signup({} as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ── TC-01-048 / TC-01-049: POST /auth/login ────────────────────────────────
  describe('login', () => {
    it('TC-01-048 — returns tokens for valid credentials', async () => {
      const controller = await buildController();
      const tokens = { accessToken: 'at', refreshToken: 'rt' };
      mockAuthService.login.mockResolvedValue(tokens);

      const result = await controller.login({ email: 'user@test.com', password: 'P@ss1' } as any);

      expect(result).toEqual(tokens);
    });

    it('TC-01-049 — propagates UnauthorizedException (401) on wrong password', async () => {
      const controller = await buildController();
      mockAuthService.login.mockRejectedValue(new UnauthorizedException());

      await expect(controller.login({ email: 'u@t.com', password: 'wrong' } as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('TC-01-012 — propagates UnauthorizedException if email not verified', async () => {
      const controller = await buildController();
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('EMAIL_NOT_VERIFIED'));

      await expect(controller.login({ email: 'u@t.com', password: 'P@ss1' } as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('TC-01-013 — propagates UnauthorizedException if user is banned', async () => {
      const controller = await buildController();
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('USER_BANNED'));

      await expect(controller.login({ email: 'banned@t.com', password: 'P@ss1' } as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('TC-01-014 — returns mfaRequired + mfaToken when 2FA enabled', async () => {
      const controller = await buildController();
      mockAuthService.login.mockResolvedValue({ mfaRequired: true, mfaToken: 'mfa-jwt' });

      const result = await controller.login({ email: 'u@t.com', password: 'P@ss1' } as any) as any;

      expect(result).toHaveProperty('mfaRequired', true);
      expect(result).toHaveProperty('mfaToken');
    });
  });

  // ── TC-01-050: POST /auth/refresh → 200 with new accessToken ───────────────
  describe('refresh', () => {
    it('TC-01-050 — returns new accessToken for valid refresh token', async () => {
      const controller = await buildController();
      mockAuthService.refresh.mockResolvedValue({ accessToken: 'new-at', refreshToken: 'new-rt' });

      const result = await controller.refresh({ refreshToken: 'valid-rt' } as any);

      expect(result).toHaveProperty('accessToken');
      expect(mockAuthService.refresh).toHaveBeenCalledWith({ refreshToken: 'valid-rt' });
    });

    it('TC-01-016 — propagates UnauthorizedException for expired/revoked refresh token', async () => {
      const controller = await buildController();
      mockAuthService.refresh.mockRejectedValue(new UnauthorizedException());

      await expect(controller.refresh({ refreshToken: 'expired' } as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── TC-01-051: POST /auth/logout → 204 ────────────────────────────────────
  describe('logout', () => {
    it('TC-01-051 — delegates to authService.logout and returns result', async () => {
      const controller = await buildController();
      mockAuthService.logout.mockResolvedValue({ message: 'Logged out.' });

      const result = await controller.logout({ refreshToken: 'rt' } as any);

      expect(mockAuthService.logout).toHaveBeenCalledWith({ refreshToken: 'rt' });
      expect(result).toHaveProperty('message');
    });
  });

  // ── TC-01-017: verifyEmail ────────────────────────────────────────────────
  describe('verifyEmail', () => {
    it('TC-01-006 — delegates to authService.verifyEmail for valid token', async () => {
      const controller = await buildController();
      mockAuthService.verifyEmail.mockResolvedValue({ message: 'Email verified.' });

      const result = await controller.verifyEmail({ token: 'valid-token' } as any);

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith({ token: 'valid-token' });
      expect(result).toHaveProperty('message');
    });

    it('TC-01-007 — propagates BadRequestException on expired/invalid token', async () => {
      const controller = await buildController();
      mockAuthService.verifyEmail.mockRejectedValue(new BadRequestException('TOKEN_INVALID'));

      await expect(controller.verifyEmail({ token: 'bad' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ── TC-01-008/009: resendVerification ────────────────────────────────────
  describe('resendVerification', () => {
    it('TC-01-008 — sends new verification email for unverified user', async () => {
      const controller = await buildController();
      mockAuthService.resendVerification.mockResolvedValue({ message: 'Verification email sent.' });

      const result = await controller.resendVerification({ email: 'u@t.com' } as any);

      expect(mockAuthService.resendVerification).toHaveBeenCalled();
      expect(result).toHaveProperty('message');
    });

    it('TC-01-009 — propagates BadRequestException if already verified', async () => {
      const controller = await buildController();
      mockAuthService.resendVerification.mockRejectedValue(new BadRequestException('ALREADY_VERIFIED'));

      await expect(controller.resendVerification({ email: 'u@t.com' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ── Password reset ────────────────────────────────────────────────────────
  describe('forgotPassword', () => {
    it('TC-01-018 — delegates to authService.forgotPassword', async () => {
      const controller = await buildController();
      mockAuthService.forgotPassword.mockResolvedValue({ message: 'reset link sent' });

      const result = await controller.forgotPassword({ email: 'u@t.com' } as any);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith({ email: 'u@t.com' });
      expect(result).toHaveProperty('message');
    });
  });

  describe('resetPassword', () => {
    it('TC-01-020 — delegates to authService.resetPassword on valid token', async () => {
      const controller = await buildController();
      mockAuthService.resetPassword.mockResolvedValue({ message: 'Password reset.' });

      const result = await controller.resetPassword({ token: 'tok', newPassword: 'NewP@ss1' } as any);

      expect(mockAuthService.resetPassword).toHaveBeenCalled();
      expect(result).toHaveProperty('message');
    });

    it('TC-01-021 — propagates BadRequestException on invalid token', async () => {
      const controller = await buildController();
      mockAuthService.resetPassword.mockRejectedValue(new BadRequestException('TOKEN_INVALID'));

      await expect(controller.resetPassword({ token: 'bad', newPassword: 'x' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── TC-01-052: GET /auth/google — redirects to Google ────────────────────
  describe('googleAuth', () => {
    it('TC-01-052 — googleAuth handler exists (guard handles redirect)', async () => {
      const controller = await buildController();
      // Guard handles the actual redirect; the handler itself returns undefined
      const result = controller.googleAuth();
      expect(result).toBeUndefined();
    });
  });

  // ── OAuth exchange ─────────────────────────────────────────────────────────
  describe('oauthExchange', () => {
    it('TC-01-032 — exchanges redirect code for tokens', async () => {
      const controller = await buildController();
      mockAuthService.consumeOAuthRedirectCode.mockReturnValue({ accessToken: 'at', refreshToken: 'rt' });

      const result = await controller.oauthExchange({ code: 'one-time-code' } as any);

      expect(mockAuthService.consumeOAuthRedirectCode).toHaveBeenCalledWith('one-time-code');
      expect(result).toHaveProperty('accessToken');
    });
  });

  // ── TC-01-053: POST /auth/2fa/setup ───────────────────────────────────────
  describe('2FA', () => {
    it('TC-01-053 — setup2fa returns qrCode and secret', async () => {
      const controller = await buildController();
      mockAuthService.generate2faSecret.mockResolvedValue({ qrCode: 'data:image/png,...', secret: 'TOTP_SECRET' });
      const user = { id: 'u1', email: 'u@t.com', tier: 'free', isAdmin: false };

      const result = await controller.setup2fa(user as any);

      expect(mockAuthService.generate2faSecret).toHaveBeenCalledWith('u1');
      expect(result).toHaveProperty('qrCode');
      expect(result).toHaveProperty('secret');
    });

    it('TC-01-024 — enable2fa delegates with userId and code', async () => {
      const controller = await buildController();
      mockAuthService.enable2fa.mockResolvedValue({ message: '2FA enabled.' });
      const user = { id: 'u1', email: 'u@t.com', tier: 'free', isAdmin: false };

      const result = await controller.enable2fa(user as any, { code: '123456' } as any);

      expect(mockAuthService.enable2fa).toHaveBeenCalledWith('u1', '123456');
      expect(result).toHaveProperty('message');
    });

    it('TC-01-028 — disable2fa delegates with userId and code', async () => {
      const controller = await buildController();
      mockAuthService.disable2fa.mockResolvedValue({ message: '2FA disabled.' });
      const user = { id: 'u1', email: 'u@t.com', tier: 'free', isAdmin: false };

      const result = await controller.disable2fa(user as any, { code: '123456' } as any);

      expect(mockAuthService.disable2fa).toHaveBeenCalledWith('u1', '123456');
      expect(result).toHaveProperty('message');
    });

    // TC-01-054: POST /auth/2fa/confirm → 200 with tokens
    it('TC-01-054 — confirm2fa returns tokens on valid TOTP', async () => {
      const controller = await buildController();
      mockAuthService.confirm2faLogin.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

      const result = await controller.confirm2fa({ mfaToken: 'mfa-jwt', code: '123456' } as any);

      expect(mockAuthService.confirm2faLogin).toHaveBeenCalledWith('mfa-jwt', '123456');
      expect(result).toHaveProperty('accessToken');
    });

    it('TC-01-027 — confirm2fa propagates UnauthorizedException on wrong TOTP', async () => {
      const controller = await buildController();
      mockAuthService.confirm2faLogin.mockRejectedValue(new UnauthorizedException('INVALID_TOTP'));

      await expect(
        controller.confirm2fa({ mfaToken: 'mfa-jwt', code: '000000' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
