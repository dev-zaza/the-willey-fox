import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(configService: ConfigService) {
    cloudinary.config({
      cloud_name: configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadAvatar(buffer: Buffer, userId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: 'avatars',
            public_id: `user_${userId}`,
            overwrite: true,
            transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
          },
          (error: Error | undefined, result: UploadApiResponse | undefined) => {
            if (error) {
              this.logger.error(`Cloudinary upload failed: ${error.message}`);
              reject(new InternalServerErrorException('AVATAR_UPLOAD_FAILED'));
            } else {
              resolve(result!.secure_url);
            }
          },
        )
        .end(buffer);
    });
  }

  async uploadReportPhoto(buffer: Buffer, reportId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: 'report-photos',
            public_id: `report_${reportId}`,
            overwrite: true,
          },
          (error: Error | undefined, result: UploadApiResponse | undefined) => {
            if (error) {
              this.logger.error(`Cloudinary report photo upload failed: ${error.message}`);
              reject(new InternalServerErrorException('PHOTO_UPLOAD_FAILED'));
            } else {
              resolve(result!.secure_url);
            }
          },
        )
        .end(buffer);
    });
  }
}
