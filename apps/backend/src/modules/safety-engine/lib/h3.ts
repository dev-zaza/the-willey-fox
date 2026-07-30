import { latLngToCell } from 'h3-js';

export const RESOLUTIONS = [7, 9, 11] as const;

export interface H3Indices {
  h3_index_r7: string | null;
  h3_index_r9: string | null;
  h3_index_r11: string | null;
}

export function indexLatLng(lat: number, lng: number): H3Indices {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return { h3_index_r7: null, h3_index_r9: null, h3_index_r11: null };
  }
  return {
    h3_index_r7: latLngToCell(lat, lng, 7),
    h3_index_r9: latLngToCell(lat, lng, 9),
    h3_index_r11: latLngToCell(lat, lng, 11),
  };
}
