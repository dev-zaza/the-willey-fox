/** Maps world-atlas feature names → ISO 3166-1 numeric code */
const NAME_TO_NUMERIC: Record<string, number> = {
  Afghanistan: 4, Albania: 8, Algeria: 12, Angola: 24, Antarctica: 10,
  Argentina: 32, Armenia: 51, Australia: 36, Austria: 40, Azerbaijan: 31,
  Bahamas: 44, Bangladesh: 50, Belarus: 112, Belgium: 56, Belize: 84,
  Benin: 204, Bhutan: 64, Bolivia: 68, 'Bosnia and Herz.': 70, Botswana: 72,
  Brazil: 76, Brunei: 96, Bulgaria: 100, 'Burkina Faso': 854, Burundi: 108,
  Cambodia: 116, Cameroon: 120, Canada: 124, 'Central African Rep.': 140,
  Chad: 148, Chile: 152, China: 156, Colombia: 170, Congo: 178,
  'Costa Rica': 188, Croatia: 191, Cuba: 192, Cyprus: 196, Czechia: 203,
  "Côte d'Ivoire": 384, 'Dem. Rep. Congo': 180, Denmark: 208, Djibouti: 262,
  'Dominican Rep.': 214, Ecuador: 218, Egypt: 818, 'El Salvador': 222,
  'Eq. Guinea': 226, Eritrea: 232, Estonia: 233, Ethiopia: 231,
  Fiji: 242, Finland: 246, France: 250, Gabon: 266, Gambia: 270,
  Georgia: 268, Germany: 276, Ghana: 288, Greece: 300, Greenland: 304,
  Guatemala: 320, Guinea: 324, 'Guinea-Bissau': 624, Guyana: 328,
  Haiti: 332, Honduras: 340, Hungary: 348, Iceland: 352, India: 356,
  Indonesia: 360, Iran: 364, Iraq: 368, Ireland: 372, Israel: 376,
  Italy: 380, Jamaica: 388, Japan: 392, Jordan: 400, Kazakhstan: 398,
  Kenya: 404, Kuwait: 414, Kyrgyzstan: 417, Laos: 418, Latvia: 428,
  Lebanon: 422, Lesotho: 426, Liberia: 430, Libya: 434, Lithuania: 440,
  Luxembourg: 442, Macedonia: 807, Madagascar: 450, Malawi: 454,
  Malaysia: 458, Mali: 466, Mauritania: 478, Mexico: 484, Moldova: 498,
  Mongolia: 496, Montenegro: 499, Morocco: 504, Mozambique: 508,
  Myanmar: 104, Namibia: 516, Nepal: 524, Netherlands: 528,
  'New Zealand': 554, Nicaragua: 558, Niger: 562, Nigeria: 566,
  'North Korea': 408, Norway: 578, Oman: 512, Pakistan: 586,
  Palestine: 275, Panama: 591, 'Papua New Guinea': 598, Paraguay: 600,
  Peru: 604, Philippines: 608, Poland: 616, Portugal: 620, Qatar: 634,
  Romania: 642, Russia: 643, Rwanda: 646, 'Saudi Arabia': 682,
  Senegal: 686, Serbia: 688, 'Sierra Leone': 694, Slovakia: 703,
  Slovenia: 705, Somalia: 706, 'South Africa': 710, 'South Korea': 410,
  Spain: 724, 'Sri Lanka': 144, Sudan: 729, Suriname: 740, Sweden: 752,
  Switzerland: 756, Syria: 760, Taiwan: 158, Tajikistan: 762,
  Tanzania: 834, Thailand: 764, 'Timor-Leste': 626, Togo: 768,
  'Trinidad and Tobago': 780, Tunisia: 788, Turkey: 792, Turkmenistan: 795,
  Uganda: 800, Ukraine: 804, 'United Arab Emirates': 784,
  'United Kingdom': 826, 'United States of America': 840,
  Uruguay: 858, Uzbekistan: 860, Vanuatu: 548, Venezuela: 862,
  Vietnam: 704, Yemen: 887, Zambia: 894, Zimbabwe: 716, eSwatini: 748,
  'S. Sudan': 728, 'W. Sahara': 732,
};

