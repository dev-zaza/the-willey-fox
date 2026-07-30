export interface CountryInfo {
  name: string;
  lat: number;
  lng: number;
  population: number;
}

export const COUNTRIES: Record<string, CountryInfo> = {
  // EU + EFTA + UK
  AT: { name: 'Austria',        lat: 47.5162, lng: 14.5501,  population:    8979000 },
  BE: { name: 'Belgium',        lat: 50.8503, lng:  4.3517,  population:   11697000 },
  BG: { name: 'Bulgaria',       lat: 42.7339, lng: 25.4858,  population:    6448000 },
  HR: { name: 'Croatia',        lat: 45.1000, lng: 15.2000,  population:    3850000 },
  CY: { name: 'Cyprus',         lat: 35.1264, lng: 33.4299,  population:    1260000 },
  CZ: { name: 'Czechia',        lat: 49.8175, lng: 15.4730,  population:   10516000 },
  DK: { name: 'Denmark',        lat: 56.2639, lng:  9.5018,  population:    5933000 },
  EE: { name: 'Estonia',        lat: 58.5953, lng: 25.0136,  population:    1366000 },
  FI: { name: 'Finland',        lat: 61.9241, lng: 25.7482,  population:    5564000 },
  FR: { name: 'France',         lat: 46.6034, lng:  1.8883,  population:   68043000 },
  DE: { name: 'Germany',        lat: 51.1657, lng: 10.4515,  population:   83294000 },
  GR: { name: 'Greece',         lat: 39.0742, lng: 21.8243,  population:   10394000 },
  HU: { name: 'Hungary',        lat: 47.1625, lng: 19.5033,  population:    9606000 },
  IE: { name: 'Ireland',        lat: 53.1424, lng: -7.6921,  population:    5056000 },
  IT: { name: 'Italy',          lat: 41.8719, lng: 12.5674,  population:   58870000 },
  LV: { name: 'Latvia',         lat: 56.8796, lng: 24.6032,  population:    1842000 },
  LT: { name: 'Lithuania',      lat: 55.1694, lng: 23.8813,  population:    2718000 },
  LU: { name: 'Luxembourg',     lat: 49.8153, lng:  6.1296,  population:     660000 },
  MT: { name: 'Malta',          lat: 35.9375, lng: 14.3754,  population:     535000 },
  NL: { name: 'Netherlands',    lat: 52.1326, lng:  5.2913,  population:   17618000 },
  PL: { name: 'Poland',         lat: 51.9194, lng: 19.1451,  population:   37747000 },
  PT: { name: 'Portugal',       lat: 39.3999, lng: -8.2245,  population:   10412000 },
  RO: { name: 'Romania',        lat: 45.9432, lng: 24.9668,  population:   19052000 },
  SK: { name: 'Slovakia',       lat: 48.6690, lng: 19.6990,  population:    5428000 },
  SI: { name: 'Slovenia',       lat: 46.1512, lng: 14.9955,  population:    2120000 },
  ES: { name: 'Spain',          lat: 40.4637, lng: -3.7492,  population:   48373000 },
  SE: { name: 'Sweden',         lat: 60.1282, lng: 18.6435,  population:   10551000 },
  IS: { name: 'Iceland',        lat: 64.9631, lng: -19.0208, population:     383000 },
  NO: { name: 'Norway',         lat: 60.4720, lng:  8.4689,  population:    5519000 },
  CH: { name: 'Switzerland',    lat: 46.8182, lng:  8.2275,  population:    8849000 },
  GB: { name: 'United Kingdom', lat: 55.3781, lng: -3.4360,  population:   67736000 },
  // Americas
  US: { name: 'United States',  lat: 37.0902, lng: -95.7129, population:  334915000 },
  CA: { name: 'Canada',         lat: 56.1304, lng: -106.346, population:   38929000 },
  MX: { name: 'Mexico',         lat: 23.6345, lng: -102.553, population:  128456000 },
  BR: { name: 'Brazil',         lat: -14.235, lng: -51.9253, population:  216422000 },
  AR: { name: 'Argentina',      lat: -38.4161, lng: -63.6167, population:   46235000 },
  CO: { name: 'Colombia',       lat:  4.5709, lng: -74.2973, population:   52085000 },
  CL: { name: 'Chile',          lat: -35.6751, lng: -71.5430, population:   19629000 },
  PE: { name: 'Peru',           lat: -9.1900, lng: -75.0152, population:   34352000 },
  // APAC
  AU: { name: 'Australia',      lat: -25.2744, lng: 133.7751, population:   26439000 },
  NZ: { name: 'New Zealand',    lat: -40.9006, lng: 174.886,  population:    5223000 },
  JP: { name: 'Japan',          lat: 36.2048, lng: 138.2529,  population:  124517000 },
  KR: { name: 'South Korea',    lat: 35.9078, lng: 127.7669,  population:   51785000 },
  CN: { name: 'China',          lat: 35.8617, lng: 104.1954,  population: 1410710000 },
  IN: { name: 'India',          lat: 20.5937, lng:  78.9629,  population: 1428628000 },
  ID: { name: 'Indonesia',      lat: -0.7893, lng: 113.9213,  population:  277534000 },
  TH: { name: 'Thailand',       lat: 15.8700, lng: 100.9925,  population:   71801000 },
  VN: { name: 'Vietnam',        lat: 14.0583, lng: 108.2772,  population:   98859000 },
  PH: { name: 'Philippines',    lat: 12.8797, lng: 121.7740,  population:  117337000 },
  SG: { name: 'Singapore',      lat:  1.3521, lng: 103.8198,  population:    5917000 },
  // MENA + Africa
  ZA: { name: 'South Africa',   lat: -30.5595, lng:  22.9375, population:   60414000 },
  NG: { name: 'Nigeria',        lat:  9.0820, lng:   8.6753,  population:  223805000 },
  KE: { name: 'Kenya',          lat: -0.0236, lng:  37.9062,  population:   55100000 },
  EG: { name: 'Egypt',          lat: 26.8206, lng:  30.8025,  population:  112717000 },
  MA: { name: 'Morocco',        lat: 31.7917, lng:  -7.0926,  population:   37840000 },
  AE: { name: 'UAE',            lat: 23.4241, lng:  53.8478,  population:    9516000 },
  SA: { name: 'Saudi Arabia',   lat: 23.8859, lng:  45.0792,  population:   36947000 },
  TR: { name: 'Turkey',         lat: 38.9637, lng:  35.2433,  population:   85816000 },
  IL: { name: 'Israel',         lat: 31.0461, lng:  34.8516,  population:    9756000 },
  // Eastern Europe
  RU: { name: 'Russia',         lat: 61.5240, lng: 105.318,   population:  143826000 },
  UA: { name: 'Ukraine',        lat: 48.3794, lng:  31.1656,  population:   36744000 },
};

