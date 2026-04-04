import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PinsService, PIN_EXPIRY_QUEUE } from '../pins.service';

@Processor(PIN_EXPIRY_QUEUE)
export class PinExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(PinExpiryProcessor.name);

  constructor(private readonly pinsService: PinsService) {
    super();
  }

  async process(job: Job<{ pinId: string }>): Promise<void> {
    const { pinId } = job.data;
    this.logger.debug(`Processing expiry for pin ${pinId}`);
    await this.pinsService.expirePin(pinId);
  }
}
