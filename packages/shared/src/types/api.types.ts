import { ErrorCode } from '../constants/enums';

export interface ApiMeta {
  total?: number;
  page?: number;
  limit?: number;
  hasNextPage?: boolean;
}

export interface ApiError {
  code: ErrorCode | string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T;
  meta?: ApiMeta;
  error?: ApiError;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: Required<Pick<ApiMeta, 'total' | 'page' | 'limit' | 'hasNextPage'>>;
}
