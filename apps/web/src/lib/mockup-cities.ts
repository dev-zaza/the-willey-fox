export const UK_CITIES = [
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
  { name: 'Birmingham', lat: 52.4862, lng: -1.8904 },
  { name: 'Liverpool', lat: 53.4084, lng: -2.9916 },
  { name: 'Leeds', lat: 53.8008, lng: -1.5491 },
  { name: 'Bristol', lat: 51.4545, lng: -2.5879 },
  { name: 'Newcastle', lat: 54.9783, lng: -1.6178 },
  { name: 'Cardiff', lat: 51.4816, lng: -3.1791 },
  { name: 'Belfast', lat: 54.5973, lng: -5.9301 },
  { name: 'Brighton', lat: 50.8225, lng: -0.1372 },
  { name: 'Edinburgh', lat: 55.9533, lng: -3.1883 },
  { name: 'Glasgow', lat: 55.8642, lng: -4.2518 },
  { name: 'Bracknell', lat: 51.416, lng: -0.753 },
] as const;

/** Expanded toward WF-mapping city coverage (street + city-level cards). */
export const GLOBAL_CITIES = [
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Rome', lat: 41.9028, lng: 12.4964 },
  { name: 'Barcelona', lat: 41.3874, lng: 2.1686 },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { name: 'Berlin', lat: 52.52, lng: 13.405 },
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Washington DC', lat: 38.9072, lng: -77.0369 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
  { name: 'Vienna', lat: 48.2082, lng: 16.3738 },
  { name: 'Prague', lat: 50.0755, lng: 14.4378 },
] as const;