export function getCountry(code: string): CountryInfo | null {
  return COUNTRIES[code?.toUpperCase()] ?? null;
}

export interface CmaInfo {
  code: string;
  name: string;
  lat: number;
  lng: number;
  population: number;
}

export const CANADIAN_CMAS: CmaInfo[] = [
  { code: '462', name: 'Toronto',   lat: 43.6532, lng: -79.3832, population: 6202000 },
  { code: '933', name: 'Vancouver', lat: 49.2827, lng: -123.121, population: 2642000 },
  { code: '462', name: 'Montréal',  lat: 45.5017, lng: -73.5673, population: 4291000 },
  { code: '825', name: 'Calgary',   lat: 51.0447, lng: -114.072, population: 1481000 },
  { code: '835', name: 'Edmonton',  lat: 53.5461, lng: -113.494, population: 1418000 },
  { code: '505', name: 'Ottawa',    lat: 45.4215, lng:  -75.697, population: 1488000 },
  { code: '532', name: 'Hamilton',  lat: 43.2557, lng:  -79.871, population:  785000 },
  { code: '602', name: 'Winnipeg',  lat: 49.8951, lng:  -97.138, population:  834000 },
  { code: '421', name: 'Québec',    lat: 46.8139, lng:  -71.208, population:  839000 },
  { code: '210', name: 'Halifax',   lat: 44.6488, lng:  -63.575, population:  465000 },
];

export interface StateInfo {
  code: string;
  name: string;
  lat: number;
  lng: number;
  population: number;
}

export const AUSTRALIAN_STATES: StateInfo[] = [
  { code: '1', name: 'New South Wales',              lat: -33.8688, lng: 151.2093, population: 8166000 },
  { code: '2', name: 'Victoria',                     lat: -37.8136, lng: 144.9631, population: 6681000 },
  { code: '3', name: 'Queensland',                   lat: -27.4698, lng: 153.0251, population: 5322000 },
  { code: '4', name: 'South Australia',              lat: -34.9285, lng: 138.6007, population: 1818000 },
  { code: '5', name: 'Western Australia',            lat: -31.9523, lng: 115.8613, population: 2778000 },
  { code: '6', name: 'Tasmania',                     lat: -42.8821, lng: 147.3272, population:  571000 },
  { code: '7', name: 'Northern Territory',           lat: -12.4634, lng: 130.8456, population:  252000 },
  { code: '8', name: 'Australian Capital Territory', lat: -35.2809, lng: 149.1300, population:  455000 },
];
