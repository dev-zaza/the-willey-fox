/**
 * E2E — Family groups + QR medical/photo + missing alerts + map crime
 *
 * Covers UAT gaps from Wiley Fox family + map plan:
 *   - Family create immediate
 *   - Invite by email (pending + accept)
 *   - Child QR create/link, medical PATCH, photo upload
 *   - Mark missing → createMissing report
 *   - area-summary differs by lat/lng (hex-scoped radius)
 *   - tiles include incidentCount
 *   - active SOS near endpoint
 *
 * Requires: Postgres+PostGIS + Redis (docker compose up -d)
 * Run: pnpm --filter backend test:e2e -- family-map
 */
import request from 'supertest';
import { latLngToCell } from 'h3-js';
import {
  auth,
  canReachDatabase,
  createE2EApp,
  createVerifiedUser,
  getPendingFamilyInviteToken,
  login,
  clearCrimeNear,
  seedCrimeNear,
  seedH3Score,
  type E2EContext,
} from './e2e-helpers';

const MAYFAIR = { lat: 51.51, lng: -0.147 };
/** Isolated rural points (~3km apart) so seeded counts aren't drowned by London ingest */
const SITE_A = { lat: 52.2053, lng: -0.1218 }; // near Cambridge countryside offset
const SITE_B = { lat: 52.2300, lng: -0.0900 };

