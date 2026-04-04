import { CanActivate, ExecutionContext, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QrService } from '../qr.service';

@Injectable()
export class QrAccessGuard implements CanActivate {
  constructor(private readonly qrService: QrService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const qrId = request.params.id;

    if (!userId || !qrId) {
      throw new ForbiddenException('ACCESS_DENIED');
    }

    const qrCode = await this.qrService.findById(qrId);
    if (!qrCode) {
      throw new NotFoundException('QR_NOT_FOUND');
    }

    const hasAccess = await this.qrService.isOwnerOrGuardian(qrId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('ACCESS_DENIED');
    }

    request.qrCode = qrCode;
    return true;
  }
}
