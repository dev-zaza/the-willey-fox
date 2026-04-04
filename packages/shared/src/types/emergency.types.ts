import { EMERGENCY_CONTACT_STATUSES } from '../constants/enums';

export type EmergencyContactStatus = (typeof EMERGENCY_CONTACT_STATUSES)[number];

export interface EmergencyContact {
  id: string;
  userId: string;
  contactUserId: string;
  status: EmergencyContactStatus;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SosAlert {
  id: string;
  userId: string;
  lat?: number;
  lng?: number;
  locationAddress?: string;
  message?: string;
  isAcknowledged: boolean;
  acknowledgedAt?: string;
  createdAt: string;
}
