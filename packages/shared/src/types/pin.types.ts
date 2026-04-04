import { PIN_TYPES, PIN_STATUSES } from '../constants/enums';

export type PinType = (typeof PIN_TYPES)[number];
export type PinStatus = (typeof PIN_STATUSES)[number];

export interface Pin {
  id: string;
  userId: string;
  type: PinType;
  status: PinStatus;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  upvotes: number;
  downvotes: number;
  expiresAt?: string;
  eventEndTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PinVote {
  id: string;
  pinId: string;
  userId: string;
  isUpvote: boolean;
  createdAt: string;
}
