import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { SafetyEngineService, INGESTION_QUEUE } from './safety-engine.service';
import { SafetyEngineController } from './safety-engine.controller';
import { IngestionProcessor } from './processors/ingestion.processor';
import { ScheduleIngestionJob } from './jobs/schedule-ingestion';
import { PinAggregationJob } from './jobs/pin-aggregation.job';

// Scoring
import { ZoneScorer } from './scoring/zone-scorer';
import { H3Scorer } from './scoring/h3-scorer';

// Adapters (existing)
import { UkPoliceAdapter } from './adapters/uk-police.adapter';
import { EurostatAdapter } from './adapters/eurostat.adapter';
import { FbiAdapter } from './adapters/fbi.adapter';
import { TravelAdvisoryAdapter } from './adapters/travel-advisory.adapter';

// Connectors (new)
import { AustraliaAbsConnector } from './connectors/australia-abs.connector';
import { CanadaStatcanConnector } from './connectors/canada-statcan.connector';
import { MexicoHoyodecrimenConnector } from './connectors/mexico-hoyodecrimen.connector';
import { UnodcGlobalConnector } from './connectors/unodc-global.connector';
import { WorldbankGlobalConnector } from './connectors/worldbank-global.connector';
import { AcledConflictConnector } from './connectors/acled-conflict.connector';

// Scheduled ingestion jobs
import { IngestUkJob } from './jobs/ingest-uk.job';
import { IngestFbiJob } from './jobs/ingest-fbi.job';
import { IngestEurostatJob } from './jobs/ingest-eurostat.job';
import { IngestAustraliaJob } from './jobs/ingest-australia.job';
import { IngestCanadaJob } from './jobs/ingest-canada.job';
import { IngestMexicoJob } from './jobs/ingest-mexico.job';
import { IngestUnodcJob } from './jobs/ingest-unodc.job';
import { IngestWorldbankJob } from './jobs/ingest-worldbank.job';
import { IngestAcledJob } from './jobs/ingest-acled.job';
import { ScoreH3Job } from './jobs/score-h3.job';

@Module({
  imports: [
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
    ScheduleModule.forRoot(),
  ],
  controllers: [SafetyEngineController],
  providers: [
    // Core
    SafetyEngineService,
    IngestionProcessor,
    ScheduleIngestionJob,
    PinAggregationJob,

    // Scoring
    ZoneScorer,
    H3Scorer,

    // Adapters
    UkPoliceAdapter,
    EurostatAdapter,
    FbiAdapter,
    TravelAdvisoryAdapter,

    // Connectors
    AustraliaAbsConnector,
    CanadaStatcanConnector,
    MexicoHoyodecrimenConnector,
    UnodcGlobalConnector,
    WorldbankGlobalConnector,
    AcledConflictConnector,

    // Ingestion jobs
    IngestUkJob,
    IngestFbiJob,
    IngestEurostatJob,
    IngestAustraliaJob,
    IngestCanadaJob,
    IngestMexicoJob,
    IngestUnodcJob,
    IngestWorldbankJob,
    IngestAcledJob,
    ScoreH3Job,
  ],
  exports: [SafetyEngineService, ZoneScorer, H3Scorer],
})
export class SafetyEngineModule {}
