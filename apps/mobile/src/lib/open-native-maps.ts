import { Linking, Platform } from 'react-native';

interface Coord {
  lat: number;
  lng: number;
}

export function openNativeNavigation(destination: Coord, origin?: Coord | null): void {
  let url: string;

  if (Platform.OS === 'ios') {
    const saddr = origin ? `&saddr=${origin.lat},${origin.lng}` : '';
    url = `maps://?daddr=${destination.lat},${destination.lng}${saddr}&dirflg=d`;
  } else {
    const originParam = origin
      ? `&origin=${origin.lat},${origin.lng}`
      : '';
    url = `google.navigation:q=${destination.lat},${destination.lng}${originParam}`;
  }

  Linking.openURL(url).catch(() => {
    const originParam = origin
      ? `&origin=${origin.lat},${origin.lng}`
      : '';
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}${originParam}&travelmode=driving`,
    );
  });
}
