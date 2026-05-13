import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BroadcastEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const raw = this.config.get<string>('BROADCAST_ENABLED');
    const enabled = raw === undefined ? true : raw.toLowerCase() === 'true' || raw === '1';
    if (!enabled) {
      throw new ServiceUnavailableException('BROADCAST_DISABLED');
    }
    return true;
  }
}
