import { AxiosError } from 'axios';
import { getFriendlyErrorMessage } from '@safetag/shared';

/**
 * Extracts a user-friendly message from any thrown value (Axios errors, plain
 * Errors, strings). Maps backend SCREAMING_SNAKE_CASE codes to readable text
 * via the shared error-message catalog. Falls back to the supplied default.
 */
export function extractApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isServiceUnavailable(error)) {
    return "We're having trouble connecting. Please check your internet connection and try again.";
  }
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string | string[]; error?: string } | undefined;
    if (data?.message) return getFriendlyErrorMessage(data.message, fallback);
    if (data?.error) return getFriendlyErrorMessage(data.error, fallback);
    return fallback;
  }
  if (error instanceof Error) return getFriendlyErrorMessage(error.message, fallback);
  if (typeof error === 'string') return getFriendlyErrorMessage(error, fallback);
  return fallback;
}

/**
 * Determines if an error indicates the API/service is unavailable.
 * Covers: network errors, timeouts, and server errors (502, 503, 504).
 */
export function isServiceUnavailable(error: unknown): boolean {
  if (!error) return false;

  if (error instanceof AxiosError) {
    // No response = network error, timeout, or connection refused
    if (!error.response) {
      const code = (error as AxiosError & { code?: string }).code;
      return (
        code === 'ECONNABORTED' ||
        code === 'ENOTFOUND' ||
        code === 'ENETUNREACH' ||
        code === 'ECONNREFUSED' ||
        code === 'ERR_NETWORK' ||
        !code
      );
    }

    // Server-side unavailability
    const status = error.response.status;
    return status === 502 || status === 503 || status === 504;
  }

  return false;
}

/**
 * Determines if an error is a QR code/tag creation limit (403 QR_LIMIT_REACHED).
 */
export function isQrLimitReached(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof AxiosError) {
    if (error.response?.status !== 403) return false;
    const msg = (error.response?.data as { message?: string })?.message;
    const code = (error.response?.data as { code?: string })?.code;
    return msg === 'QR_LIMIT_REACHED' || code === 'QR_LIMIT_REACHED';
  }
  return false;
}