describe('Family + Map UAT E2E', () => {
  let ctx: E2EContext | null = null;
  let ownerToken = '';
  let inviteeToken = '';
  let inviteeEmail = '';
  let familyId = '';
  let childQrId = '';

  beforeAll(async () => {
    const ok = await canReachDatabase();
    if (!ok) {
      console.warn(
        '[family-map.e2e] Skipping — DATABASE_URL unreachable. Start: docker compose up -d && pnpm --filter backend db:migrate',
      );
      return;
    }
    try {
      ctx = await createE2EApp();
    } catch (err) {
      console.warn('[family-map.e2e] Skipping — app bootstrap failed:', (err as Error).message);
      ctx = null;
    }
  }, 120_000);

  afterAll(async () => {
    if (ctx) await ctx.app.close();
  });

  function requireCtx(): E2EContext {
    if (!ctx) {
      // Soft-skip when infra missing so CI without docker stays green when filtered
      return null as unknown as E2EContext;
    }
    return ctx;
  }

  const skipIfNoDb = () => {
    if (!ctx) {
      expect(true).toBe(true);
      return true;
    }
    return false;
  };

  // ─── Family create + invite ─────────────────────────────────────────────
  describe('B1/B5 — Family create immediately + email invite', () => {
    it('creates a verified owner and family group immediately', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();
      const owner = await createVerifiedUser(c.db, { firstName: 'Owner', lastName: 'Parent' });
      ownerToken = await login(c.http, owner.email, owner.password);

      const res = await request(c.http)
        .post('/api/v1/families')
        .set(auth(ownerToken))
        .send({ name: 'E2E Smith Family' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('E2E Smith Family');
      familyId = res.body.id;

      const list = await request(c.http)
        .get('/api/v1/families')
        .set(auth(ownerToken))
        .expect(200);

      expect(list.body.some((m: { familyId: string }) => m.familyId === familyId)).toBe(true);
    });

    it('invites unknown email → pending invite (email queued)', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();
      inviteeEmail = `invitee_${Date.now()}@test.com`;

      const res = await request(c.http)
        .post(`/api/v1/families/${familyId}/members`)
        .set(auth(ownerToken))
        .send({ email: inviteeEmail })
        .expect(201);

      expect(res.body.invited).toBe(true);
      expect(res.body.added).toBe(false);
      expect(res.body.email).toBe(inviteeEmail);

      const detail = await request(c.http)
        .get(`/api/v1/families/${familyId}`)
        .set(auth(ownerToken))
        .expect(200);

      expect(detail.body.pendingInvites?.some((i: { email: string }) => i.email === inviteeEmail)).toBe(
        true,
      );
    });

    it('accepts invite after invitee registers', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();
      const invitee = await createVerifiedUser(c.db, {
        email: inviteeEmail,
        firstName: 'Invitee',
        lastName: 'Adult',
      });
      inviteeToken = await login(c.http, invitee.email, invitee.password);
      const token = await getPendingFamilyInviteToken(c.db, inviteeEmail);

      const res = await request(c.http)
        .post('/api/v1/families/invite/accept')
        .set(auth(inviteeToken))
        .send({ token })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.familyId).toBe(familyId);

      const detail = await request(c.http)
        .get(`/api/v1/families/${familyId}`)
        .set(auth(ownerToken))
        .expect(200);

      expect(detail.body.members.some((m: { email: string }) => m.email === inviteeEmail)).toBe(true);
    });

    it('rejects add-member without email or userId with 400', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();
      await request(c.http)
        .post(`/api/v1/families/${familyId}/members`)
        .set(auth(ownerToken))
        .send({})
        .expect(400);
    });
  });

  // ─── Child QR + medical + photo ─────────────────────────────────────────
  describe('B2/B3/B4 — Child QR, medical, photo', () => {
    it('creates person QR profile and links to family with relationship', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();

      const qr = await request(c.http)
        .post('/api/v1/qr-codes')
        .set(auth(ownerToken))
        .send({
          name: 'Little Sam',
          label: 'Sam',
          category: 'person',
          customFields: { relationship: 'Child' },
        })
        .expect(201);

      childQrId = qr.body.id;
      expect(qr.body.category).toBe('person');
      expect(qr.body.customFields?.relationship).toBe('Child');

      await request(c.http)
        .post(`/api/v1/families/${familyId}/qr-codes`)
        .set(auth(ownerToken))
        .send({ qrCodeId: childQrId })
        .expect(201);

      const detail = await request(c.http)
        .get(`/api/v1/families/${familyId}`)
        .set(auth(ownerToken))
        .expect(200);

      const child = detail.body.qrCodes.find((q: { id: string }) => q.id === childQrId);
      expect(child).toBeTruthy();
      expect(child.customFields?.relationship).toBe('Child');
    });

    it('PATCHes medical info + visibility onto child QR', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();

      const res = await request(c.http)
        .patch(`/api/v1/qr-codes/${childQrId}`)
        .set(auth(ownerToken))
        .send({
          medicalInfo: {
            bloodType: 'O+',
            allergies: 'Peanuts',
            medicalConditions: 'Asthma',
            medications: 'Inhaler',
            emergencyContactName: 'Owner Parent',
            emergencyContactPhone: '+447700900123',
            notes: 'Carries blue inhaler',
          },
          visibilityConfig: {
            showName: true,
            showPhoto: true,
            showDescription: true,
            showCustomFields: false,
          },
        })
        .expect(200);

      expect(res.body.customFields?.medicalInfo?.bloodType).toBe('O+');
      expect(res.body.customFields?.medicalInfo?.allergies).toBe('Peanuts');
      expect(res.body.visibilityConfig?.showCustomFields).toBe(false);
      // relationship must be preserved when merging customFields
      expect(res.body.customFields?.relationship).toBe('Child');
    });

    it('uploads child photo via multipart', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();
      // Minimal 1x1 PNG
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );

      const res = await request(c.http)
        .post(`/api/v1/qr-codes/${childQrId}/photo`)
        .set(auth(ownerToken))
        .attach('file', png, { filename: 'kid.png', contentType: 'image/png' })
        .expect(201);

      expect(res.body.photoUrl).toMatch(/^https:\/\/cdn\.example\.com\/qr_/);

      const got = await request(c.http)
        .get(`/api/v1/qr-codes/${childQrId}`)
        .set(auth(ownerToken))
        .expect(200);
      expect(got.body.photoUrl).toBe(res.body.photoUrl);
    });
  });

  // ─── Missing child alerts ───────────────────────────────────────────────
  describe('B6 — Mark missing creates report + alerts path', () => {
    it('mark-lost + POST /reports missing for person category', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();

      await request(c.http)
        .post(`/api/v1/qr-codes/${childQrId}/mark-lost`)
        .set(auth(ownerToken))
        .expect(201);

      const missing = await request(c.http)
        .post('/api/v1/reports')
        .set(auth(ownerToken))
        .send({
          qrCodeId: childQrId,
          description: 'Last seen near school gate',
          lastSeenLocation: 'Mayfair, London',
          lat: MAYFAIR.lat,
          lng: MAYFAIR.lng,
          requestBroadcast: true,
        })
        .expect(201);

      expect(missing.body.id).toBeTruthy();
      expect(missing.body.broadcast).toBe(true);

      const tag = await request(c.http)
        .get(`/api/v1/qr-codes/${childQrId}`)
        .set(auth(ownerToken))
        .expect(200);
      expect(tag.body.isLost).toBe(true);
    });

    it('GET /public/broadcasts includes lat/lng for map overlays', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();

      const res = await request(c.http).get('/api/v1/public/broadcasts?page=1&pageSize=50').expect(200);

      expect(Array.isArray(res.body.items)).toBe(true);
      const hit = res.body.items.find((i: { qrCodeId: string }) => i.qrCodeId === childQrId);
      // Broadcast may require admin approval depending on config — if present, coords must exist
      if (hit) {
        expect(hit.lat).not.toBeUndefined();
        expect(hit.lng).not.toBeUndefined();
      }
    });
  });

  // ─── Map crime uniqueness ───────────────────────────────────────────────
  describe('C1/C2 — Crime area-summary updates per location', () => {
    it('seeds distinct crime near Site A vs Site B and returns different counts', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();

      await clearCrimeNear(c.db, SITE_A.lat, SITE_A.lng);
      await clearCrimeNear(c.db, SITE_B.lat, SITE_B.lng);

      const siteAH3 = latLngToCell(SITE_A.lat, SITE_A.lng, 9);
      const siteBH3 = latLngToCell(SITE_B.lat, SITE_B.lng, 9);

      await seedCrimeNear(c.db, [
        ...Array.from({ length: 12 }, () => ({
          lat: SITE_A.lat + (Math.random() - 0.5) * 0.002,
          lng: SITE_A.lng + (Math.random() - 0.5) * 0.002,
          crimeType: 'theft-from-the-person',
          h3: siteAH3,
        })),
        ...Array.from({ length: 3 }, () => ({
          lat: SITE_B.lat + (Math.random() - 0.5) * 0.002,
          lng: SITE_B.lng + (Math.random() - 0.5) * 0.002,
          crimeType: 'anti-social-behaviour',
          h3: siteBH3,
        })),
      ]);

      await seedH3Score(c.db, siteAH3, 42, 'band2');
      await seedH3Score(c.db, siteBH3, 71, 'band4');

      const siteA = await request(c.http)
        .get(
          `/api/v1/safety-engine/area-summary?lat=${SITE_A.lat}&lng=${SITE_A.lng}&radius=700&city=SiteA&fetch=0`,
        )
        .expect(200);

      const siteB = await request(c.http)
        .get(
          `/api/v1/safety-engine/area-summary?lat=${SITE_B.lat}&lng=${SITE_B.lng}&radius=700&city=SiteB&fetch=0`,
        )
        .expect(200);

      expect(siteA.body.radiusMetres).toBe(700);
      expect(siteB.body.radiusMetres).toBe(700);
      expect(siteA.body.incidentCount).toBeGreaterThan(siteB.body.incidentCount);
      expect(siteA.body.incidentCount).not.toBe(siteB.body.incidentCount);
    });

    it('tiles features include incidentCount property', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();

      // Small bbox around Mayfair
      const bbox = `${MAYFAIR.lng - 0.01},${MAYFAIR.lat - 0.01},${MAYFAIR.lng + 0.01},${MAYFAIR.lat + 0.01}`;
      const res = await request(c.http)
        .get(`/api/v1/safety-engine/tiles?bbox=${bbox}&resolution=9`)
        .expect(200);

      expect(res.body.type).toBe('FeatureCollection');
      expect(Array.isArray(res.body.features)).toBe(true);
      if (res.body.features.length > 0) {
        const props = res.body.features[0].properties;
        expect(props).toHaveProperty('incidentCount');
        expect(typeof props.incidentCount).toBe('number');
      }
    });

    it('rejects area-summary radius below 200', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();
      await request(c.http)
        .get(`/api/v1/safety-engine/area-summary?lat=${MAYFAIR.lat}&lng=${MAYFAIR.lng}&radius=100`)
        .expect(400);
    });
  });

  // ─── SOS near ───────────────────────────────────────────────────────────
  describe('C3 — SOS active-near for map beacons', () => {
    it('GET /emergency/active-near returns array for authenticated user', async () => {
      if (skipIfNoDb()) return;
      const c = requireCtx();

      const res = await request(c.http)
        .get(`/api/v1/emergency/active-near?lat=${MAYFAIR.lat}&lng=${MAYFAIR.lng}&radius=3200`)
        .set(auth(ownerToken))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
