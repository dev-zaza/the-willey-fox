import { Logger } from '@nestjs/common';
import type { DrizzleDB } from '../../../database/database.module';
import { pipelineLogs } from '../../../database/schema';

const logger = new Logger('pipelineLog');

export interface PipelineRunInput {
  source: string;
  recordsFetched: number;
  recordsInserted: number;
  errors?: string | null;
}

function isDryRun(): boolean {
  return process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
}

export async function logPipelineRun(
  db: DrizzleDB,
  input: PipelineRunInput,
): Promise<void> {
  const payload = {
    source: input.source,
    recordsFetched: input.recordsFetched ?? 0,
    recordsInserted: input.recordsInserted ?? 0,
    errors: input.errors ? String(input.errors).slice(0, 8000) : null,
  };

  if (isDryRun()) {
    logger.debug(`[dry-run] pipeline_logs ← ${JSON.stringify(payload)}`);
    return;
  }

  try {
    await db.insert(pipelineLogs).values(payload);
  } catch (err) {
    logger.error(`Failed to write pipeline_logs row: ${(err as Error).message}`);
  }
}
