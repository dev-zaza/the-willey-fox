import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Same as GoogleAuthGuard but encodes the mobile app's redirect URI into the
 * OAuth state param so the callback knows exactly where to redirect back to.
 * The redirectUri is passed as a query param: GET /auth/google/mobile-init?redirectUri=...
 */
@Injectable()
export class GoogleMobileAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const redirectUri: string = req.query?.redirectUri ?? '';
    // Encode as JSON in state so callback can decode it alongside any other state
    const state = JSON.stringify({ mobile: true, redirectUri });
    return { state };
  }
}
