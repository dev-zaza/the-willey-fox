/**
 * Idempotent admin user for the web admin panel (/dashboard/admin).
 * Run: pnpm --filter @safetag/backend db:seed-admin
 *
 * Configure ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD (and optional names) in safetag/.env.
 * If the email already exists, updates isAdmin, password (bcrypt), and verifies email.
 */
import { resolve } from 'path';
import { config } from 'dotenv';
import bcrypt from 'bcrypt';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { users } from '../database/schema/users.schema';

const BCRYPT_ROUNDS = 12;

// Monorepo root (safetag/.env) then backend overrides (apps/backend/.env)
config({ path: resolve(__dirname, '../../../../.env') });
config({ path: resolve(__dirname, '../../.env') });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error('DATABASE_URL is required (e.g. in safetag/.env)');
  }

  const email = (process.env.ADMIN_SEED_EMAIL ?? 'admin@localhost.dev').toLowerCase().trim();
  const password = process.env.ADMIN_SEED_PASSWORD ?? 'ChangeMeAdmin123!';
  const firstName = (process.env.ADMIN_SEED_FIRST_NAME ?? 'Admin').trim() || 'Admin';
  const lastName = (process.env.ADMIN_SEED_LAST_NAME ?? 'User').trim() || 'User';

  if (password.length < 8) {
    throw new Error('ADMIN_SEED_PASSWORD must be at least 8 characters');
  }

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema: { users } });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        firstName,
        lastName,
        passwordHash,
        isAdmin: true,
        isVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    // eslint-disable-next-line no-console -- CLI script
    console.log(`[seed-admin] Updated user ${email} → admin (password reset to ADMIN_SEED_PASSWORD)`);
  } else {
    await db.insert(users).values({
      email,
      firstName,
      lastName,
      passwordHash,
      isAdmin: true,
      isVerified: true,
      subscriptionTier: 'enterprise',
    });
    // eslint-disable-next-line no-console -- CLI script
    console.log(`[seed-admin] Created admin user ${email}`);
  }

  await sql.end({ timeout: 5 });
  // eslint-disable-next-line no-console -- CLI script
  console.log('[seed-admin] Done. Sign in at the web app /login with this email and password.');
}

main().catch((err) => {
  console.error('[seed-admin]', err);
  process.exit(1);
});
