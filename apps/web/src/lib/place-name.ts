/** First comma-separated segment of a Nominatim display name. */
export function shortPlaceName(label: string): string {
  return label.split(',')[0]?.trim() || label.trim();
}

/** Best-effort city/area label from reverse geocoding (Nominatim). */
export async function reversePlaceName(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { Accept: 'application/json', 'Accept-Language': 'en' } },
    );
    if (!res.ok) return '';
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const addr = data.address ?? {};
    return (
      addr.city ||
      addr.town ||
      addr.village ||
      addr.suburb ||
      addr.city_district ||
      addr.municipality ||
      addr.county ||
      (typeof data.display_name === 'string' ? shortPlaceName(data.display_name) : '') ||
      ''
    );
  } catch {
    return '';
  }
}
