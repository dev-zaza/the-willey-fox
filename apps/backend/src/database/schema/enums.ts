import { pgEnum } from 'drizzle-orm/pg-core';

export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'free',
  'basic',
  'premium',
  'enterprise',
]);

export const qrCategoryEnum = pgEnum('qr_category', [
  'pet',
  'bag',
  'key',
  'person',
  'vehicle',
  'other',
  'medical',
  'place',
]);

export const guardianStatusEnum = pgEnum('guardian_status', [
  'pending',
  'active',
  'removed',
  'rejected',
]);

export const reportStatusEnum = pgEnum('report_status', [
  'open',
  'contacted',
  'resolved',
  'closed',
  'active',
  'flagged',
  'dismissed',
  'expired',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'email',
  'sms',
  'push',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sent',
  'failed',
  'retrying',
]);

export const pinTypeEnum = pgEnum('pin_type', [
  'hazard',
  'roadblock',
  'construction',
  'safety_alert',
  'traffic',
  'event',
  'pickpocket',
  'recommendation',
  'harassment',
  'unsafe_area',
  'other',
]);

export const pinStatusEnum = pgEnum('pin_status', [
  'active',
  'expired',
  'deactivated',
]);

export const safetySourceEnum = pgEnum('safety_source', [
  'uk_police',
  'eurostat',
  'fbi',
  'numbeo',
  'city_portal',
  'community',
  'us_travel_advisory',
]);

export const safetyGranularityEnum = pgEnum('safety_granularity', [
  'street',
  'neighbourhood',
  'city',
  'country',
]);

export const ingestionStatusEnum = pgEnum('ingestion_status', [
  'success',
  'failed',
  'partial',
]);

export const placeTypeEnum = pgEnum('place_type', [
  'hotel',
  'restaurant',
  'cafe',
  'bar',
  'attraction',
  'park',
  'transport_hub',
  'shopping',
  'other',
]);

export const emergencyContactStatusEnum = pgEnum('emergency_contact_status', [
  'pending',
  'accepted',
  'declined',
]);

export const conversationStatusEnum = pgEnum('conversation_status', [
  'active',
  'blocked',
  'archived',
]);

export const supportTicketStatusEnum = pgEnum('support_ticket_status', [
  'open',
  'in_progress',
  'resolved',
  'closed',
]);
