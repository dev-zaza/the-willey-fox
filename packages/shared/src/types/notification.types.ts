export type NotificationType = 'email' | 'sms' | 'push';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'retrying';

export interface ReportResponse {
  id: string;
  reportId: string;
  guardianId: string;
  message: string;
  guardianName: string;
  createdAt: Date;
}
