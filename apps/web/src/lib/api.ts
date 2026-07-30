import { getFriendlyErrorMessage } from '@safetag/shared';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(getFriendlyErrorMessage(message, message));
    this.name = 'ApiError';
  }
}

// Prevents multiple concurrent refresh attempts
let refreshPromise: Promise<string> | null = null;

async function silentRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('NO_REFRESH_TOKEN');

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) throw new Error('REFRESH_FAILED');

    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
  jsonContentType = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(jsonContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401 && authenticated) {
    // Attempt silent refresh once, then retry
    try {
      const newToken = await silentRefresh();
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
      const retryRes = await fetch(`${BASE_URL}${path}`, { ...init, headers: retryHeaders });

      if (retryRes.status === 401) {
        clearTokens();
        window.location.href = '/login';
        throw new ApiError(401, 'AUTH_REQUIRED', 'Unauthorized');
      }

      const retryBody = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok) {
        throw new ApiError(retryRes.status, retryBody.code ?? 'UNKNOWN_ERROR', retryBody.message ?? 'Something went wrong');
      }
      return retryBody as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      clearTokens();
      window.location.href = '/login';
      throw new ApiError(401, 'AUTH_REQUIRED', 'Unauthorized');
    }
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body.code ?? 'UNKNOWN_ERROR',
      body.message ?? 'Something went wrong',
    );
  }

  return body as T;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface SignupResponse {
  user: Pick<UserProfile, 'id' | 'email' | 'firstName' | 'lastName'>;
  message: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  subscriptionTier: string;
  isVerified: boolean;
  isAdmin?: boolean;
  createdAt: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  language?: string;
  notificationPreferences?: { email?: boolean; push?: boolean; sms?: boolean };
  fcmToken?: string;
}

async function requestBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { headers });

  if (res.status === 401) {
    try {
      const newToken = await silentRefresh();
      const retryRes = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      if (!retryRes.ok) throw new ApiError(retryRes.status, 'DOWNLOAD_FAILED', 'Download failed');
      const disposition = retryRes.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      return { blob: await retryRes.blob(), filename: match?.[1] ?? 'download' };
    } catch {
      clearTokens();
      window.location.href = '/login';
      throw new ApiError(401, 'AUTH_REQUIRED', 'Unauthorized');
    }
  }

  if (!res.ok) throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'Download failed');
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  return { blob: await res.blob(), filename: match?.[1] ?? 'download' };
}

export const auth = {
  login: (payload: LoginPayload) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }, false),
  register: (payload: RegisterPayload) =>
    request<SignupResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }, false),
  me: () => request<UserProfile>('/users/me'),
  refreshToken: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refreshToken }) },
      false,
    ),
  oauthExchange: (code: string) =>
    request<{ accessToken: string; refreshToken: string }>(
      '/auth/oauth-exchange',
      { method: 'POST', body: JSON.stringify({ code }) },
      false,
    ),
};

