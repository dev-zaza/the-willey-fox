import { apiClient } from './api';

export interface EmergencyContactRecord {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  isPrimarySos: boolean;
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

export interface ActiveSosNear {
  id: string;
  lat: string;
  lng: string;
  createdAt: string;
  distanceMetres: number;
}

export const emergencyService = {
  listContacts: async (): Promise<EmergencyContactRecord[]> => {
    const { data } = await apiClient.get<EmergencyContactRecord[]>('/emergency/contacts');
    return data;
  },

  addContact: async (payload: {
    contactUserId?: string;
    contactEmail?: string;
  }): Promise<EmergencyContactRecord> => {
    const { data } = await apiClient.post<EmergencyContactRecord>('/emergency/contacts', payload);
    return data;
  },

  acceptContact: async (contactId: string): Promise<EmergencyContactRecord> => {
    const { data } = await apiClient.patch<EmergencyContactRecord>(`/emergency/contacts/${contactId}/accept`);
    return data;
  },

  removeContact: async (contactId: string): Promise<void> => {
    await apiClient.delete(`/emergency/contacts/${contactId}`);
  },

  triggerSos: async (payload: {
    lat?: number;
    lng?: number;
    locationAddress?: string;
    message?: string;
  }): Promise<{ id: string; notifiedCount: number }> => {
    const { data } = await apiClient.post<{ id: string; notifiedCount: number }>('/emergency/sos', payload);
    return data;
  },

  listSosAlerts: async (): Promise<SosAlert[]> => {
    const { data } = await apiClient.get<SosAlert[]>('/emergency/sos');
    return data;
  },

  acknowledgeSos: async (alertId: string): Promise<SosAlert> => {
    const { data } = await apiClient.patch<SosAlert>(`/emergency/sos/${alertId}/acknowledge`);
    return data;
  },

  setPrimary: async (contactId: string): Promise<{ message: string }> => {
    const { data } = await apiClient.patch<{ message: string }>(`/emergency/contacts/${contactId}/set-primary`);
    return data;
  },

  declineContact: async (contactId: string): Promise<EmergencyContactRecord> => {
    const { data } = await apiClient.patch<EmergencyContactRecord>(`/emergency/contacts/${contactId}/decline`);
    return data;
  },

  getActiveSosNear: async (lat: number, lng: number, radius = 2000): Promise<ActiveSosNear[]> => {
    const { data } = await apiClient.get<ActiveSosNear[]>(
      `/emergency/active-near?lat=${lat}&lng=${lng}&radius=${radius}`,
    );
    return data;
  },
};
