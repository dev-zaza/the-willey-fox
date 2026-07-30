export type SeverityCategory = 'violent' | 'sexual' | 'property' | 'asb';

export const SEVERITY_WEIGHTS: Record<SeverityCategory, number> = {
  violent: 3,
  sexual: 4,
  property: 1,
  asb: 1,
};

// ── UK Police ────────────────────────────────────────────────────────────────

const UK_CATEGORY_MAP: Record<string, SeverityCategory> = {
  'anti-social-behaviour': 'asb',
  'bicycle-theft': 'property',
  burglary: 'property',
  'criminal-damage-arson': 'property',
  drugs: 'property',
  'other-theft': 'property',
  'possession-of-weapons': 'violent',
  'public-order': 'asb',
  robbery: 'violent',
  shoplifting: 'property',
  'theft-from-the-person': 'property',
  'vehicle-crime': 'property',
  'violent-crime': 'violent',
  'violent-and-sexual-offences': 'violent',
  'other-crime': 'property',
};

export function categoriseUK(category: string | null | undefined): SeverityCategory {
  if (!category) return 'property';
  return UK_CATEGORY_MAP[category] ?? 'property';
}

// ── FBI ──────────────────────────────────────────────────────────────────────

const FBI_OFFENSE_MAP: Record<string, SeverityCategory> = {
  homicide: 'violent',
  'murder-and-nonnegligent-manslaughter': 'violent',
  manslaughter: 'violent',
  robbery: 'violent',
  'aggravated-assault': 'violent',
  assault: 'violent',
  'violent-crime': 'violent',
  rape: 'sexual',
  'rape-legacy': 'sexual',
  'rape-revised': 'sexual',
  'sex-offenses': 'sexual',
  burglary: 'property',
  'larceny-theft': 'property',
  'motor-vehicle-theft': 'property',
  arson: 'property',
  'property-crime': 'property',
};

export function categoriseFBI(offense: string | null | undefined): SeverityCategory {
  if (!offense) return 'property';
  return FBI_OFFENSE_MAP[offense] ?? 'property';
}

// ── Eurostat / ICCS ──────────────────────────────────────────────────────────

const ICCS_PREFIX_MAP: Array<[string, SeverityCategory]> = [
  ['0101', 'violent'],
  ['0102', 'violent'],
  ['0103', 'violent'],
  ['0104', 'violent'],
  ['0105', 'violent'],
  ['0106', 'violent'],
  ['0107', 'violent'],
  ['02', 'violent'],
  ['0301', 'sexual'],
  ['0302', 'sexual'],
  ['0303', 'sexual'],
  ['0304', 'sexual'],
  ['0305', 'sexual'],
  ['04', 'violent'],
  ['0501', 'property'],
  ['0502', 'property'],
  ['0503', 'property'],
  ['0504', 'property'],
  ['06', 'property'],
  ['07', 'property'],
  ['08', 'property'],
  ['09', 'asb'],
];

export function categoriseICCS(code: string | null | undefined): SeverityCategory {
  if (!code) return 'property';
  const c = String(code).replace(/^ICCS/i, '');
  for (const [prefix, bucket] of ICCS_PREFIX_MAP) {
    if (c.startsWith(prefix)) return bucket;
  }
  return 'property';
}

// ── Mexico (hoyodecrimen) ────────────────────────────────────────────────────

const MX_CRIME_MAP: Record<string, SeverityCategory> = {
  'HOMICIDIO DOLOSO': 'violent',
  'HOMICIDIO CULPOSO': 'violent',
  'LESIONES POR ARMA DE FUEGO': 'violent',
  'LESIONES DOLOSAS POR ARMA BLANCA': 'violent',
  'ROBO DE VEHICULO AUTOMOTOR': 'property',
  'ROBO DE VEHICULO CON VIOLENCIA': 'violent',
  'ROBO DE VEHICULO SIN VIOLENCIA': 'property',
  'ROBO A TRANSEUNTE EN VIA PUBLICA CON Y SIN VIOLENCIA': 'violent',
  'ROBO A TRANSEUNTE CON VIOLENCIA': 'violent',
  'ROBO A TRANSEUNTE SIN VIOLENCIA': 'property',
  'ROBO A CASA HABITACION CON VIOLENCIA': 'violent',
  'ROBO A CASA HABITACION SIN VIOLENCIA': 'property',
  'ROBO A NEGOCIO CON VIOLENCIA': 'violent',
  'ROBO A NEGOCIO SIN VIOLENCIA': 'property',
  VIOLACION: 'sexual',
  'VIOLACION EQUIPARADA': 'sexual',
  SECUESTRO: 'violent',
};

export function categoriseMX(label: string | null | undefined): SeverityCategory {
  if (!label) return 'property';
  const upper = String(label).toUpperCase();
  if (MX_CRIME_MAP[upper]) return MX_CRIME_MAP[upper];
  if (upper.includes('VIOLAC')) return 'sexual';
  if (upper.includes('HOMICID') || upper.includes('LESION')) return 'violent';
  if (upper.startsWith('ROBO') && upper.includes('VIOLENCIA') && !upper.includes('SIN')) {
    return 'violent';
  }
  if (upper.startsWith('ROBO')) return 'property';
  return 'property';
}

// ── ACLED ────────────────────────────────────────────────────────────────────

const ACLED_EVENT_MAP: Record<string, SeverityCategory> = {
  Battles: 'violent',
  'Violence against civilians': 'violent',
  'Explosions/Remote violence': 'violent',
  Riots: 'violent',
  Protests: 'asb',
  'Strategic developments': 'asb',
};

export function categoriseACLED(eventType: string | null | undefined): SeverityCategory {
  if (!eventType) return 'violent';
  return ACLED_EVENT_MAP[eventType] ?? 'violent';
}

// ── Canada (StatCan) ─────────────────────────────────────────────────────────

export function categoriseStatCan(label: string | null | undefined): SeverityCategory {
  if (!label) return 'property';
  const s = String(label).toLowerCase();
  if (/sexual|rape/.test(s)) return 'sexual';
  if (/violent|homicide|murder|assault|robbery|weapon|kidnap|abduct/.test(s)) return 'violent';
  if (/mischief|disturb|nuisance/.test(s)) return 'asb';
  return 'property';
}

// ── Australia (ABS) ──────────────────────────────────────────────────────────

export function categoriseABS(label: string | null | undefined): SeverityCategory {
  if (!label) return 'property';
  const s = String(label).toLowerCase();
  if (/sexual/.test(s)) return 'sexual';
  if (/violent|homicide|assault|robbery|kidnap|abduct|weapon/.test(s)) return 'violent';
  if (/public order|disorderly|nuisance/.test(s)) return 'asb';
  return 'property';
}
