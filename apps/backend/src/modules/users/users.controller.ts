import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto, UpdateLocationDto, ReportUserDto, VerifyPhoneOtpDto } from './dto';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { Express } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

@ApiBearerAuth('JWT')
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Get('search')
  searchUsers(@Query('q') q: string) {
    return this.usersService.search(q ?? '');
  }

  @Put('me')
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('FILE_REQUIRED');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('INVALID_FILE_TYPE');
    }
    return this.usersService.uploadAvatar(user.id, file.buffer);
  }

  @Post('me/location')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.usersService.updateLocation(user.id, dto);
  }

  @Get('blocked')
  listBlocked(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listBlocked(user.id);
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.CREATED)
  blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.blockUser(user.id, id);
  }

  @Delete(':id/block')
  @HttpCode(HttpStatus.OK)
  unblockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.unblockUser(user.id, id);
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.CREATED)
  reportUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportUserDto,
  ) {
    return this.usersService.reportUser(user.id, id, dto);
  }

  @Post('me/phone/send-otp')
  @HttpCode(HttpStatus.OK)
  sendPhoneOtp(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.sendPhoneOtp(user.id);
  }

  @Post('me/phone/verify')
  @HttpCode(HttpStatus.OK)
  verifyPhoneOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyPhoneOtpDto,
  ) {
    return this.usersService.verifyPhoneOtp(user.id, dto);
  }

  @Public()
  @Get(':id')
  getPublicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