export const users = {
  updateProfile: (payload: UpdateProfilePayload) =>
    request<UserProfile>('/users/me', { method: 'PUT', body: JSON.stringify(payload) }),
  search: (q: string) => request<Pick<UserProfile, 'id' | 'firstName' | 'lastName' | 'email'>[]>(`/users/search?q=${encodeURIComponent(q)}`),
  uploadAvatar: (formData: FormData) =>
    request<{ avatarUrl: string }>('/users/me/avatar', { method: 'POST', body: formData }, true, false),
  updateLocation: (lat: number, lng: number) =>
    request<void>('/users/me/location', { method: 'POST', body: JSON.stringify({ lat, lng }) }),
  blockUser: (id: string) =>
    request<{ message: string }>(`/users/${id}/block`, { method: 'POST', body: JSON.stringify({}) }),
  unblockUser: (id: string) =>
    request<{ message: string }>(`/users/${id}/block`, { method: 'DELETE' }),
  listBlocked: () => request<{ id: string; blockedId: string; createdAt: string }[]>('/users/blocked'),
  reportUser: (id: string, reason: string, contextType?: string, contextId?: string) =>
    request<{ id: string }>(`/users/${id}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, contextType, contextId }),
    }),
};

export const twoFactor = {
  setup: () => request<{ qrCode: string; secret: string }>('/auth/2fa/setup', { method: 'POST' }),
  enable: (code: string) => request<{ message: string }>('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  disable: (code: string) => request<{ message: string }>('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) }),
  confirm: (mfaToken: string, code: string) =>
    request<{ accessToken: string; refreshToken: string; user: UserProfile }>(
      '/auth/2fa/confirm',
      { method: 'POST', body: JSON.stringify({ mfaToken, code }) },
      false,
    ),
};

// ── QR Codes ─────────────────────────────────────────────────────────────────

export interface QrCode {
  id: string;
  uniqueCode: string;
  /** label is the display name; falls back to name for legacy records */
  label: string | null;
  name: string;
  category: string;
  isLost: boolean;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
  photoUrl?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateQrCodePayload {
  /** Human-readable display name shown on the finder page */
  name: string;
  label?: string;
  category: string;
  description?: string;
  photoUrl?: string;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
}

export interface UpdateQrCodePayload {
  name?: string;
  label?: string;
  category?: string;
  description?: string;
  photoUrl?: string;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
  isLost?: boolean;
}

export interface BulkCreateQrPayload {
  count: number;
  category: string;
}

export interface ActivateQrPayload {
  code: string;
  name: string;
  category: string;
  label?: string;
  description?: string;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
}

export const qrCodes = {
  list: () => request<QrCode[]>('/qr-codes'),
  get: (id: string) => request<QrCode>(`/qr-codes/${id}`),
  create: (payload: CreateQrCodePayload) =>
    request<QrCode>('/qr-codes', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: UpdateQrCodePayload) =>
    request<QrCode>(`/qr-codes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: (id: string) => request<void>(`/qr-codes/${id}`, { method: 'DELETE' }),
  markLost: (id: string) =>
    request<QrCode>(`/qr-codes/${id}/mark-lost`, { method: 'POST' }),
  markFound: (id: string) =>
    request<QrCode>(`/qr-codes/${id}/mark-found`, { method: 'POST' }),
  bulkCreate: (payload: BulkCreateQrPayload) =>
    request<QrCode[]>('/qr-codes/bulk', { method: 'POST', body: JSON.stringify(payload) }),
  setTheme: (id: string, themeId: string | null) =>
    request<QrCode>(`/qr-codes/${id}/theme`, { method: 'PATCH', body: JSON.stringify({ themeId }) }),
};

export const publicQr = {
  activate: (payload: ActivateQrPayload) =>
    request<QrCode>('/public/qr/activate', { method: 'POST', body: JSON.stringify(payload) }),
};

// ── Reports (public + authed) ─────────────────────────────────────────────────

export interface Report {
  id: string;
  qrCodeId: string;
  finderContact: string;
  finderNotes?: string;
  locationLat?: string;
  locationLng?: string;
  locationAddress?: string;
  photoUrl?: string;
  status: string;
  isPublicBroadcast?: boolean;
  broadcastApprovedAt?: string | null;
  broadcastExpiresAt?: string | null;
  broadcastExtendCount?: number;
  createdAt: string;
  responses?: ReportResponse[];
}

export interface ReportResponse {
  id: string;
  message: string;
  guardianName?: string;
  createdAt: string;
}

export interface CreateReportPayload {
  finderContact: string;
  finderNotes?: string;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
}

export const reports = {
  list: () => request<Report[]>('/reports'),
  listForQr: (qrCodeId: string) =>
    request<Report[]>('/reports').then((all) => all.filter((r) => r.qrCodeId === qrCodeId)),
  respond: (reportId: string, message: string) =>
    request<ReportResponse>(`/reports/${reportId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  flag: (reportId: string, reason: string) =>
    request<Report>(`/reports/${reportId}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  uploadPhoto: (reportId: string, formData: FormData) =>
    request<{ photoUrl: string }>(`/public/reports/${reportId}/photo`, { method: 'POST', body: formData }, false, false),
};

// ── Broadcasts ────────────────────────────────────────────────────────────────

export interface BroadcastListItem {
  id: string;
  qrCodeId: string;
  qrUniqueCode: string;
  category: string;
  name?: string | null;
  photoUrl?: string | null;
  lastSeenLocation?: string | null;
  lastSeenNotes?: string | null;
  broadcastApprovedAt: string;
  broadcastExpiresAt: string;
}

export interface BroadcastDetail extends BroadcastListItem {
  description?: string | null;
  customFields?: Record<string, unknown> | null;
  lastSeenLat?: string | null;
  lastSeenLng?: string | null;
}

export interface BroadcastAdminItem {
  id: string;
  qrCodeId: string;
  qrUniqueCode: string;
  qrCategory: string;
  qrName?: string | null;
  qrLabel?: string | null;
  approvedAt: string;
  expiresAt: string;
  extendCount: number;
  guardianUserId: string;
}

export interface BroadcastConsentLogEntry {
  id: string;
  reportId: string;
  guardianUserId: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  tosVersion: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const broadcasts = {
  enable: (reportId: string, tosVersion?: string) =>
    request<Report>(`/reports/${reportId}/broadcast`, {
      method: 'POST',
      body: JSON.stringify(tosVersion ? { tosVersion } : {}),
    }),
  disable: (reportId: string, reason?: string) =>
    request<Report>(`/reports/${reportId}/broadcast`, {
      method: 'DELETE',
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  extend: (reportId: string) =>
    request<Report>(`/reports/${reportId}/broadcast/extend`, { method: 'POST' }),
  listPublic: (page = 1, pageSize = 20) =>
    request<{ page: number; pageSize: number; items: BroadcastListItem[] }>(
      `/public/broadcasts?page=${page}&pageSize=${pageSize}`,
    ),
  getPublic: (id: string) => request<BroadcastDetail>(`/public/broadcasts/${id}`),
  messageGuardian: (id: string) =>
    request<{ conversationId: string }>(`/public/broadcasts/${id}/message`, { method: 'POST' }),
  adminList: () => request<BroadcastAdminItem[]>('/admin/broadcasts'),
  adminTakedown: (id: string, reason?: string) =>
    request<{ id: string; takenDown: boolean }>(`/admin/broadcasts/${id}/takedown`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  adminConsentLog: (id: string) =>
    request<BroadcastConsentLogEntry[]>(`/admin/broadcasts/${id}/consent-log`),
};

// ── Guardians ─────────────────────────────────────────────────────────────────

export interface Guardian {
  id: string;
  qrCodeId: string;
  guardianId: string;
  status: 'pending' | 'approved' | 'rejected';
  guardian: UserProfile;
  createdAt: string;
}

export const guardians = {
  listForQr: (qrCodeId: string) => request<Guardian[]>(`/guardians?qrCodeId=${qrCodeId}`),
  requestAccess: (qrCodeId: string) =>
    request<Guardian>('/guardians', { method: 'POST', body: JSON.stringify({ qrCodeId }) }),
  approve: (id: string) =>
    request<Guardian>(`/guardians/${id}/approve`, { method: 'POST' }),
  remove: (id: string) => request<void>(`/guardians/${id}`, { method: 'DELETE' }),
  inviteByEmail: (qrCodeId: string, email: string) =>
    request<{ invited: boolean; email?: string; mapping?: Guardian }>(`/qr-codes/${qrCodeId}/guardians/invite`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  acceptInvite: (token: string) =>
    request<Guardian>('/guardians/invite/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};

// ── Pins ─────────────────────────────────────────────────────────────────────

export interface PinData {
  id: string;
  title: string;
  description: string;
  type: string;
  lat: string;
  lng: string;
  status: string;
  upvotes: number;
  downvotes: number;
  expiresAt?: string;
  createdAt: string;
}

export interface CreatePinPayload {
  title: string;
  description: string;
  type: string;
  lat: number;
  lng: number;
  expiresAt?: string;
}

export const pins = {
  list: (params: { minLat: number; minLng: number; maxLat: number; maxLng: number }) =>
    request<PinData[]>(
      `/pins?minLat=${params.minLat}&minLng=${params.minLng}&maxLat=${params.maxLat}&maxLng=${params.maxLng}`,
      {},
      false,
    ),
  get: (id: string) => request<PinData>(`/pins/${id}`, {}, false),
  create: (payload: CreatePinPayload) =>
    request<PinData>('/pins', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<CreatePinPayload>) =>
    request<PinData>(`/pins/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  delete: (id: string) => request<void>(`/pins/${id}`, { method: 'DELETE' }),
  vote: (id: string, vote: 'up' | 'down') =>
    request<{ message: string }>(`/pins/${id}/vote`, { method: 'POST', body: JSON.stringify({ isUpvote: vote === 'up' }) }),
  flagPin: (id: string, reason: string) =>
    request<{ id: string }>(`/pins/${id}/flag`, { method: 'POST', body: JSON.stringify({ reason }) }),
};

// ── Messages / Conversations ──────────────────────────────────────────────────

export interface Conversation {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: {
    id: string;
    body: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
  otherParticipant?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export const messages = {
  listConversations: (search?: string) => request<Conversation[]>(`/messages/conversations${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getOrCreateConversation: (participantId: string) =>
    request<{ id: string }>('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify({ participantId }),
    }),
  listMessages: (conversationId: string, limit = 50, offset = 0) =>
    request<Message[]>(`/messages/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`),
  send: (conversationId: string, body: string) =>
    request<Message>('/messages', {
      method: 'POST',
      body: JSON.stringify({ conversationId, body }),
    }),
  markRead: (conversationId: string) =>
    request<void>(`/messages/conversations/${conversationId}/read`, { method: 'PATCH' }),
  archiveConversation: (conversationId: string) =>
    request<void>(`/messages/conversations/${conversationId}`, { method: 'DELETE' }),
};

// ── Emergency ─────────────────────────────────────────────────────────────────

export interface EmergencyContactRecord {
  id: string;
  status: 'pending' | 'accepted';
  acceptedAt?: string;
  createdAt: string;
  isRequester: boolean;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  } | null;
}

export interface SosAlert {
  id: string;
  userId: string;
  lat?: string;
  lng?: string;
  locationAddress?: string;
  message?: string;
  isAcknowledged: boolean;
  acknowledgedAt?: string;
  createdAt: string;
}

export const emergency = {
  listContacts: () => request<EmergencyContactRecord[]>('/emergency/contacts'),
  /** Add by user ID (from search) or by registered email */
  addContact: (payload: { contactUserId?: string; contactEmail?: string }) =>
    request<EmergencyContactRecord>('/emergency/contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  acceptContact: (contactId: string) =>
    request<EmergencyContactRecord>(`/emergency/contacts/${contactId}/accept`, { method: 'PATCH' }),
  declineContact: (contactId: string) =>
    request<EmergencyContactRecord>(`/emergency/contacts/${contactId}/decline`, { method: 'PATCH' }),
  removeContact: (contactId: string) =>
    request<void>(`/emergency/contacts/${contactId}`, { method: 'DELETE' }),
  triggerSos: (payload: { lat?: number; lng?: number; locationAddress?: string; message?: string }) =>
    request<{ id: string; notifiedCount: number }>('/emergency/sos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  acknowledgeSos: (alertId: string) =>
    request<SosAlert>(`/emergency/sos/${alertId}/acknowledge`, { method: 'PATCH' }),
  listSosAlerts: () => request<SosAlert[]>('/emergency/sos'),
  getActiveSosNear: (lat: number, lng: number, radius = 2000) =>
    request<SosAlert[]>(`/emergency/active-near?lat=${lat}&lng=${lng}&radius=${radius}`),
};

// ── Directions ────────────────────────────────────────────────────────────────

export interface RouteOption {
  id: string;
  label: string;
  safetyScore: number | null;
  safetyGrade: string | null;
  distanceKm: number;
  durationMinutes: number;
  polyline: string;
  warnings: string[];
  segmentScores: Array<{
    polyline: string;
    colour: string;
    safetyScore: number;
  }>;
  userRating: number | null;
}

/** Decode a Mapbox/Google encoded polyline string into [lng, lat] pairs. */
export function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

export const directions = {
  getRoute: (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) =>
    request<{ routes: RouteOption[] }>('/directions/route', {
      method: 'POST',
      body: JSON.stringify({ origin, destination }),
    }),
  getSafetyZone: (lat: number, lng: number) =>
    request<{ score: number; grade: string; colour: string } | null>(
      `/directions/safety-zone?lat=${lat}&lng=${lng}`,
      {},
      false,
    ),
};

// ── Payments ──────────────────────────────────────────────────────────────────

export interface SubscriptionStatus {
  tier: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  subscription?: {
    stripePriceId?: string | null;
  } | null;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  invoiceUrl?: string;
}

export const payments = {
  createCheckout: (interval: 'month' | 'year') =>
    request<{ url: string }>('/payments/checkout', { method: 'POST', body: JSON.stringify({ interval }) }),
  getSubscription: () => request<SubscriptionStatus>('/payments/subscription'),
  cancelSubscription: () => request<void>('/payments/subscription', { method: 'DELETE' }),
  changeSubscription: (interval: 'monthly' | 'annual') =>
    request<{ message: string }>('/payments/subscription', { method: 'PATCH', body: JSON.stringify({ interval }) }),
  getBillingPortal: () =>
    request<{ url: string }>('/payments/billing-portal', { method: 'POST' }),
  getInvoices: () => request<Invoice[]>('/payments/invoices'),
};

// ── Places ────────────────────────────────────────────────────────────────────

export interface PlaceData {
  id: string;
  mapboxPoiId?: string | null;
  name: string;
  category: string;
  address?: string | null;
  lat: string;
  lng: string;
  overallRating?: string | null;
  reviewCount: number;
  isUserCreated: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceReviewData {
  id: string;
  placeId: string;
  userId: string;
  overallRating: number;
  safetyRating?: number | null;
  cleanlinessRating?: number | null;
  valueRating?: number | null;
  serviceRating?: number | null;
  comment?: string | null;
  flagCount: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceWithReviews extends PlaceData {
  reviews: PlaceReviewData[];
}

export interface SearchPlacesParams {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  category?: string;
}

export interface CreatePlacePayload {
  name: string;
  category: string;
  lat: number;
  lng: number;
  address?: string;
  mapboxPoiId?: string;
}

export interface CreateReviewPayload {
  overallRating: number;
  safetyRating?: number;
  cleanlinessRating?: number;
  valueRating?: number;
  serviceRating?: number;
  comment?: string;
}

export const places = {
  search: (params: SearchPlacesParams) => {
    const qs = new URLSearchParams({
      minLat: String(params.minLat),
      minLng: String(params.minLng),
      maxLat: String(params.maxLat),
      maxLng: String(params.maxLng),
      ...(params.category ? { category: params.category } : {}),
    });
    return request<PlaceData[]>(`/places?${qs}`, {}, false);
  },
  get: (id: string) => request<PlaceWithReviews>(`/places/${id}`, {}, false),
  create: (payload: CreatePlacePayload) =>
    request<PlaceData>('/places', { method: 'POST', body: JSON.stringify(payload) }),
  createReview: (placeId: string, payload: CreateReviewPayload) =>
    request<PlaceReviewData>(`/places/${placeId}/reviews`, { method: 'POST', body: JSON.stringify(payload) }),
  updateReview: (placeId: string, reviewId: string, payload: CreateReviewPayload) =>
    request<PlaceReviewData>(`/places/${placeId}/reviews/${reviewId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteReview: (placeId: string, reviewId: string) =>
    request<{ message: string }>(`/places/${placeId}/reviews/${reviewId}`, { method: 'DELETE' }),
  flagReview: (placeId: string, reviewId: string, reason: string) =>
    request<{ message: string }>(`/places/${placeId}/reviews/${reviewId}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export interface NotificationLog {
  id: string;
  type: string;
  subject: string | null;
  body: string;
  status: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export const notifications = {
  list: () => request<{ notifications: NotificationLog[]; unreadCount: number }>('/notifications'),
  markRead: () => request<void>('/notifications/read', { method: 'PATCH' }),
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionTier: string;
  isVerified: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
}

export interface AdminQrRow {
  id: string;
  uniqueCode: string;
  name: string;
  category: string;
  userId: string;
  isLost: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AdminQrBatch {
  id: string;
  count: number;
  shopifyOrderId: string | null;
  notes: string | null;
  source: 'manual' | 'shopify_webhook';
  createdByAdminId: string | null;
  createdAt: string;
  adminFirstName: string | null;
  adminLastName: string | null;
  adminEmail: string | null;
}

export interface AdminQrBatchCode {
  id: string;
  uniqueCode: string;
  status: string;
  createdAt: string;
}

export interface AdminQrBatchDetail {
  batch: AdminQrBatch;
  codes: AdminQrBatchCode[];
}

export interface PrintFormatSpec {
  key: string;
  label: string;
  hasReverse: boolean;
}

export interface AdminReportRow {
  id: string;
  qrCodeId: string;
  finderContact: string | null;
  finderNotes: string | null;
  status: string;
  flagReason: string | null;
  createdAt: string;
}

export interface AdminPinRow {
  id: string;
  type: string;
  title: string;
  lat: string;
  lng: string;
  upvotes: number;
  downvotes: number;
  status: string;
  createdAt: string;
}

export interface AdminAnalytics {
  totals: {
    users: number;
    qrCodes: number;
    reports: number;
    pins: number;
    safetyZones: number;
  };
  timeSeries: {
    newUsersLast30Days: { date: string; count: number }[];
    reportsLast30Days: { date: string; count: number }[];
  };
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminUserReport {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  contextType: string | null;
  contextId: string | null;
  status: string;
  createdAt: string;
}

export interface AdminIngestionLog {
  id: string;
  source: string;
  status: string;
  zonesCreated: number;
  zonesUpdated: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface AdminSafetyZone {
  id: string;
  source: string;
  sourceRegion: string | null;
  safetyScore: string;
  periodStart: string | null;
  updatedAt: string;
}

export const admin = {
  getAnalytics: () => request<AdminAnalytics>('/admin/analytics'),
  listUsers: (query = '', limit = 50, offset = 0) =>
    request<AdminUserRow[]>(`/admin/users?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`),
  banUser: (id: string, reason: string) =>
    request<{ message: string }>(`/admin/users/${id}/ban`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  unbanUser: (id: string) => request<{ message: string }>(`/admin/users/${id}/unban`, { method: 'PUT' }),
  listQrCodes: (limit = 50, offset = 0) =>
    request<AdminQrRow[]>(`/admin/qr-codes?limit=${limit}&offset=${offset}`),
  bulkGenerateQr: (payload: { count: number; shopifyOrderId?: string; notes?: string }) =>
    request<{ batch: AdminQrBatch; codes: AdminQrBatchCode[] }>('/admin/qr/bulk-generate', {
      method: 'POST', body: JSON.stringify(payload),
    }),
  listBatches: (limit = 50, offset = 0, source?: 'manual' | 'shopify_webhook') =>
    request<AdminQrBatch[]>(`/admin/qr/batches?limit=${limit}&offset=${offset}${source ? `&source=${source}` : ''}`),
  getBatch: (id: string) => request<AdminQrBatchDetail>(`/admin/qr/batches/${id}`),
  downloadBatchPdf: (id: string) => requestBlob(`/admin/qr/batches/${id}/download-pdf`),
  downloadBatchZip: (id: string) => requestBlob(`/admin/qr/batches/${id}/download-zip`),
  downloadBatchPrint: (id: string, format: string) =>
    requestBlob(`/admin/qr/batches/${id}/download-print?format=${encodeURIComponent(format)}`),
  listPrintFormats: () => request<PrintFormatSpec[]>('/admin/qr/print-formats'),
  deleteUnclaimedFromBatch: (id: string) =>
    request<{ deleted: number; batchDeleted: boolean }>(`/admin/qr/batches/${id}/unclaimed`, { method: 'DELETE' }),
  listReports: (limit = 50, offset = 0, status?: string) =>
    request<AdminReportRow[]>(
      `/admin/reports?limit=${limit}&offset=${offset}${status ? `&status=${encodeURIComponent(status)}` : ''}`,
    ),
  updateReportStatus: (id: string, status: string) =>
    request<AdminReportRow>(`/admin/reports/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  listPins: (limit = 50, offset = 0) =>
    request<AdminPinRow[]>(`/admin/pins?limit=${limit}&offset=${offset}`),
  deletePin: (id: string) => request<{ message: string }>(`/admin/pins/${id}`, { method: 'DELETE' }),
  listIngestionLogs: (limit = 50, offset = 0) =>
    request<AdminIngestionLog[]>(`/admin/safety/ingestion-logs?limit=${limit}&offset=${offset}`),
  listSafetyZones: (limit = 50, offset = 0) =>
    request<AdminSafetyZone[]>(`/admin/safety/zones?limit=${limit}&offset=${offset}`),
  triggerIngestion: (source: 'uk_police' | 'fbi' | 'eurostat' | 'us_travel_advisory' | 'all') =>
    request<{ queued: string[] }>(`/admin/safety/trigger/${source}`, { method: 'POST' }),
  getPricing: () => request<PricingConfig>('/admin/settings/pricing'),
  updatePricing: (dto: Partial<PricingConfig>) =>
    request<PricingConfig>('/admin/settings/pricing', { method: 'PUT', body: JSON.stringify(dto) }),
  listAuditLogs: (limit = 50, offset = 0) =>
    request<AdminAuditLog[]>(`/admin/audit-logs?limit=${limit}&offset=${offset}`),
  listUserReports: (limit = 50, offset = 0) =>
    request<AdminUserReport[]>(`/admin/user-reports?limit=${limit}&offset=${offset}`),
  dismissUserReport: (id: string) =>
    request<{ message: string }>(`/admin/user-reports/${id}`, { method: 'DELETE' }),
  getQrCategories: () => request<QrCategoryConfig[]>('/admin/settings/qr-categories'),
  updateQrCategory: (value: string, patch: { label?: string; enabled?: boolean }) =>
    request<QrCategoryConfig[]>(`/admin/settings/qr-categories/${value}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  getQrTemplate: () => request<QrTemplateConfig>('/admin/settings/qr-template'),
  updateQrTemplate: (dto: Partial<QrTemplateConfig>) =>
    request<QrTemplateConfig>('/admin/settings/qr-template', { method: 'PUT', body: JSON.stringify(dto) }),
  // Print Templates
  listPrintTemplates: () => request<PrintTemplate[]>('/admin/print-templates'),
  getPrintTemplate: (id: string) => request<PrintTemplate>(`/admin/print-templates/${id}`),
  createPrintTemplate: (dto: Partial<CreatePrintTemplatePayload>) =>
    request<PrintTemplate>('/admin/print-templates', { method: 'POST', body: JSON.stringify(dto) }),
  updatePrintTemplate: (id: string, dto: Partial<CreatePrintTemplatePayload>) =>
    request<PrintTemplate>(`/admin/print-templates/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
  deletePrintTemplate: (id: string) =>
    request<{ message: string }>(`/admin/print-templates/${id}`, { method: 'DELETE' }),
  // Visual Themes
  listVisualThemes: () => request<VisualTheme[]>('/admin/visual-themes'),
  getVisualTheme: (id: string) => request<VisualTheme>(`/admin/visual-themes/${id}`),
  createVisualTheme: (dto: Partial<CreateVisualThemePayload>) =>
    request<VisualTheme>('/admin/visual-themes', { method: 'POST', body: JSON.stringify(dto) }),
  updateVisualTheme: (id: string, dto: Partial<CreateVisualThemePayload>) =>
    request<VisualTheme>(`/admin/visual-themes/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
  deleteVisualTheme: (id: string) =>
    request<{ message: string }>(`/admin/visual-themes/${id}`, { method: 'DELETE' }),
};

// ── Settings (public) ─────────────────────────────────────────────────────────

export interface QrCategoryConfig {
  value: string;
  label: string;
  core: boolean;
  enabled: boolean;
}

export interface PricingConfig {
  monthlyPriceCents: number;
  annualPriceCents: number;
  monthlyPriceLabel: string;
  annualPriceLabel: string;
  annualSavePercent: number;
  trialDays: number;
  stripePriceIdMonthly: string;
  stripePriceIdAnnual: string;
  tierLimits: {
    free: { maxQrCodes: number; maxGuardians: number; maxEmergencyContacts: number; maxPinsPerDay: number };
    basic: { maxQrCodes: number; maxGuardians: number; maxEmergencyContacts: number; maxPinsPerDay: number };
    premium: { maxQrCodes: number; maxGuardians: number; maxEmergencyContacts: number; maxPinsPerDay: number };
  };
}

export interface QrTemplateConfig {
  showLogo: boolean;
  accentColor: string;
  showCategory: boolean;
  showReward: boolean;
  showOwnerContact: boolean;
  footerText: string;
  logoUrl: string | null;
}

export const settings = {
  getPricing: () => request<PricingConfig>('/settings/pricing', {}, false),
  getQrCategories: () => request<QrCategoryConfig[]>('/settings/qr-categories', {}, false),
  getQrTemplate: () => request<QrTemplateConfig>('/settings/qr-template', {}, false),
  listVisualThemes: () => request<VisualTheme[]>('/settings/visual-themes', {}, false),
  listPrintTemplates: () => request<PrintTemplate[]>('/settings/print-templates', {}, false),
};

// ── Print Templates & Visual Themes ───────────────────────────────────────────

export interface TextSlots {
  showTagName?: boolean;
  showInstructions?: boolean;
  instructionsText?: string;
  showReward?: boolean;
  tagNamePosition?: string;
  instructionsPosition?: string;
}

export interface PrintTemplate {
  id: string;
  name: string;
  formatType: string;
  tierRequired: string;
  backgroundColor: string;
  logoPlacement: string;
  logoSize: number;
  qrPosition: string;
  qrSize: number;
  textSlots: TextSlots | Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VisualTheme {
  id: string;
  name: string;
  accentColor: string;
  backgroundStyle: string;
  showLogo: boolean;
  logoUrl: string | null;
  tierRequired: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreatePrintTemplatePayload = Omit<PrintTemplate, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateVisualThemePayload = Omit<VisualTheme, 'id' | 'createdAt' | 'updatedAt'>;

// ── Safety Overlay ────────────────────────────────────────────────────────────

export interface SafetyZoneOverlay {
  id: string;
  safetyScore: number;
  source: string;
  sourceRegion: string | null;
  sourceGranularity: string | null;
  colour: string;
  centroidLat?: string | null;
  centroidLng?: string | null;
  centerLat?: string | null;
  centerLng?: string | null;
  radiusMetres?: number | null;
  bboxMinLat?: string | null;
  bboxMinLng?: string | null;
  bboxMaxLat?: string | null;
  bboxMaxLng?: string | null;
}

export const safetyOverlay = {
  get: (params: { minLat: number; minLng: number; maxLat: number; maxLng: number }) =>
    request<{ zones: SafetyZoneOverlay[] }>(
      `/directions/safety-overlay?minLat=${params.minLat}&minLng=${params.minLng}&maxLat=${params.maxLat}&maxLng=${params.maxLng}`,
      {},
      false,
    ),
};

export interface H3TileFeature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  properties: { h3: string; score: number | null; band: string; color: string; incidentCount: number };
}

export interface H3TileCollection {
  type: 'FeatureCollection';
  features: H3TileFeature[];
}

export interface AreaSummary {
  lat: number;
  lng: number;
  radiusMetres: number;
  cityName: string;
  score: number | null;
  rawPoliceScore: number | null;
  band: string | null;
  incidentCount: number;
  weightedPerKm2: number;
  crimeBreakdown: Array<{ type: string; count: number }>;
  dataMonth: string;
  scoreMethodology: string;
}

export const safetyEngine = {
  getTiles: (bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }, resolution = 9) =>
    request<H3TileCollection>(
      `/safety-engine/tiles?bbox=${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}&resolution=${resolution}`,
      {},
      false,
    ),
  getAreaSummary: (params: { lat: number; lng: number; radius?: number; city?: string }) => {
    const q = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      ...(params.radius ? { radius: String(params.radius) } : {}),
      ...(params.city ? { city: params.city } : {}),
    });
    return request<AreaSummary>(`/safety-engine/area-summary?${q}`, {}, false);
  },
};

export const families = {
  list: () => request<any[]>('/families'),
  get: (id: string) => request<any>(`/families/${id}`),
  create: (name: string) => request<any>('/families', { method: 'POST', body: JSON.stringify({ name }) }),
  addMember: (familyId: string, payload: { userId?: string; email?: string }) =>
    request<any>(`/families/${familyId}/members`, { method: 'POST', body: JSON.stringify(payload) }),
  removeMember: (familyId: string, userId: string) =>
    request<any>(`/families/${familyId}/members/${userId}`, { method: 'DELETE' }),
  addQrCode: (familyId: string, qrCodeId: string) =>
    request<any>(`/families/${familyId}/qr-codes`, { method: 'POST', body: JSON.stringify({ qrCodeId }) }),
  removeQrCode: (familyId: string, qrCodeId: string) =>
    request<any>(`/families/${familyId}/qr-codes/${qrCodeId}`, { method: 'DELETE' }),
  delete: (familyId: string) => request<any>(`/families/${familyId}`, { method: 'DELETE' }),
};

export { ApiError };
