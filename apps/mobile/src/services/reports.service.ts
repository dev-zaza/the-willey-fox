import { apiClient } from './api';

export interface ReportResponse {
  id: string;
  message: string;
  createdAt: string;
}

export interface Report {
  id: string;
  qrCodeId: string;
  finderContact: string;
  finderNotes?: string;
  message?: string;          // alias — some paths still use this
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
  status?: string;
  createdAt: string;
  responses?: ReportResponse[];
}

export const reportsService = {
  listAll: async (): Promise<Report[]> => {
    const { data } = await apiClient.get<Report[]>('/reports');
    return data ?? [];
  },

  getById: async (reportId: string): Promise<Report> => {
    const { data } = await apiClient.get<Report>(`/reports/${reportId}`);
    return data;
  },

  respond: async (reportId: string, message: string): Promise<ReportResponse> => {
    const { data } = await apiClient.post<ReportResponse>(`/reports/${reportId}/respond`, { message });
    return data;
  },

  reportSighting: async (
    reportId: string,
    opts?: { notes?: string; lat?: number; lng?: number; locationAddress?: string; finderContact?: string },
  ): Promise<void> => {
    await apiClient.post(`/reports/${reportId}/sighting`, {
      notes: opts?.notes,
      lat: opts?.lat,
      lng: opts?.lng,
      locationAddress: opts?.locationAddress,
      finderContact: opts?.finderContact,
    });
  },

  createMissingReport: async (payload: {
    qrCodeId: string;
    description: string;
    lastSeenLocation?: string;
    contact: string;
    photoUri?: string;
    lat?: number;
    lng?: number;
    requestBroadcast?: boolean;
  }): Promise<{ id: string; broadcast: boolean }> => {
    const { data } = await apiClient.post<{ id: string; broadcast: boolean }>('/reports', {
      qrCodeId: payload.qrCodeId,
      description: payload.description,
      contact: payload.contact,
      lastSeenLocation: payload.lastSeenLocation,
      lat: payload.lat,
      lng: payload.lng,
      requestBroadcast: payload.requestBroadcast ?? true,
    });

    // Upload photo separately if provided
    if (payload.photoUri) {
      const form = new FormData();
      const filename = payload.photoUri.split('/').pop() ?? 'photo.jpg';
      form.append('file', { uri: payload.photoUri, name: filename, type: 'image/jpeg' } as any);
      await apiClient.post(`/public/reports/${data.id}/photo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).catch(() => { /* photo upload failure non-critical */ });
    }

    return data;
  },
};
