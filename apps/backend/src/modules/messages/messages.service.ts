import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import {
  conversations,
  conversationParticipants,
  messages,
  users,
  userBlocks,
} from '../../database/schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getOrCreateConversation(requesterId: string, participantId: string): Promise<{ id: string }> {
    if (requesterId === participantId) {
      throw new ForbiddenException('Cannot create a conversation with yourself');
    }

    // Check both users exist
    const [participant] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, participantId))
      .limit(1);

    if (!participant) {
      throw new NotFoundException('User not found');
    }

    // Look for an existing 1:1 conversation between these two users
    const existing = await this.db.execute(
      sql`
        SELECT cp1.conversation_id as id
        FROM conversation_participants cp1
        INNER JOIN conversation_participants cp2
          ON cp1.conversation_id = cp2.conversation_id
          AND cp2.user_id = ${participantId}
        WHERE cp1.user_id = ${requesterId}
        LIMIT 1
      `,
    );

    const existingRows = Array.from(existing);
    if (existingRows.length > 0) {
      return { id: existingRows[0].id as string };
    }

    // Create a new conversation
    const [convo] = await this.db
      .insert(conversations)
      .values({ status: 'active' })
      .returning();

    await this.db.insert(conversationParticipants).values([
      { conversationId: convo.id, userId: requesterId },
      { conversationId: convo.id, userId: participantId },
    ]);

    this.logger.log(`Created conversation ${convo.id} between ${requesterId} and ${participantId}`);
    return { id: convo.id };
  }

  async listConversations(userId: string, search?: string) {
    const rows = await this.db.execute(
      sql`
        SELECT
          c.id,
          c.status,
          c.created_at AS "createdAt",
          c.updated_at AS "updatedAt",
          (
            SELECT json_build_object(
              'id', m.id,
              'body', m.body,
              'senderId', m.sender_id,
              'createdAt', m.created_at
            )
            FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) AS "lastMessage",
          (
            SELECT COUNT(*)::int
            FROM messages m2
            WHERE m2.conversation_id = c.id
              AND m2.sender_id != ${userId}
              AND m2.is_read = false
          ) AS "unreadCount",
          (
            SELECT json_build_object(
              'id', u.id,
              'firstName', u.first_name,
              'lastName', u.last_name,
              'avatarUrl', u.avatar_url
            )
            FROM conversation_participants cp2
            INNER JOIN users u ON u.id = cp2.user_id
            WHERE cp2.conversation_id = c.id
              AND cp2.user_id != ${userId}
            LIMIT 1
          ) AS "otherParticipant"
        FROM conversations c
        INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
        WHERE cp.user_id = ${userId}
          AND c.status = 'active'
        ORDER BY c.updated_at DESC
      `,
    );

    let results = Array.from(rows) as any[];

    if (search && search.trim().length >= 2) {
      const term = search.trim().toLowerCase();
      results = results.filter((row) => {
        const other = row.otherParticipant as { firstName?: string; lastName?: string } | null;
        if (other) {
          const fullName = `${other.firstName ?? ''} ${other.lastName ?? ''}`.toLowerCase();
          if (fullName.includes(term)) return true;
        }
        const lastMsg = row.lastMessage as { body?: string } | null;
        if (lastMsg?.body?.toLowerCase().includes(term)) return true;
        return false;
      });
    }

    return results;
  }

  async listMessages(
    conversationId: string,
    userId: string,
    limit: number,
    offset: number,
  ) {
    await this.assertParticipant(conversationId, userId);

    const rows = await this.db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        body: messages.body,
        isRead: messages.isRead,
        readAt: messages.readAt,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    return rows;
  }

  async sendMessage(senderId: string, conversationId: string, body: string) {
    await this.assertParticipant(conversationId, senderId);

    // Find other participant
    const otherParticipants = await this.db
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          sql`${conversationParticipants.userId} != ${senderId}`,
        ),
      )
      .limit(1);

    const otherParticipantId = otherParticipants[0]?.userId;

    // Block check — has either party blocked the other?
    if (otherParticipantId) {
      const [block] = await this.db
        .select({ id: userBlocks.id })
        .from(userBlocks)
        .where(
          or(
            and(eq(userBlocks.blockerId, senderId), eq(userBlocks.blockedId, otherParticipantId)),
            and(eq(userBlocks.blockerId, otherParticipantId), eq(userBlocks.blockedId, senderId)),
          ),
        )
        .limit(1);

      if (block) {
        throw new ForbiddenException('BLOCKED');
      }
    }

    const [message] = await this.db
      .insert(messages)
      .values({ conversationId, senderId, body })
      .returning();

    // Bump conversation updatedAt so ordering is maintained
    await this.db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    // Push notification to the other participant
    if (otherParticipantId) {
      const [sender] = await this.db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, senderId))
        .limit(1);

      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';
      const truncatedBody = body.length > 100 ? body.slice(0, 97) + '…' : body;

      void this.notificationsService.sendPush(otherParticipantId, {
        title: senderName,
        body: truncatedBody,
        data: { type: 'new_message', conversationId },
      });
    }

    this.logger.debug(`Message ${message.id} sent in conversation ${conversationId}`);
    return message;
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.assertParticipant(conversationId, userId);

    await this.db
      .update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.isRead, false),
        ),
      );

    await this.db
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      );
  }

  async archiveConversation(conversationId: string, userId: string): Promise<void> {
    await this.assertParticipant(conversationId, userId);

    await this.db
      .update(conversations)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  async assertParticipant(conversationId: string, userId: string): Promise<void> {
    const [participant] = await this.db
      .select({ id: conversationParticipants.id })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      )
      .limit(1);

    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }
  }
}
