import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { SafetyEngineService, INGESTION_QUEUE } from './safety-engine.service';
import { IngestionProcessor } from './processors/ingestion.processor';
import { ScheduleIngestionJob } from './jobs/schedule-ingestion';
import { ZoneScorer } from './scoring/zone-scorer';
import { UkPoliceAdapter } from './adapters/uk-police.adapter';
import { EurostatAdapter } from './adapters/eurostat.adapter';
import { FbiAdapter } from './adapters/fbi.adapter';

@Module({
  imports: [
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
    ScheduleModule.forRoot(),
  ],
  providers: [
    SafetyEngineService,
    IngestionProcessor,
    ScheduleIngestionJob,
    ZoneScorer,
    UkPoliceAdapter,
    EurostatAdapter,
    FbiAdapter,
  ],
  exports: [SafetyEngineService, ZoneScorer],
})
export class SafetyEngineModule {}
