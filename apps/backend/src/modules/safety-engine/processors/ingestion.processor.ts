import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SafetyEngineService, INGESTION_QUEUE } from '../safety-engine.service';
import { UkPoliceAdapter } from '../adapters/uk-police.adapter';
import { EurostatAdapter } from '../adapters/eurostat.adapter';
import { FbiAdapter } from '../adapters/fbi.adapter';

@Processor(INGESTION_QUEUE)
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly safetyEngineService: SafetyEngineService,
    private readonly ukPoliceAdapter: UkPoliceAdapter,
    private readonly eurostatAdapter: EurostatAdapter,
    private readonly fbiAdapter: FbiAdapter,
  ) {
    super();
  }

  async process(job: Job<{ source: string }>): Promise<void> {
    const { source } = job.data;
    this.logger.log(`Processing ingestion job for source: ${source}`);

    const adapter = this.getAdapter(source);
    if (!adapter) {
      this.logger.warn(`No adapter found for source: ${source}`);
      return;
    }

    await this.safetyEngineService.ingestFromAdapter(adapter);
  }

  private getAdapter(source: string) {
    switch (source) {
      case 'uk_police': return this.ukPoliceAdapter;
      case 'eurostat': return this.eurostatAdapter;
      case 'fbi': return this.fbiAdapter;
      default: return null;
    }
  }
}
