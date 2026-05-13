import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { SafetyEngineService, INGESTION_QUEUE } from './safety-engine.service';
import { IngestionProcessor } from './processors/ingestion.processor';
import { ScheduleIngestionJob } from './jobs/schedule-ingestion';
import { PinAggregationJob } from './jobs/pin-aggregation.job';
import { ZoneScorer } from './scoring/zone-scorer';
import { UkPoliceAdapter } from './adapters/uk-police.adapter';
import { EurostatAdapter } from './adapters/eurostat.adapter';
import { FbiAdapter } from './adapters/fbi.adapter';
import { TravelAdvisoryAdapter } from './adapters/travel-advisory.adapter';

@Module({
  imports: [
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
    ScheduleModule.forRoot(),
  ],
  providers: [
    SafetyEngineService,
    IngestionProcessor,
    ScheduleIngestionJob,
    PinAggregationJob,
    ZoneScorer,
    UkPoliceAdapter,
    EurostatAdapter,
    FbiAdapter,
    TravelAdvisoryAdapter,
  ],
  exports: [SafetyEngineService, ZoneScorer],
})
export class SafetyEngineModule {}
