export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  subscriptionTier: SubscriptionTier;
  isVerified: boolean;
  reputation: number;
  language: string;
  notificationPreferences: NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'enterprise';

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
}
