import { apiClient } from './api';

export interface AppNotification {
  id: string;
  type: string;
  subject: string | null;
  title: string;   // derived from subject
  body: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsListResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export const notificationsService = {
  list: async (): Promise<NotificationsListResponse> => {
    const { data } = await apiClient.get<{ notifications: (Omit<AppNotification, 'title'> & { subject?: string | null })[]; unreadCount: number }>('/notifications');
    return {
      notifications: (data.notifications ?? []).map((n) => ({
        ...n,
        title: n.subject ?? 'Notification',
      })),
      unreadCount: data.unreadCount ?? 0,
    };
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/read');
  },
};
