'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/types';

export type LocationPermission = 'unsupported' | 'prompt' | 'granted' | 'denied';

interface UseUserLocationOptions {
  /** Watch position updates (default true). */
  watch?: boolean;
  /** Request location as soon as the hook mounts (default true). */
  autoRequest?: boolean;
}

export function useUserLocation(options: UseUserLocationOptions = {}) {
  const { watch = true, autoRequest = true } = options;

  const [location, setLocation] = useState<LatLng | null>(null);
  const [permission, setPermission] = useState<LocationPermission>('prompt');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const applyPosition = useCallback((coords: GeolocationCoordinates) => {
    const loc = { lat: coords.latitude, lng: coords.longitude };
    setLocation(loc);
    return loc;
  }, []);

  const requestLocation = useCallback((): Promise<LatLng | null> => {
    if (!navigator.geolocation) {
      setPermission('unsupported');
      setError('Geolocation is not supported in this browser.');
      return Promise.resolve(null);
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPermission('granted');
          const loc = applyPosition(pos.coords);
          setLoading(false);
          resolve(loc);
        },
        (err) => {
          setLoading(false);
          if (err.code === err.PERMISSION_DENIED) {
            setPermission('denied');
            setError('Location permission denied. Allow location access in your browser settings.');
          } else {
            setError('Could not get your location. Check GPS or network settings.');
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30_000 },
      );
    });
  }, [applyPosition]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPermission('unsupported');
      return;
    }

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (result.state === 'granted') setPermission('granted');
          else if (result.state === 'denied') setPermission('denied');
          else setPermission('prompt');
          result.onchange = () => {
            if (result.state === 'granted') setPermission('granted');
            else if (result.state === 'denied') setPermission('denied');
          };
        })
        .catch(() => {});
    }

    if (autoRequest) {
      void requestLocation();
    }

    if (watch) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setPermission('granted');
          applyPosition(pos.coords);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
      );
    }

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [applyPosition, autoRequest, requestLocation, watch]);

  return { location, permission, loading, error, requestLocation };
}
