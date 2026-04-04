import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagesService } from './messages.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  namespace: '/messages',
  cors: { origin: '*', credentials: true },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`WS connection rejected: no token (socket=${client.id})`);
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });
      client.userId = payload.sub as string;

      // Join a user-specific room for targeted delivery
      client.join(`user:${client.userId}`);
      this.logger.log(`WS connected: userId=${client.userId} socket=${client.id}`);
    } catch {
      this.logger.warn(`WS connection rejected: invalid token (socket=${client.id})`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`WS disconnected: userId=${client.userId} socket=${client.id}`);
  }

  /**
   * Client joins a conversation room to receive real-time messages.
   * Payload: { conversationId: string }
   */
  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');

    await this.messagesService.assertParticipant(data.conversationId, client.userId);
    client.join(`conversation:${data.conversationId}`);
    this.logger.debug(`userId=${client.userId} joined conversation:${data.conversationId}`);

    return { event: 'joined', data: { conversationId: data.conversationId } };
  }

  /**
   * Client leaves a conversation room.
   * Payload: { conversationId: string }
   */
  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation:${data.conversationId}`);
    return { event: 'left', data: { conversationId: data.conversationId } };
  }

  /**
   * Client sends a message via WebSocket.
   * Payload: { conversationId: string; body: string }
   */
  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; body: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');

    if (!data.body || data.body.trim().length === 0) {
      throw new WsException('Message body cannot be empty');
    }
    if (data.body.length > 4000) {
      throw new WsException('Message body too long');
    }

    const message = await this.messagesService.sendMessage(
      client.userId,
      data.conversationId,
      data.body.trim(),
    );

    // Broadcast to all participants in the conversation room
    this.server
      .to(`conversation:${data.conversationId}`)
      .emit('new-message', message);

    return { event: 'message-sent', data: message };
  }

  /**
   * Mark all messages in a conversation as read.
   * Payload: { conversationId: string }
   */
  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');
    await this.messagesService.markRead(data.conversationId, client.userId);
    return { event: 'marked-read', data: { conversationId: data.conversationId } };
  }

  /**
   * Emit a new message to a conversation room — used by the HTTP controller
   * when a message is sent via REST (mobile offline clients, etc.).
   */
  emitToConversation(conversationId: string, message: unknown) {
    this.server.to(`conversation:${conversationId}`).emit('new-message', message);
  }

  /**
   * Emit a notification to a specific user's room.
   */
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