/** ISO 3166-1 alpha-2 → numeric (covers Eurostat sourceRegion codes) */
const ISO2_TO_NUMERIC: Record<string, number> = {
  AF: 4, AL: 8, DZ: 12, AO: 24, AR: 32, AM: 51, AU: 36, AT: 40,
  AZ: 31, BS: 44, BD: 50, BY: 112, BE: 56, BZ: 84, BJ: 204, BT: 64,
  BO: 68, BA: 70, BW: 72, BR: 76, BN: 96, BG: 100, BF: 854, BI: 108,
  KH: 116, CM: 120, CA: 124, CF: 140, TD: 148, CL: 152, CN: 156,
  CO: 170, CG: 178, CR: 188, HR: 191, CU: 192, CY: 196, CZ: 203,
  CI: 384, CD: 180, DK: 208, DJ: 262, DO: 214, EC: 218, EG: 818,
  SV: 222, GQ: 226, ER: 232, EE: 233, ET: 231, FJ: 242, FI: 246,
  FR: 250, GA: 266, GM: 270, GE: 268, DE: 276, GH: 288, GR: 300,
  GL: 304, GT: 320, GN: 324, GW: 624, GY: 328, HT: 332, HN: 340,
  HU: 348, IS: 352, IN: 356, ID: 360, IR: 364, IQ: 368, IE: 372,
  IL: 376, IT: 380, JM: 388, JP: 392, JO: 400, KZ: 398, KE: 404,
  KW: 414, KG: 417, LA: 418, LV: 428, LB: 422, LS: 426, LR: 430,
  LY: 434, LT: 440, LU: 442, MK: 807, MG: 450, MW: 454, MY: 458,
  ML: 466, MR: 478, MX: 484, MD: 498, MN: 496, ME: 499, MA: 504,
  MZ: 508, MM: 104, NA: 516, NP: 524, NL: 528, NZ: 554, NI: 558,
  NE: 562, NG: 566, KP: 408, NO: 578, OM: 512, PK: 586, PS: 275,
  PA: 591, PG: 598, PY: 600, PE: 604, PH: 608, PL: 616, PT: 620,
  QA: 634, RO: 642, RU: 643, RW: 646, SA: 682, SN: 686, RS: 688,
  SL: 694, SK: 703, SI: 705, SO: 706, ZA: 710, KR: 410, ES: 724,
  LK: 144, SD: 729, SR: 740, SE: 752, CH: 756, SY: 760, TW: 158,
  TJ: 762, TZ: 834, TH: 764, TL: 626, TG: 768, TT: 780, TN: 788,
  TR: 792, TM: 795, UG: 800, UA: 804, AE: 784, GB: 826, US: 840,
  UY: 858, UZ: 860, VU: 548, VE: 862, VN: 704, YE: 887, ZM: 894,
  ZW: 716, SZ: 748, SS: 728, EH: 732,
};

/** Extra aliases: Travel Advisory country names → numeric */
const ALIAS_TO_NUMERIC: Record<string, number> = {
  'United States': 840,
  'United States of America': 840,
  'Russia': 643,
  'South Korea': 410,
  'North Korea': 408,
  'Iran': 364,
  'Syria': 760,
  'Bolivia': 68,
  'Bosnia and Herzegovina': 70,
  'Congo, Democratic Republic of the': 180,
  'Congo, Republic of the': 178,
  "Cote d'Ivoire": 384,
  "Ivory Coast": 384,
  'Czech Republic': 203,
  'Czech Republic (Czechia)': 203,
  'Dominican Republic': 214,
  'Equatorial Guinea': 226,
  'East Timor': 626,
  'Moldova': 498,
  'Burma': 104,
  'Kosovo': 688,
  'Taiwan': 158,
  'South Sudan': 728,
  'Western Sahara': 732,
  'Eswatini': 748,
  'Swaziland': 748,
  'Trinidad & Tobago': 780,
  'Tanzania': 834,
  'Vietnam': 704,
  'Venezuela': 862,
  'Kyrgyz Republic': 417,
  'Laos': 418,
  'Libya': 434,
  'Macedonia': 807,
  'North Macedonia': 807,
  'Palestine': 275,
  'Palestinian Territories': 275,
};

/**
 * Resolve a zone sourceRegion to a world-atlas numeric country ID.
 * Handles ISO2 codes (Eurostat) and full country names (Travel Advisory).
 */
export function resolveNumericId(sourceRegion: string): number | null {
  // ISO2 code (2 uppercase letters)
  if (/^[A-Z]{2}$/.test(sourceRegion)) {
    return ISO2_TO_NUMERIC[sourceRegion] ?? null;
  }
  // Exact name match
  if (NAME_TO_NUMERIC[sourceRegion] != null) return NAME_TO_NUMERIC[sourceRegion];
  // Alias match
  if (ALIAS_TO_NUMERIC[sourceRegion] != null) return ALIAS_TO_NUMERIC[sourceRegion];
  return null;
}
