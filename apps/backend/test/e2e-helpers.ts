/**
 * Shared helpers for Nest HTTP e2e specs.
 * Requires Postgres (with PostGIS) + Redis matching DATABASE_URL / REDIS_*.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE, type DrizzleDB } from '../src/database/database.module';
import { users, crimeIncidents, familyInvites, h3SafetyScores } from '../src/database/schema';
import { CloudinaryService } from '../src/modules/users/cloudinary.service';
import { UkPoliceAdapter } from '../src/modules/safety-engine/adapters/uk-police.adapter';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';

export type E2EContext = {
  app: INestApplication;
  http: any;
  db: DrizzleDB;
};

export async function canReachDatabase(): Promise<boolean> {
  try {
    const postgres = (await import('postgres')).default;
    const url =
      process.env.DATABASE_URL ||
      'postgresql://safetag:safetag_dev@localhost:5433/safetag_dev';
    const client = postgres(url, { max: 1, connect_timeout: 3 });
    await client`select 1`;
    await client.end({ timeout: 2 });
    return true;
  } catch {
    return false;
  }
}

export async function createE2EApp(): Promise<E2EContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(CloudinaryService)
    .useValue({
      uploadAvatar: jest.fn(async () => 'https://cdn.example.com/avatar.jpg'),
      uploadReportPhoto: jest.fn(async () => 'https://cdn.example.com/report.jpg'),
      uploadQrPhoto: jest.fn(async (_buf: Buffer, qrId: string) => `https://cdn.example.com/qr_${qrId}.jpg`),
    })
    .overrideProvider(UkPoliceAdapter)
    .useValue({
      sourceName: 'uk_police',
      ingest: jest.fn(async () => []),
      fetchAndUpsertAt: jest.fn(async () => 0),
    })
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.setGlobalPrefix('api/v1');
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));
  await app.init();

  return {
    app,
    http: app.getHttpServer(),
    db: app.get(DRIZZLE),
  };
}

export async function createVerifiedUser(
  db: DrizzleDB,
  overrides: Partial<{ email: string; password: string; firstName: string; lastName: string }> = {},
): Promise<{ id: string; email: string; password: string }> {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = overrides.email ?? `e2e_${stamp}@test.com`;
  const password = overrides.password ?? 'E2eP@ssw0rd!';
  const passwordHash = await bcrypt.hash(password, 4);

  const [user] = await db
    .insert(users)
    .values({
      email,
      firstName: overrides.firstName ?? 'E2E',
      lastName: overrides.lastName ?? 'User',
      passwordHash,
      isVerified: true,
      verificationToken: null,
      verificationTokenExpiresAt: null,
    })
    .returning({ id: users.id, email: users.email });

  return { id: user.id, email: user.email, password };
}

export async function login(
  http: any,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(http)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  expect(res.body.accessToken).toBeTruthy();
  return res.body.accessToken as string;
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function seedCrimeNear(
  db: DrizzleDB,
  points: Array<{ lat: number; lng: number; crimeType: string; count?: number; h3?: string }>,
) {
  for (const [i, p] of points.entries()) {
    await db.insert(crimeIncidents).values({
      sourceCountry: 'GB',
      sourceApi: 'e2e_seed',
      sourceRecordId: `e2e_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      crimeType: p.crimeType,
      severityCategory: 'theft',
      incidentCount: p.count ?? 1,
      lat: p.lat,
      lng: p.lng,
      h3IndexR9: p.h3 ?? null,
      incidentDate: '2026-01-01',
    });
  }
}

export async function clearCrimeNear(
  db: DrizzleDB,
  lat: number,
  lng: number,
  radiusMetres = 1200,
) {
  // Approximate degree box (~111km per degree lat)
  const dLat = radiusMetres / 111_000;
  const dLng = radiusMetres / (111_000 * Math.cos((lat * Math.PI) / 180));
  await db.execute(sql`
    DELETE FROM crime_incidents
    WHERE lat BETWEEN ${lat - dLat} AND ${lat + dLat}
      AND lng BETWEEN ${lng - dLng} AND ${lng + dLng}
  `);
}

export async function seedH3Score(
  db: DrizzleDB,
  h3Index: string,
  score: number,
  band: string,
) {
  await db.execute(sql`
    INSERT INTO h3_safety_scores (h3_index, resolution, score, band, source_country, updated_at)
    VALUES (${h3Index}, 9, ${score}, ${band}, 'GB', NOW())
    ON CONFLICT DO NOTHING
  `).catch(async () => {
    // Schema variants — best-effort insert via drizzle table if present
    try {
      await db.insert(h3SafetyScores as any).values({
        h3Index,
        resolution: 9,
        score,
        band,
        sourceCountry: 'GB',
      });
    } catch {
      /* ignore if table shape differs */
    }
  });
}

export async function getPendingFamilyInviteToken(
  db: DrizzleDB,
  email: string,
): Promise<string> {
  const [row] = await db
    .select({ token: familyInvites.token })
    .from(familyInvites)
    .where(eq(familyInvites.email, email.toLowerCase()))
    .limit(1);
  if (!row?.token) throw new Error(`No pending family invite for ${email}`);
  return row.token;
}
