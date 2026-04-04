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
  listForQr: async (qrCodeId: string): Promise<Report[]> => {
    const { data } = await apiClient.get<Report[]>(`/reports?qrCodeId=${qrCodeId}`);
    return data;
  },

  respond: async (reportId: string, message: string): Promise<ReportResponse> => {
    const { data } = await apiClient.post<ReportResponse>(`/reports/${reportId}/responses`, { message });
    return data;
  },
};
