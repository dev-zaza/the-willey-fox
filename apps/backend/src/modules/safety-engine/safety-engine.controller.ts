import { BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { H3Scorer } from './scoring/h3-scorer';
import { Public } from '../../common/decorators/public.decorator';
import { ApiTags } from '@nestjs/swagger';
import { avg, count, eq, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { areaRatings } from '../../database/schema';
import { cellToBoundary, polygonToCells, latLngToCell } from 'h3-js';
import { colourFor } from './lib/bands';

interface CityGuide {
  city: string;
  region?: string;
  slug: string;
  tier?: number;
  lastUpdated?: string;
  videos?: Array<{
    videoId: string;
    title: string;
    channel: string;
    url: string;
    thumbnail?: string;
    viewCount?: number;
    duration?: string;
    knowledge?: Record<string, unknown>;
  }>;
}

interface CityKnowledge {
  city?: string;
  slug?: string;
  aggregated?: {
    topPlaces?: Array<{ place: string; mentionCount: number }>;
    safetyNotes?: string[];
    recommendations?: string[];
  };
}

const GUIDES_DIR = path.join(process.cwd(), 'src/assets/city-guides');
const KNOWLEDGE_DIR = path.join(process.cwd(), 'src/assets/city-knowledge');

class TravelGuideRenderDto {
  @IsString()
  @MinLength(2)
  city: string;
}

@ApiTags('safety-engine')
@Controller('safety-engine')
export class SafetyEngineController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly h3Scorer: H3Scorer,
  ) {}

  @Post('rescore')
  @HttpCode(202)
  async triggerRescore() {
    this.h3Scorer.scoreAll().catch(() => {});
    return { status: 'scoring started' };
  }

  @Get('rate')
  async getAreaRating(@Query('areaName') areaName: string) {
    if (!areaName?.trim()) throw new BadRequestException('areaName query param required');
    const [result] = await this.db
      .select({ avgRating: avg(areaRatings.rating), totalRatings: count() })
      .from(areaRatings)
      .where(eq(sql`lower(${areaRatings.areaName})`, areaName.trim().toLowerCase()));
    return {
      areaName: areaName.trim(),
      avgRating: result?.avgRating ? Math.round(Number(result.avgRating) * 10) / 10 : null,
      totalRatings: Number(result?.totalRatings ?? 0),
    };
  }

  @Post('rate')
  async submitAreaRating(
    @Body() body: { areaName: string; rating: number },
    @Req() req: { user?: { sub?: string } },
  ) {
    const { areaName, rating } = body;
    if (!areaName?.trim()) throw new BadRequestException('areaName required');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be integer 1–5');
    }
    const userId: string | null = req.user?.sub ?? null;
    await this.db.insert(areaRatings).values({
      areaName: areaName.trim(),
      rating,
      userId,
    });
    const [result] = await this.db
      .select({ avgRating: avg(areaRatings.rating), totalRatings: count() })
      .from(areaRatings)
      .where(eq(sql`lower(${areaRatings.areaName})`, areaName.trim().toLowerCase()));
    return {
      areaName: areaName.trim(),
      avgRating: Math.round(Number(result?.avgRating ?? rating) * 10) / 10,
      totalRatings: Number(result?.totalRatings ?? 1),
    };
  }

  @Public()
  @Get('tiles')
  async getSafetyTiles(
    @Query('bbox') bbox?: string,
    @Query('h3') h3Cells?: string,
    @Query('resolution') resolutionParam?: string,
    @Query('bands') bandsParam?: string,
    @Query('country') countryParam?: string,
  ) {
    const ALLOWED_RES = new Set([7, 9, 11]);
    const MAX_CELLS = 5000;
    const resolution = Number(resolutionParam) || 9;

    if (!ALLOWED_RES.has(resolution)) {
      throw new BadRequestException(`resolution must be one of 7, 9, 11`);
    }

    let cells: string[] = [];

    if (h3Cells) {
      cells = h3Cells.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_CELLS);
    } else if (bbox) {
      const parts = bbox.split(',').map(Number);
      if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
        throw new BadRequestException('bad bbox; want minLng,minLat,maxLng,maxLat');
      }
      const [a, b, c, d] = parts;
      const minLng = Math.min(a, c);
      const maxLng = Math.max(a, c);
      const minLat = Math.min(b, d);
      const maxLat = Math.max(b, d);
      const ring: [number, number][] = [
        [minLat, minLng], [minLat, maxLng],
        [maxLat, maxLng], [maxLat, minLng],
        [minLat, minLng],
      ];
      try {
        cells = polygonToCells([ring], resolution, false) as string[];
      } catch {
        cells = [];
      }
      if (!cells.length) {
        cells = [
          latLngToCell(minLat, minLng, resolution),
          latLngToCell(minLat, maxLng, resolution),
          latLngToCell(maxLat, minLng, resolution),
          latLngToCell(maxLat, maxLng, resolution),
        ];
      }
      cells = cells.slice(0, MAX_CELLS);
    } else {
      throw new BadRequestException('provide either ?bbox= or ?h3=');
    }

    if (!cells.length) {
      return { type: 'FeatureCollection', features: [] };
    }

    const bandFilter = bandsParam
      ? bandsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : null;
    const countryFilter = countryParam?.trim().toUpperCase() || null;

    let rows: Array<{ h3_index: string; resolution: number; score: number | null; band: string }>;
    try {
      const cellValues = sql.raw(cells.map((c) => `'${c.replace(/'/g, "''")}'`).join(','));
      const countryClause = countryFilter
        ? sql.raw(`AND source_country = '${countryFilter.replace(/'/g, "''")}'`)
        : sql.raw('');
      if (bandFilter?.length) {
        const bandValues = sql.raw(bandFilter.map((b) => `'${b.replace(/'/g, "''")}'`).join(','));
        rows = (await this.db.execute(
          sql`SELECT h3_index, resolution, score, band
              FROM h3_safety_scores
              WHERE resolution = ${resolution}
                AND h3_index IN (SELECT unnest(ARRAY[${cellValues}]))
                AND band IN (SELECT unnest(ARRAY[${bandValues}]))
                ${countryClause}`,
        )) as any[];
      } else {
        rows = (await this.db.execute(
          sql`SELECT h3_index, resolution, score, band
              FROM h3_safety_scores
              WHERE resolution = ${resolution}
                AND h3_index IN (SELECT unnest(ARRAY[${cellValues}]))
                ${countryClause}`,
        )) as any[];
      }
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const features = rows.map((row) => {
      const boundary = cellToBoundary(row.h3_index, true) as [number, number][];
      const ring = [...boundary, boundary[0]];
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: {
          h3: row.h3_index,
          resolution: row.resolution,
          score: row.score != null ? Number(row.score) : null,
          band: row.band,
          color: colourFor(row.band),
        },
      };
    });

    return { type: 'FeatureCollection', features };
  }

  @Public()
  @Get('travel-guide/:citySlug')
  getTravelGuide(@Param('citySlug') citySlug: string) {
    const normalized = citySlug.toLowerCase().replace(/-/g, '_');

    // Load city guide (video-based)
    let guide: CityGuide | null = null;
    const guidePath = path.join(GUIDES_DIR, `${normalized}.json`);
    if (fs.existsSync(guidePath)) {
      try {
        guide = JSON.parse(fs.readFileSync(guidePath, 'utf-8')) as CityGuide;
      } catch {
        // ignore parse errors
      }
    }

    // Load city knowledge (aggregated insights)
    let knowledge: CityKnowledge | null = null;
    const knowledgePath = path.join(KNOWLEDGE_DIR, `${normalized}.json`);
    if (fs.existsSync(knowledgePath)) {
      try {
        knowledge = JSON.parse(fs.readFileSync(knowledgePath, 'utf-8')) as CityKnowledge;
      } catch {
        // ignore parse errors
      }
    }

    if (!guide && !knowledge) {
      throw new NotFoundException(`No travel guide available for "${citySlug}"`);
    }

    const cityName = guide?.city ?? knowledge?.city ?? citySlug;
    const region = guide?.region ?? null;

    // Extract top highlights from guide videos
    const highlights: Array<{ title: string; channel: string; url: string; thumbnail?: string; viewCount?: number }> = [];
    if (guide?.videos) {
      for (const v of guide.videos.slice(0, 8)) {
        highlights.push({
          title: v.title,
          channel: v.channel,
          url: v.url,
          thumbnail: v.thumbnail,
          viewCount: v.viewCount,
        });
      }
    }

    // Extract safety tips from knowledge aggregated data
    const safetyTips: string[] = [];
    const topPlaces: Array<{ place: string; mentionCount: number }> = [];
    const recommendations: string[] = [];

    if (knowledge?.aggregated) {
      const agg = knowledge.aggregated;

      if (Array.isArray(agg.safetyNotes)) {
        // safetyNotes may be raw strings; take first 5 unique short ones
        for (const note of agg.safetyNotes.slice(0, 5)) {
          if (typeof note === 'string' && note.length < 300) {
            safetyTips.push(note);
          }
        }
      }

      if (Array.isArray(agg.topPlaces)) {
        for (const p of agg.topPlaces.slice(0, 10)) {
          if (p && typeof p === 'object' && 'place' in p) {
            topPlaces.push({ place: String(p.place), mentionCount: Number(p.mentionCount ?? 0) });
          }
        }
      }

      if (Array.isArray(agg.recommendations)) {
        for (const r of agg.recommendations.slice(0, 5)) {
          if (typeof r === 'string' && r.length < 250) {
            recommendations.push(r);
          }
        }
      }
    }

    return {
      slug: normalized,
      city: cityName,
      region,
      lastUpdated: guide?.lastUpdated ?? null,
      videoCount: guide?.videos?.length ?? 0,
      highlights,
      safetyTips,
      topPlaces,
      recommendations,
    };
  }

  @Public()
  @Get('area-summary')
  async getAreaSummary(
    @Query('lat') latStr?: string,
    @Query('lng') lngStr?: string,
    @Query('radius') radiusStr?: string,
    @Query('city') cityParam?: string,
  ) {
    const lat = Number(latStr);
    const lng = Number(lngStr);
    const radiusMetres = Number(radiusStr) || 5000;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('lat and lng query params required');
    }
    if (radiusMetres < 500 || radiusMetres > 50000) {
      throw new BadRequestException('radius must be 500–50000 metres');
    }

    // Approximate degree delta for the radius (1° ≈ 111km)
    const delta = radiusMetres / 111000;
    const minLat = lat - delta;
    const maxLat = lat + delta;
    const minLng = lng - delta;
    const maxLng = lng + delta;

    // Crime breakdown by type within bounding box
    const crimeRows = (await this.db.execute(sql`
      SELECT crime_type, SUM(incident_count)::int AS total
      FROM crime_incidents
      WHERE lat BETWEEN ${minLat} AND ${maxLat}
        AND lng BETWEEN ${minLng} AND ${maxLng}
      GROUP BY crime_type
      ORDER BY total DESC
      LIMIT 20
    `)) as Array<{ crime_type: string; total: number }>;

    const totalIncidents = crimeRows.reduce((s, r) => s + Number(r.total), 0);
    const crimeBreakdown = crimeRows.map((r) => ({
      type: r.crime_type,
      count: Number(r.total),
    }));

    // Nearest H3 score at resolution 9 (neighbourhood level)
    const { latLngToCell } = await import('h3-js');
    const h3Cell = latLngToCell(lat, lng, 9);
    const scoreRows = (await this.db.execute(sql`
      SELECT score, band, source_country
      FROM h3_safety_scores
      WHERE h3_index = ${h3Cell} AND resolution = 9
      LIMIT 1
    `)) as Array<{ score: string | null; band: string | null; source_country: string }>;

    const rawScore = scoreRows[0]?.score != null ? Number(scoreRows[0].score) : null;
    const band = scoreRows[0]?.band ?? null;
    const countryIso = scoreRows[0]?.source_country ?? 'GB';
    const cityName = cityParam?.trim() ?? '';

    // Blend with Numbeo if we have a police score
    const blendedScore = rawScore != null
      ? this.h3Scorer.blendWithNumbeo(rawScore, cityName, countryIso)
      : null;

    // Area in km² for weighted/km² metric
    const radiusKm = radiusMetres / 1000;
    const areaKm2 = Math.PI * radiusKm * radiusKm;
    const weightedPerKm2 = totalIncidents > 0 ? Math.round((totalIncidents / areaKm2) * 10) / 10 : 0;

    return {
      lat,
      lng,
      radiusMetres,
      cityName,
      score: blendedScore,
      rawPoliceScore: rawScore,
      band,
      incidentCount: totalIncidents,
      weightedPerKm2,
      crimeBreakdown,
      dataMonth: new Date().toISOString().slice(0, 7),
      scoreMethodology: '70% live police data · 30% Numbeo · population-adjusted',
    };
  }

  // Auth-protected: city in body → no enumerable public URL
  @Post('travel-guide/render')
  @HttpCode(200)
  renderTravelGuide(@Body() dto: TravelGuideRenderDto): { available: boolean; html: string | null; city: string } {
    // Only city-guides (11 curated) qualify — knowledge-only files are raw YouTube scrapes
    const normalized = dto.city.toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
    const guidePath = path.join(GUIDES_DIR, `${normalized}.json`);
    if (!fs.existsSync(guidePath)) {
      return { available: false, html: null, city: dto.city };
    }

    let guide: CityGuide | null = null;
    try { guide = JSON.parse(fs.readFileSync(guidePath, 'utf-8')) as CityGuide; } catch { /* ignore */ }
    if (!guide) return { available: false, html: null, city: dto.city };

    const cityName = guide.city;
    const region = guide.region ?? '';
    const lastUpdated = guide.lastUpdated ?? '';

    // Hardcoded safety tips per city — clean, curated, not from scraped aggregated fields
    const SAFETY_TIPS: Record<string, string[]> = {
      london: [
        'Use licensed black cabs or Uber — avoid unlicensed minicabs at stations.',
        'Watch for pickpockets on the Tube, especially at Piccadilly Circus and Oxford Street.',
        'Avoid Leicester Square late at night — stick to Soho or Covent Garden.',
        'Night buses are safe and run all night when the Tube closes.',
        'Book Sky Garden (free) instead of the London Eye — better views, no queue fee.',
        'Avoid the "Awful Four" tourist traps: London Dungeon, Shrek Adventure, Aquarium, Madame Tussauds.',
      ],
      amsterdam: [
        'Lock your bike properly — bike theft is the most common crime.',
        'The Red Light District is safe but stay aware of pickpockets in crowds.',
        'Trams stop running around midnight — plan your route back.',
        'Avoid unlicensed drug vendors on the street.',
        'Carry cash — many smaller venues do not accept cards.',
      ],
      bangkok: [
        'Only use metered taxis or Grab — tuk-tuk drivers often overcharge tourists.',
        'The BTS Skytrain and MRT are safe, air-conditioned, and reliable.',
        'Dress modestly when visiting temples — shoulders and knees must be covered.',
        'Be cautious of gem shop scams near major attractions.',
        'Tap water is not safe to drink — use bottled water.',
      ],
      paris: [
        'Metro pickpockets target tourists heavily on lines 1 and 9.',
        'Always agree on taxi fare before getting in near tourist areas.',
        'Avoid signature bracelets and petition scams near the Eiffel Tower.',
        'The banlieues (outer suburbs) can be unsafe — stay in central arrondissements.',
        'Keep bags in front of you in crowded areas like Montmartre.',
      ],
      dubai: [
        'Public displays of affection are illegal — be mindful in public spaces.',
        'Dress conservatively outside of hotels and beach areas.',
        'Alcohol is only served in licensed venues — hotels and certain restaurants.',
        'Jaywalking carries heavy fines — use pedestrian crossings.',
        'Tap water is safe to drink but bottled is preferred.',
      ],
      new_york_city: [
        'The subway is generally safe — stay alert late at night on quieter lines.',
        'Midtown and Times Square are safe but heavy with tourist scams.',
        'Use yellow cabs or Uber/Lyft — avoid unlicensed car services.',
        'Always tip 18–20% at restaurants — it is expected, not optional.',
        'Avoid carrying large amounts of cash in crowded areas.',
      ],
      istanbul: [
        'Be cautious of the "shoe shine" scam near Sultanahmet.',
        'Only use licensed yellow taxis or the metro.',
        'The Grand Bazaar has a high risk of overpricing — always negotiate.',
        'Avoid tap water — drink bottled water.',
        'Keep your passport copy handy — spot checks occur near tourist sites.',
      ],
      hong_kong: [
        'Extremely low violent crime rate — one of the safest cities in Asia.',
        'MTR is the safest and fastest way to get around.',
        'Be aware of protests or demonstrations and avoid large crowds.',
        'Typhoon season (May–Nov) can disrupt travel — check weather alerts.',
        'Drinking tap water is safe — Hong Kong has one of the best water systems in Asia.',
      ],
      seoul: [
        'Extremely safe city — violent crime against tourists is very rare.',
        'T-Money card works on all metro, buses, and taxis.',
        'Itaewon is lively at night — stay with groups in crowded areas.',
        'Scams near Myeongdong targeting tourists for overpriced goods are common.',
        'Emergency number is 112 (police) and 119 (fire/ambulance).',
      ],
      kuala_lumpur: [
        'Petty theft and bag snatching occur near Bukit Bintang — carry bags in front.',
        'Only use Grab or metered taxis — negotiated fares often overcharge.',
        'Dress modestly when visiting mosques.',
        'Avoid tap water — drink bottled water.',
        'Berjaya Times Square and KLCC areas are safe and well-policed.',
      ],
      antalya: [
        'All-inclusive resorts are generally very safe.',
        'Avoid unlicensed tour operators near the Old Town (Kaleiçi).',
        'Haggle at the bazaars — initial prices are always inflated for tourists.',
        'Emergency number: 112 (universal).',
        'Carry sunscreen — the Mediterranean sun is intense May–September.',
      ],
    };

    const tips = SAFETY_TIPS[normalized] ?? [
      'Keep bags zipped and in front of you in crowded areas.',
      'Use official taxis or ride-hailing apps — avoid unlicensed drivers.',
      'Note the nearest hospital and local emergency number.',
      'Share your location with a trusted contact when exploring new areas.',
      'Stick to well-lit, populated streets after dark.',
    ];

    // Clean video data — title, channel, views, duration, thumbnail (no description/transcript)
    const videos = (guide.videos ?? []).slice(0, 8).map((v) => ({
      title: v.title.replace(/ ad$/, '').trim(),
      channel: v.channel,
      url: v.url,
      thumbnail: v.thumbnail ?? '',
      views: v.viewCount ? new Intl.NumberFormat('en-GB', { notation: 'compact' }).format(v.viewCount) + ' views' : '',
      duration: v.duration
        ? (() => {
            const m = v.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (!m) return '';
            const h = m[1] ? `${m[1]}h ` : '';
            const min = m[2] ? `${m[2]}m` : '';
            return `${h}${min}`.trim();
          })()
        : '',
    }));

    const tipsHtml = tips.map((t, i) => `
      <div class="tip-row">
        <div class="tip-num">${i + 1}</div>
        <div class="tip-text">${t}</div>
      </div>`).join('');

    const videosHtml = videos.map((v) => `
      <div class="video-card">
        ${v.thumbnail ? `<img src="${v.thumbnail}" alt="" class="video-thumb" onerror="this.style.display='none'"/>` : ''}
        <div class="video-info">
          <div class="video-title">${v.title}</div>
          <div class="video-meta">${v.channel}${v.views ? ' · ' + v.views : ''}${v.duration ? ' · ' + v.duration : ''}</div>
        </div>
      </div>`).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#fff;color:#1a1a1a;max-width:800px;margin:0 auto}
.header{background:linear-gradient(135deg,#FF7B14 0%,#e85d00 100%);color:#fff;padding:40px 32px 32px}
.header-eyebrow{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.8;margin-bottom:8px}
.header-title{font-size:36px;font-weight:800;line-height:1.1;margin-bottom:6px}
.header-sub{font-size:14px;opacity:0.85}
.header-meta{margin-top:16px;display:flex;gap:16px;flex-wrap:wrap}
.header-pill{background:rgba(255,255,255,0.2);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600}
.body{padding:24px 32px 40px}
.section{margin-bottom:32px}
.section-label{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#FF7B14;margin-bottom:14px}
.section-title{font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:16px;border-left:4px solid #FF7B14;padding-left:12px}
.tip-row{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px;padding:12px;background:#fafafa;border-radius:10px}
.tip-num{min-width:26px;height:26px;background:#FF7B14;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}
.tip-text{font-size:14px;line-height:1.6;color:#333;padding-top:3px}
.video-card{display:flex;gap:12px;align-items:center;padding:12px;border-bottom:1px solid #f0f0f0}
.video-card:last-child{border-bottom:none}
.video-thumb{width:80px;height:52px;object-fit:cover;border-radius:6px;flex-shrink:0;background:#eee}
.video-info{flex:1;min-width:0}
.video-title{font-size:13px;font-weight:600;color:#1a1a1a;line-height:1.4;margin-bottom:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.video-meta{font-size:11px;color:#888}
.videos-box{background:#fafafa;border-radius:12px;overflow:hidden;padding:0 4px}
.footer{border-top:1px solid #eee;padding:20px 32px;display:flex;align-items:center;justify-content:space-between}
.footer-brand{font-size:13px;font-weight:700;color:#FF7B14}
.footer-text{font-size:11px;color:#aaa}
</style></head><body>

<div class="header">
  <div class="header-eyebrow">Wiley Fox Travel Guide</div>
  <div class="header-title">${cityName}</div>
  <div class="header-sub">${region ? region + ' · ' : ''}Safety &amp; Travel Intelligence</div>
  <div class="header-meta">
    <div class="header-pill">🛡️ ${tips.length} Safety Tips</div>
    <div class="header-pill">🎬 ${videos.length} Video Guides</div>
    ${lastUpdated ? `<div class="header-pill">Updated ${lastUpdated}</div>` : ''}
  </div>
</div>

<div class="body">

  <div class="section">
    <div class="section-label">Safety First</div>
    <div class="section-title">Stay Safe in ${cityName}</div>
    ${tipsHtml}
  </div>

  ${videos.length ? `
  <div class="section">
    <div class="section-label">Curated Videos</div>
    <div class="section-title">Expert Video Guides</div>
    <div class="videos-box">
      ${videosHtml}
    </div>
  </div>` : ''}

</div>

<div class="footer">
  <div class="footer-brand">Wiley Fox</div>
  <div class="footer-text">Real-time safety intelligence for travellers</div>
</div>

</body></html>`;

    return { available: true, html, city: cityName };
  }
}
