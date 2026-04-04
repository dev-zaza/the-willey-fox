import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleMobileAuthGuard } from './guards/google-mobile-auth.guard';
import type { AuthenticatedUser } from './strategies/jwt.strategy';
import {
  SignupDto,
  LoginDto,
  RefreshTokenDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendVerificationDto,
  Verify2faDto,
  Confirm2faLoginDto,
  OAuthExchangeDto,
  GoogleMobileDto,
} from './dto';
import { ConfigService } from '@nestjs/config';

function normalizePublicBaseUrl(raw: string): string {
  let u = raw.trim();
  if ((u.startsWith('"') && u.endsWith('"')) || (u.startsWith("'") && u.endsWith("'"))) {
    u = u.slice(1, -1).trim();
  }
  u = u.replace(/\/+$/, '');
  return u;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    // Guard handles redirect to Google (web flow)
  }

  /** Mobile entry point — same OAuth flow but passes state=mobile so the
   *  callback redirects to the app deep link instead of the web app. */
  @Public()
  @Get('google/mobile-init')
  @UseGuards(GoogleMobileAuthGuard)
  googleMobileInit() {
    // Guard handles redirect to Google (mobile flow, state=mobile)
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.findOrCreateOAuthUser(req.user);
    const code = this.authService.issueOAuthRedirectCode(result.accessToken, result.refreshToken);
    const q = new URLSearchParams({ code });

    // When initiated from the mobile app, state is a JSON object with mobile:true + redirectUri.
    // Redirect to exactly the redirectUri the mobile app sent so ASWebAuthenticationSession
    // can intercept it (in Expo Go this is exp://..., in standalone it is thewileyfox://).
    const rawState: string = req.query?.state ?? '';
    try {
      const stateObj = JSON.parse(rawState);
      if (stateObj?.mobile && stateObj?.redirectUri) {
        const mobileRedirect = decodeURIComponent(stateObj.redirectUri);
        const location = `${mobileRedirect}?${q.toString()}`;
        this.logger.log(`Google OAuth mobile redirect → ${mobileRedirect.slice(0, 40)}...?code=***`);
        return res.redirect(location);
      }
    } catch {
      // Not a mobile flow — fall through to web redirect
    }

    const webBaseUrl = normalizePublicBaseUrl(
      this.configService.get<string>('PUBLIC_BASE_URL', 'http://127.0.0.1:3001'),
    );
    const location = `${webBaseUrl}/auth/oauth-callback?${q.toString()}`;
    try {
      const u = new URL(location);
      if (u.pathname !== '/auth/oauth-callback') {
        this.logger.warn(`Unexpected oauth redirect path ${u.pathname} — check PUBLIC_BASE_URL`);
      }
      this.logger.log(`Google OAuth redirect → ${u.origin}${u.pathname}?code=*** (${u.protocol}//${u.host})`);
    } catch {
      this.logger.warn(`PUBLIC_BASE_URL may be invalid; redirect location: ${location.slice(0, 80)}…`);
    }
    return res.redirect(location);
  }

  /** Mobile PKCE flow — exchange Google auth code for app tokens. */
  @Public()
  @Post('google/mobile')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  googleMobileLogin(@Body() dto: GoogleMobileDto) {
    return this.authService.googleMobileLogin(dto.code, dto.redirectUri);
  }

  /** Exchange one-time code from Google OAuth redirect for tokens (keeps redirect URL short). */
  @Public()
  @Post('oauth-exchange')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  oauthExchange(@Body() dto: OAuthExchangeDto) {
    return this.authService.consumeOAuthRedirectCode(dto.code);
  }

  // ─── 2FA ─────────────────────────────────────────────────────────────────

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  setup2fa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.generate2faSecret(user.id);
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  enable2fa(@CurrentUser() user: AuthenticatedUser, @Body() dto: Verify2faDto) {
    return this.authService.enable2fa(user.id, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  disable2fa(@CurrentUser() user: AuthenticatedUser, @Body() dto: Verify2faDto) {
    return this.authService.disable2fa(user.id, dto.code);
  }

  @Public()
  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  confirm2fa(@Body() dto: Confirm2faLoginDto) {
    return this.authService.confirm2faLogin(dto.mfaToken, dto.code);
  }
}
