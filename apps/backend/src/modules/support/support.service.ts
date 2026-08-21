import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { supportTickets } from '../../database/schema';
import { eq, desc, count } from 'drizzle-orm';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSupportTicketDto, UpdateSupportTicketDto } from './dto';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async createTicket(dto: CreateSupportTicketDto, userId?: string | null) {
    const [ticket] = await this.db
      .insert(supportTickets)
      .values({
        userId: userId ?? null,
        name: dto.name,
        email: dto.email,
        subject: dto.subject,
        message: dto.message,
      })
      .returning();

    this.logger.log(`New support ticket ${ticket.id} from ${ticket.email}`);

    const notifyEmail = this.configService.get<string>('SUPPORT_NOTIFY_EMAIL')
      ?? this.configService.get<string>('SMTP_USER');
    if (notifyEmail) {
      this.notificationsService
        .sendRawEmail(
          notifyEmail,
          `New support ticket: ${ticket.subject}`,
          `From: ${ticket.name} <${ticket.email}>\n\n${ticket.message}`,
        )
        .catch((err) => this.logger.error(`Failed to send support notification for ticket ${ticket.id}`, err));
    }

    this.notificationsService
      .sendRawEmail(
        ticket.email,
        `We received your message: ${ticket.subject}`,
        `Hi ${ticket.name},\n\nThanks for reaching out to TheWileyfox support. We've received your message and will get back to you shortly.\n\nYour message:\n${ticket.message}`,
        userId ?? null,
      )
      .catch((err) => this.logger.error(`Failed to send support confirmation for ticket ${ticket.id}`, err));

    return ticket;
  }

  async findByUser(userId: string) {
    return this.db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async listAll(limit = 50, offset = 0, status?: string) {
    const conditions = status ? eq(supportTickets.status, status as typeof supportTickets.status.enumValues[number]) : undefined;
    const rows = await this.db
      .select()
      .from(supportTickets)
      .where(conditions)
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ value: total }] = await this.db
      .select({ value: count() })
      .from(supportTickets)
      .where(conditions);
    return { rows, total };
  }

  async updateStatus(id: string, adminId: string, dto: UpdateSupportTicketDto) {
    const [existing] = await this.db
      .select({ id: supportTickets.id, email: supportTickets.email, subject: supportTickets.subject, name: supportTickets.name })
      .from(supportTickets)
      .where(eq(supportTickets.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('SUPPORT_TICKET_NOT_FOUND');
    }

    const [updated] = await this.db
      .update(supportTickets)
      .set({
        ...(dto.status ? { status: dto.status as typeof supportTickets.status.enumValues[number] } : {}),
        ...(dto.adminReply ? { adminReply: dto.adminReply, repliedAt: new Date(), repliedByAdminId: adminId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, id))
      .returning();

    if (dto.adminReply) {
      this.notificationsService
        .sendRawEmail(
          existing.email,
          `Re: ${existing.subject}`,
          `Hi ${existing.name},\n\n${dto.adminReply}`,
        )
        .catch((err) => this.logger.error(`Failed to send support reply for ticket ${id}`, err));
    }

    return updated;
  }
}
