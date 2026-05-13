import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('JWT')
@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  /**
   * GET /api/v1/messages/conversations
   * List all conversations for the authenticated user. Supports ?search= query.
   */
  @Get('conversations')
  async listConversations(
    @CurrentUser() user: { id: string },
    @Query('search') search?: string,
  ) {
    return this.messagesService.listConversations(user.id, search);
  }

  /**
   * POST /api/v1/messages/conversations
   * Get or create a 1:1 conversation with another user.
   */
  @Post('conversations')
  async getOrCreateConversation(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagesService.getOrCreateConversation(user.id, dto.participantId);
  }

  /**
   * GET /api/v1/messages/conversations/:conversationId/messages
   * Paginated message history for a conversation.
   */
  @Get('conversations/:conversationId/messages')
  async listMessages(
    @CurrentUser() user: { id: string },
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() dto: ListMessagesDto,
  ) {
    return this.messagesService.listMessages(
      conversationId,
      user.id,
      dto.limit ?? 50,
      dto.offset ?? 0,
    );
  }

  /**
   * POST /api/v1/messages
   * Send a message (REST fallback — also emits via WebSocket).
   */
  @Post()
  async sendMessage(
    @CurrentUser() user: { id: string },
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.messagesService.sendMessage(
      user.id,
      dto.conversationId,
      dto.body,
    );
    // Also push via WebSocket for participants already connected
    this.messagesGateway.emitToConversation(dto.conversationId, message);
    return message;
  }

  /**
   * PATCH /api/v1/messages/conversations/:conversationId/read
   * Mark all messages in a conversation as read.
   */
  @Patch('conversations/:conversationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @CurrentUser() user: { id: string },
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    await this.messagesService.markRead(conversationId, user.id);
  }

  /**
   * DELETE /api/v1/messages/conversations/:conversationId
   * Archive (soft-delete) a conversation.
   */
  @Delete('conversations/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiveConversation(
    @CurrentUser() user: { id: string },
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    await this.messagesService.archiveConversation(conversationId, user.id);
  }
}
