import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { indexLatLng } from '../lib/h3';
import { upsertIncidents, IncidentRow } from '../lib/upsert';
import { logPipelineRun } from '../lib/pipeline-log';
import { COUNTRIES } from '../data/country-data';

const SOURCE_API = 'worldbank-global';
const INDICATOR = 'VC.IHR.PSRC.P5';
const BASE = 'https://api.worldbank.org/v2';

const ISO3_TO_ISO2: Record<string, string> = {
  AUT:'AT',BEL:'BE',BGR:'BG',HRV:'HR',CYP:'CY',CZE:'CZ',DNK:'DK',
  EST:'EE',FIN:'FI',FRA:'FR',DEU:'DE',GRC:'GR',HUN:'HU',IRL:'IE',
  ITA:'IT',LVA:'LV',LTU:'LT',LUX:'LU',MLT:'MT',NLD:'NL',POL:'PL',
  PRT:'PT',ROU:'RO',SVK:'SK',SVN:'SI',ESP:'ES',SWE:'SE',ISL:'IS',
  NOR:'NO',CHE:'CH',GBR:'GB',USA:'US',CAN:'CA',MEX:'MX',BRA:'BR',
  ARG:'AR',COL:'CO',CHL:'CL',PER:'PE',AUS:'AU',NZL:'NZ',JPN:'JP',
  KOR:'KR',CHN:'CN',IND:'IN',IDN:'ID',THA:'TH',VNM:'VN',PHL:'PH',
  SGP:'SG',ZAF:'ZA',NGA:'NG',KEN:'KE',EGY:'EG',MAR:'MA',ARE:'AE',
  SAU:'SA',TUR:'TR',ISR:'IL',RUS:'RU',UKR:'UA',
};

function defaultYears(): number[] {
  const y = new Date().getUTCFullYear();
  return [y - 3, y - 2, y - 1];
}

@Injectable()
export class WorldbankGlobalConnector {
  private readonly logger = new Logger(WorldbankGlobalConnector.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(years?: number[]): Promise<{ fetched: number; inserted: number; errors: string[] }> {
    const targetYears = years ?? defaultYears();
    let fetched = 0;
    let inserted = 0;
    const errors: string[] = [];

    const dateRange = `${Math.min(...targetYears)}:${Math.max(...targetYears)}`;
    let allObs: any[] = [];

    try {
      let page = 1;
      while (true) {
        const url =
          `${BASE}/country/all/indicator/${INDICATOR}` +
          `?date=${dateRange}&format=json&per_page=2000&page=${page}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`World Bank HTTP ${res.status}`);
        const data = await res.json() as any[];
        const meta = data[0];
        const rows = data[1] ?? [];
        allObs = allObs.concat(rows);
        if (!meta || page >= (meta.pages ?? 1)) break;
        page++;
      }
    } catch (err) {
      errors.push(`fetch: ${(err as Error).message}`);
      await logPipelineRun(this.db, { source: SOURCE_API, recordsFetched: 0, recordsInserted: 0, errors: errors.join('; ') });
      return { fetched: 0, inserted: 0, errors };
    }

    const rows: IncidentRow[] = [];
    for (const obs of allObs) {
      fetched++;
      const rate = Number(obs.value);
      if (!Number.isFinite(rate) || rate <= 0) continue;

      const iso = obs.countryiso3code
        ? ISO3_TO_ISO2[obs.countryiso3code]
        : obs.country?.id;
      const centroid = iso ? COUNTRIES[iso] : null;
      if (!centroid) continue;

      const year = Number(obs.date);
      if (!Number.isFinite(year) || !targetYears.includes(year)) continue;

      const absolute = Math.max(1, Math.round((rate * centroid.population) / 1e5));

      rows.push({
        source_country: iso!,
        source_api: SOURCE_API,
        source_record_id: `${iso}|homicide|${year}`,
        crime_type: 'intentional-homicide',
        severity_category: 'violent',
        incident_count: absolute,
        lat: centroid.lat,
        lng: centroid.lng,
        incident_date: `${year}-01-01`,
        ...indexLatLng(centroid.lat, centroid.lng),
      });
    }

    try {
      inserted = await upsertIncidents(this.db, rows);
    } catch (err) {
      errors.push(`upsert: ${(err as Error).message}`);
    }

    await logPipelineRun(this.db, {
      source: SOURCE_API,
      recordsFetched: fetched,
      recordsInserted: inserted,
      errors: errors.length ? errors.join('; ') : null,
    });

    this.logger.log(`[worldbank-global] fetched=${fetched} inserted=${inserted}`);
    return { fetched, inserted, errors };
  }
}
