import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { eq, and, isNull, gt } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { nanoid } from 'nanoid';
import { authenticator } from '@otplib/preset-default';
import * as QRCode from 'qrcode';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { users, refreshTokens } from '../../database/schema';
import { SignupDto, LoginDto, RefreshTokenDto, VerifyEmailDto, ForgotPasswordDto, ResetPasswordDto, ResendVerificationDto } from './dto';
import type { GoogleProfile } from './strategies/google.strategy';
import { NotificationsService } from '../notifications/notifications.service';
import { buildVerificationEmail, buildPasswordResetEmail } from '../notifications/templates/auth-notification';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Google OAuth → browser redirect must stay short; tokens live here until one-time exchange. */
  private readonly oauthRedirectStore = new Map<
    string,
    { accessToken: string; refreshToken: string; expiresAt: number }
  >();
  private readonly oauthRedirectTtlMs = 5 * 60 * 1000;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const [user] = await this.db
      .insert(users)
      .values({
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        phone: dto.phone,
        verificationToken,
        verificationTokenExpiresAt,
      })
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      });

    const publicBaseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:3001');
    const verifyUrl = `${publicBaseUrl}/verify-email?token=${verificationToken}`;

    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(`[DEV] Email verification link for ${dto.email}: ${verifyUrl}`);
    }

    const { subject, body } = buildVerificationEmail(dto.firstName, verifyUrl);

    this.notificationsService
      .sendAuthEmail(dto.email.toLowerCase(), user.id, subject, body)
      .catch((err) => this.logger.error(`Failed to queue verification email: ${err.message}`));

    return {
      user,
      message: 'Account created. Please verify your email.',
    };
  }

  async login(dto: LoginDto) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('OAUTH_ACCOUNT_NO_PASSWORD');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    // If 2FA is enabled, return a short-lived mfaToken instead of full credentials
    if (user.twoFactorEnabled) {
      const mfaToken = this.generateMfaToken(user.id);
      return { mfaRequired: true as const, mfaToken };
    }

    return this.issueTokensForUser(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(dto.refreshToken);

    const [storedToken] = await this.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!storedToken) {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }

    // Revoke old token
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, storedToken.id));

    // Get user
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, storedToken.userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('USER_NOT_FOUND');
    }

    // Issue new pair
    return this.issueTokensForUser(user);
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.verificationToken, dto.token),
          gt(users.verificationTokenExpiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!user) {
      throw new BadRequestException('INVALID_OR_EXPIRED_VERIFICATION_TOKEN');
    }

    await this.db
      .update(users)
      .set({
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { message: 'Email verified successfully.' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const [user] = await this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        isVerified: users.isVerified,
        verificationTokenExpiresAt: users.verificationTokenExpiresAt,
      })
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);

    // Always return success to prevent email enumeration
    if (!user || user.isVerified) {
      return { message: 'If an unverified account with that email exists, a verification link has been sent.' };
    }

    // Rate limit: refuse if the last token was created less than 2 minutes ago
    if (user.verificationTokenExpiresAt) {
      const tokenCreatedAt = new Date(user.verificationTokenExpiresAt.getTime() - 24 * 60 * 60 * 1000);
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      if (tokenCreatedAt > twoMinutesAgo) {
        throw new BadRequestException('VERIFICATION_RATE_LIMITED');
      }
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.db
      .update(users)
      .set({ verificationToken, verificationTokenExpiresAt, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    const publicBaseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:3001');
    const verifyUrl = `${publicBaseUrl}/verify-email?token=${verificationToken}`;

    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(`[DEV] Email verification link for ${dto.email}: ${verifyUrl}`);
    }

    const { subject, body } = buildVerificationEmail(user.firstName, verifyUrl);

    this.notificationsService
      .sendAuthEmail(dto.email.toLowerCase(), user.id, subject, body)
      .catch((err) => this.logger.error(`Failed to queue resend verification email: ${err.message}`));

    return { message: 'If an unverified account with that email exists, a verification link has been sent.' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.db
      .update(users)
      .set({ resetToken, resetTokenExpiresAt, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    const publicBaseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:3001');
    const resetUrl = `${publicBaseUrl}/reset-password?token=${resetToken}`;

    const [fullUser] = await this.db
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const { subject, body } = buildPasswordResetEmail(fullUser.firstName, resetUrl);

    this.notificationsService
      .sendAuthEmail(dto.email.toLowerCase(), user.id, subject, body)
      .catch((err) => this.logger.error(`Failed to queue password reset email: ${err.message}`));

    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.resetToken, dto.token),
          gt(users.resetTokenExpiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!user) {
      throw new BadRequestException('INVALID_OR_EXPIRED_RESET_TOKEN');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.db
      .update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { message: 'Password reset successfully.' };
  }

  async logout(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(dto.refreshToken);

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));

    return { message: 'Logged out successfully.' };
  }

  // ─── OAuth ───────────────────────────────────────────────────────────────

  /**
   * Mobile Google OAuth — PKCE flow.
   * Receives the authorization code from expo-auth-session, exchanges it with
   * Google's token endpoint, fetches the userinfo, then calls findOrCreateOAuthUser.
   */
  async googleMobileLogin(code: string, redirectUri: string) {
    const clientId = this.configService.get<string>('GOOGLE_WEB_CLIENT_ID', '');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET', '');

    // Exchange authorization code for Google access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text().catch(() => 'unknown');
      this.logger.warn(`Google token exchange failed: ${err}`);
      throw new UnauthorizedException('GOOGLE_TOKEN_EXCHANGE_FAILED');
    }

    const tokenData = await tokenRes.json() as { access_token: string };

    // Fetch Google profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      throw new UnauthorizedException('GOOGLE_PROFILE_FETCH_FAILED');
    }

    const gProfile = await profileRes.json() as {
      id: string;
      email: string;
      given_name: string;
      family_name: string;
      picture: string;
    };

    const profile: GoogleProfile = {
      id: gProfile.id,
      email: gProfile.email,
      firstName: gProfile.given_name ?? '',
      lastName: gProfile.family_name ?? '',
      avatarUrl: gProfile.picture ?? null,
    };

    return this.findOrCreateOAuthUser(profile);
  }

  async findOrCreateOAuthUser(profile: GoogleProfile) {
    // Look up by provider + providerId
    const [existingByProvider] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.oauthProvider, 'google'),
          eq(users.oauthProviderId, profile.id),
        ),
      )
      .limit(1);

    if (existingByProvider) {
      return this.issueTokensForUser(existingByProvider);
    }

    // Look up by email — link the OAuth provider to the existing account
    const [existingByEmail] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, profile.email.toLowerCase()))
      .limit(1);

    if (existingByEmail) {
      await this.db
        .update(users)
        .set({
          oauthProvider: 'google',
          oauthProviderId: profile.id,
          isVerified: true,
          avatarUrl: existingByEmail.avatarUrl ?? profile.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByEmail.id));
      return this.issueTokensForUser(existingByEmail);
    }

    // Create new user from OAuth profile
    const [newUser] = await this.db
      .insert(users)
      .values({
        email: profile.email.toLowerCase(),
        firstName: profile.firstName,
        lastName: profile.lastName,
        passwordHash: null,
        oauthProvider: 'google',
        oauthProviderId: profile.id,
        avatarUrl: profile.avatarUrl,
        isVerified: true,
      })
      .returning();

    return this.issueTokensForUser(newUser);
  }

  private async issueTokensForUser(user: typeof users.$inferSelect) {
    const accessToken = this.generateAccessToken(user.id, user.email, user.subscriptionTier, user.isAdmin);
    const { token: rawRefreshToken, hash: refreshTokenHash } = this.generateRefreshToken();

    const refreshExpiryDays = this.configService.get<number>('REFRESH_TOKEN_EXPIRY_DAYS', 30);
    const expiresAt = new Date(Date.now() + refreshExpiryDays * 24 * 60 * 60 * 1000);

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        subscriptionTier: user.subscriptionTier,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
      },
    };
  }

  // ─── 2FA ─────────────────────────────────────────────────────────────────

  async generate2faSecret(userId: string) {
    const [user] = await this.db
      .select({ email: users.email, twoFactorEnabled: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new BadRequestException('USER_NOT_FOUND');
    if (user.twoFactorEnabled) throw new BadRequestException('TWO_FACTOR_ALREADY_ENABLED');

    const secret = authenticator.generateSecret();
    const appName = this.configService.get<string>('APP_NAME', 'TheWileyfox');
    const otpAuthUrl = authenticator.keyuri(user.email, appName, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Store the pending secret (not yet confirmed)
    await this.db
      .update(users)
      .set({ twoFactorSecret: secret, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { qrCode: qrCodeDataUrl, secret };
  }

  async enable2fa(userId: string, code: string) {
    const [user] = await this.db
      .select({ twoFactorSecret: users.twoFactorSecret, twoFactorEnabled: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new BadRequestException('USER_NOT_FOUND');
    if (user.twoFactorEnabled) throw new BadRequestException('TWO_FACTOR_ALREADY_ENABLED');
    if (!user.twoFactorSecret) throw new BadRequestException('TWO_FACTOR_SETUP_NOT_INITIATED');

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!isValid) throw new BadRequestException('INVALID_TWO_FACTOR_CODE');

    await this.db
      .update(users)
      .set({ twoFactorEnabled: true, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { message: '2FA enabled successfully.' };
  }

  async disable2fa(userId: string, code: string) {
    const [user] = await this.db
      .select({ twoFactorSecret: users.twoFactorSecret, twoFactorEnabled: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new BadRequestException('USER_NOT_FOUND');
    if (!user.twoFactorEnabled) throw new BadRequestException('TWO_FACTOR_NOT_ENABLED');

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret! });
    if (!isValid) throw new BadRequestException('INVALID_TWO_FACTOR_CODE');

    await this.db
      .update(users)
      .set({ twoFactorEnabled: false, twoFactorSecret: null, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { message: '2FA disabled successfully.' };
  }

  async confirm2faLogin(mfaToken: string, code: string) {
    // mfaToken is a short-lived JWT with scope: 'mfa'
    let payload: { sub: string; scope: string };
    try {
      payload = this.jwtService.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('INVALID_MFA_TOKEN');
    }

    if (payload.scope !== 'mfa') {
      throw new UnauthorizedException('INVALID_MFA_TOKEN');
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) throw new UnauthorizedException('USER_NOT_FOUND');

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret! });
    if (!isValid) throw new BadRequestException('INVALID_TWO_FACTOR_CODE');

    return this.issueTokensForUser(user);
  }

  private generateMfaToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, scope: 'mfa' },
      { expiresIn: '5m' },
    );
  }

  private generateAccessToken(userId: string, email: string, tier: string, isAdmin = false): string {
    const expiryMinutes = this.configService.get<number>('ACCESS_TOKEN_EXPIRY_MINUTES', 10080); // 7 days
    return this.jwtService.sign(
      { sub: userId, email, tier, isAdmin },
      { expiresIn: `${expiryMinutes}m` },
    );
  }

  private generateRefreshToken(): { token: string; hash: string } {
    const token = crypto.randomBytes(40).toString('hex');
    const hash = this.hashToken(token);
    return { token, hash };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  issueOAuthRedirectCode(accessToken: string, refreshToken: string): string {
    this.pruneExpiredOAuthRedirectCodes();
    const code = nanoid(26);
    this.oauthRedirectStore.set(code, {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + this.oauthRedirectTtlMs,
    });
    return code;
  }

  consumeOAuthRedirectCode(code: string): { accessToken: string; refreshToken: string } {
    const trimmed = code?.trim();
    if (!trimmed) {
      throw new BadRequestException({
        code: 'OAUTH_CODE_INVALID',
        message: 'Missing sign-in code.',
      });
    }
    const row = this.oauthRedirectStore.get(trimmed);
    if (!row) {
      throw new BadRequestException({
        code: 'OAUTH_CODE_INVALID',
        message: 'Invalid or already used sign-in code.',
      });
    }
    if (Date.now() > row.expiresAt) {
      this.oauthRedirectStore.delete(trimmed);
      throw new BadRequestException({
        code: 'OAUTH_CODE_EXPIRED',
        message: 'Sign-in link expired. Please try again.',
      });
    }
    this.oauthRedirectStore.delete(trimmed);
    return { accessToken: row.accessToken, refreshToken: row.refreshToken };
  }

  private pruneExpiredOAuthRedirectCodes(): void {
    const now = Date.now();
    for (const [key, row] of this.oauthRedirectStore) {
      if (now > row.expiresAt) this.oauthRedirectStore.delete(key);
    }
  }
}
