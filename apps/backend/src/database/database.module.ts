import { Module, Global, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('Database');
        const connectionString = configService.get<string>(
          'DATABASE_URL',
          'postgresql://safetag:safetag_dev@localhost:5432/safetag_dev',
        );

        // Supabase pooler (PgBouncer): disable prepared statements — required for Transaction mode;
        // safe for Session pooler URLs that use the same host pattern.
        const supabasePooler = /pooler\.supabase\.com/i.test(connectionString);

        const client = postgres(connectionString, {
          ...(supabasePooler ? { prepare: false } : {}),
        });
        const db = drizzle(client, { schema });

        logger.log('Database connection established');
        return db;
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnModuleDestroy {
  async onModuleDestroy() {
    // Connection cleanup handled by postgres.js
  }
}

export type DrizzleDB = PostgresJsDatabase<typeof schema>;
