import { apiClient } from './api';

export interface Conversation {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: {
    id: string;
    body: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
  otherParticipant?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export const messagesService = {
  listConversations: async (): Promise<Conversation[]> => {
    const { data } = await apiClient.get<Conversation[]>('/messages/conversations');
    return data;
  },

  getOrCreateConversation: async (participantId: string): Promise<{ id: string }> => {
    const { data } = await apiClient.post<{ id: string }>('/messages/conversations', { participantId });
    return data;
  },

  listMessages: async (conversationId: string, limit = 50, offset = 0): Promise<Message[]> => {
    const { data } = await apiClient.get<Message[]>(
      `/messages/conversations/${conversationId}/messages`,
      { params: { limit, offset } },
    );
    return data;
  },

  send: async (conversationId: string, body: string): Promise<Message> => {
    const { data } = await apiClient.post<Message>('/messages', { conversationId, body });
    return data;
  },

  markRead: async (conversationId: string): Promise<void> => {
    await apiClient.patch(`/messages/conversations/${conversationId}/read`);
  },
};
