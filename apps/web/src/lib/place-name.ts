/** First comma-separated segment of a Nominatim display name. */
export function shortPlaceName(label: string): string {
  return label.split(',')[0]?.trim() || label.trim();
}

export type PlaceNameParts = {
  /** Suburb / neighbourhood when available */
  suburb: string;
  /** City / town */
  city: string;
  /** "Suburb, City" or whichever parts exist */
  label: string;
};

/** Best-effort suburb + city label from reverse geocoding (Nominatim). */
export async function reversePlaceParts(lat: number, lng: number): Promise<PlaceNameParts> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { Accept: 'application/json', 'Accept-Language': 'en' } },
    );
    if (!res.ok) return { suburb: '', city: '', label: '' };
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const addr = data.address ?? {};
    const suburb =
      addr.suburb ||
      addr.neighbourhood ||
      addr.neighborhood ||
      addr.quarter ||
      addr.city_district ||
      addr.hamlet ||
      '';
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.county ||
      '';
    const label =
      suburb && city && suburb.toLowerCase() !== city.toLowerCase()
        ? `${suburb}, ${city}`
        : suburb || city || (typeof data.display_name === 'string' ? shortPlaceName(data.display_name) : '');
    return { suburb, city, label };
  } catch {
    return { suburb: '', city: '', label: '' };
  }
}

/** Best-effort place label from reverse geocoding (Nominatim). Prefers suburb, city. */
export async function reversePlaceName(lat: number, lng: number): Promise<string> {
  const parts = await reversePlaceParts(lat, lng);
  return parts.label;
}
