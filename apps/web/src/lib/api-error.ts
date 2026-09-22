import { ApiError } from './api';

/**
 * Determines if an error is a QR code/tag creation limit (403 QR_LIMIT_REACHED).
 */
export function isQrLimitReached(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof ApiError) {
    if (error.code === 'QR_LIMIT_REACHED' || error.code === 'QR_BULK_LIMIT_EXCEEDED') return true;
    if (error.status === 403) {
      const msg = error.message.toLowerCase();
      return msg.includes('qr code limit') || msg.includes('tag limit') || msg.includes('plan limit');
    }
    return false;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('qr_limit_reached') || msg.includes('qr code limit') || msg.includes('tag limit');
  }
  return false;
}
