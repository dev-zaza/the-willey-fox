import { ApiError } from './api';

/**
 * Determines if an error is a QR code/tag creation limit (403 QR_LIMIT_REACHED).
 */
export function isQrLimitReached(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof ApiError) {
    return (
      error.status === 403 &&
      (error.message === 'QR_LIMIT_REACHED' || error.code === 'QR_LIMIT_REACHED')
    );
  }
  return false;
}
