export interface NotificationPayload {
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
  priority?: 'normal' | 'critical';
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface INotificationProvider {
  send(payload: NotificationPayload): Promise<NotificationResult>;
}
