import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pinsService } from '@/services/pins.service';
import { directionsService, type SafetyZone, type RouteResult } from '@/services/directions.service';
import { emergencyService, type ActiveSosNear } from '@/services/emergency.service';
import { usersService } from '@/services/users.service';
import { useAuthStore } from '@/stores/auth.store';
import { openNativeNavigation } from '@/lib/open-native-maps';
import { extractApiErrorMessage } from '@/lib/api-error';

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

// ── Polyline decoder (Google encoded polyline algorithm) ─────────────────────
function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  const coords: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coords;
}

// ── Pin type config ──────────────────────────────────────────────────────────
const PIN_TYPES = [
  { id: 'traffic',        label: 'Traffic',      emoji: '🚗', color: '#EF4444' },
  { id: 'construction',   label: 'Construction', emoji: '🚧', color: '#F97316' },
  { id: 'event',          label: 'Event',        emoji: '📅', color: '#3B82F6' },
  { id: 'pickpocket',     label: 'Pickpocket',   emoji: '🤚', color: '#DC2626' },
  { id: 'recommendation', label: 'Recommendation', emoji: '👍', color: '#10B981' },
  { id: 'harassment',    label: 'Harassment',    emoji: '🚫', color: '#BE185D' },
  { id: 'unsafe_area',   label: 'Unsafe Area',   emoji: '⛔', color: '#991B1B' },
  { id: 'safety',         label: 'Safety',       emoji: '⚠️', color: '#EAB308' },
] as const;

type PinType = (typeof PIN_TYPES)[number]['id'];

interface Pin {
  id: string;
  type: PinType;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  upvotes: number;
  downvotes: number;
}

const FALLBACK_REGION: Region = {
  latitude: 37.7849,
  longitude: -122.4094,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

let nativeMapsModule: any = null;
try {
  nativeMapsModule = require('react-native-maps');
} catch {
  nativeMapsModule = null;
}

const MapView = nativeMapsModule?.default as any;
const Circle = nativeMapsModule?.Circle as any;
const Marker = nativeMapsModule?.Marker as any;
const Polyline = nativeMapsModule?.Polyline as any;

let mapboxModule: any = null;
try {
  mapboxModule = require('@rnmapbox/maps');
} catch {
  mapboxModule = null;
}

const Mapbox = mapboxModule?.default;
const MapboxMapView = mapboxModule?.MapView as any;
const MapboxCamera = mapboxModule?.Camera as any;
const PointAnnotation = mapboxModule?.PointAnnotation as any;
const ShapeSource = mapboxModule?.ShapeSource as any;
const MapboxCircleLayer = mapboxModule?.CircleLayer as any;
const MapboxLineLayer = mapboxModule?.LineLayer as any;

const HAS_MAPBOX_TOKEN = Boolean(MAPBOX_TOKEN);
const HAS_GOOGLE_NATIVE = Boolean(MapView && Marker && Circle && Polyline);
const HAS_MAPBOX_NATIVE = Boolean(
  Mapbox &&
    MapboxMapView &&
    MapboxCamera &&
    PointAnnotation &&
    ShapeSource &&
    MapboxCircleLayer &&
    MapboxLineLayer,
);
const IS_MAPBOX_ENABLED = HAS_MAPBOX_TOKEN && HAS_MAPBOX_NATIVE;

function regionFromCenterZoom(centerLat: number, centerLng: number, zoomLevel: number): Region {
  const worldDelta = 360 / Math.pow(2, Math.max(zoomLevel, 1));
  const latitudeDelta = Math.max(0.0025, Math.min(180, worldDelta));
  const longitudeDelta = Math.max(0.0025, Math.min(180, worldDelta));
  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta,
    longitudeDelta,
  };
}

function getPinConfig(type: PinType) {
  return PIN_TYPES.find((p) => p.id === type) ?? PIN_TYPES[0];
}

function getMapboxPressCoords(event: any): { lat: number; lng: number } | null {
  const candidates: unknown[] = [
    event?.geometry?.coordinates,
    event?.coordinates,
    event?.nativeEvent?.coordinates,
    event?.nativeEvent?.geometry?.coordinates,
    event?.nativeEvent?.payload?.geometry?.coordinates,
    event?.nativeEvent?.coordinate,
    event?.coordinate,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length >= 2) {
      const lng = Number(candidate[0]);
      const lat = Number(candidate[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
    if (candidate && typeof candidate === 'object') {
      const asObj = candidate as Record<string, unknown>;
      const lat = Number(asObj.latitude ?? asObj.lat);
      const lng = Number(asObj.longitude ?? asObj.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  }
  return null;
}

function isMapboxFeatureTap(event: any): boolean {
  const features = event?.features ?? event?.nativeEvent?.payload?.features ?? event?.nativeEvent?.features;
  return Array.isArray(features) && features.length > 0;
}

// ── Custom pin marker ────────────────────────────────────────────────────────
function PinMarker({ type, selected }: { type: PinType; selected?: boolean }) {
  const cfg = getPinConfig(type);
  return (
    <View style={[styles.pinOuter, { borderColor: cfg.color, backgroundColor: cfg.color + '20' }, selected && { backgroundColor: cfg.color + '44' }]}>
      <View style={[styles.pinInner, { backgroundColor: cfg.color }]}>
        <Text style={styles.pinEmoji}>{cfg.emoji}</Text>
      </View>
      <View style={[styles.pinCaret, { borderTopColor: cfg.color }]} />
    </View>
  );
}

// ── SOS Pulse beacon ─────────────────────────────────────────────────────────
function SosBeaconMarker() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return (
    <View style={styles.sosBeaconWrap}>
      <Animated.View style={[styles.sosPulseRing, { transform: [{ scale: pulse }] }]} />
      <View style={styles.sosBeaconCore}>
        <Text style={styles.sosText}>SOS</Text>
      </View>
    </View>
  );
}

// ── Safety grade badge color ─────────────────────────────────────────────────
function safetyColor(score: number | null): string {
  if (score == null) return '#9ca3af';
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MapScreen() {
  const { openAddPin } = useLocalSearchParams<{ openAddPin?: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const mapRef = useRef<any>(null);
  const mapboxCameraRef = useRef<any>(null);
  const pinsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);

  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<PinType | 'all'>('all');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [votedPins, setVotedPins] = useState<Record<string, 'up' | 'down'>>({});
  const currentRegionRef = useRef<Region | null>(null);

  const [safetyZones, setSafetyZones] = useState<SafetyZone[]>([]);
  const [safetyOverlayOn, setSafetyOverlayOn] = useState(false);
  const [safetyOverlayLoading, setSafetyOverlayLoading] = useState(false);
  const [sosBeacons, setSosBeacons] = useState<ActiveSosNear[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; fullName: string; lat: number; lng: number }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add pin form state
  const [newPinType, setNewPinType] = useState<PinType>('traffic');
  const [newPinTitle, setNewPinTitle] = useState('');
  const [newPinDesc, setNewPinDesc] = useState('');
  const [tapLocation, setTapLocation] = useState<{ lat: number; lng: number } | null>(null);

  // ── POI (native map place tap) state ─────────────────────────────────────
  const [selectedPoi, setSelectedPoi] = useState<{ lat: number; lng: number; name: string } | null>(null);

  // ── Directions state ──────────────────────────────────────────────────────
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [routePolyline, setRoutePolyline] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showRoutePriorityModal, setShowRoutePriorityModal] = useState(false);
  const [pendingRoutePin, setPendingRoutePin] = useState<Pin | null>(null);
  const [pendingPoiDest, setPendingPoiDest] = useState<{ lat: number; lng: number } | null>(null);

  const safetyZonesGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: safetyZones
        .map((zone) => {
          const lat = zone.centerLat ? parseFloat(zone.centerLat) : null;
          const lng = zone.centerLng ? parseFloat(zone.centerLng) : null;
          if (!lat || !lng) return null;
          return {
            type: 'Feature',
            properties: {
              id: zone.id,
              color:
                Number(zone.safetyScore) >= 70
                  ? '#16a34a'
                  : Number(zone.safetyScore) >= 40
                    ? '#f59e0b'
                    : '#ef4444',
              radius: zone.radiusMetres ?? 2000,
            },
            geometry: { type: 'Point', coordinates: [lng, lat] },
          };
        })
        .filter(Boolean),
    } as any;
  }, [safetyZones]);

  const sosGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: sosBeacons.map((beacon) => ({
        type: 'Feature',
        properties: { id: beacon.id },
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(beacon.lng), parseFloat(beacon.lat)],
        },
      })),
    } as any;
  }, [sosBeacons]);

  const routeGeoJson = useMemo(() => {
    if (routePolyline.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routePolyline.map((p) => [p.longitude, p.latitude]),
          },
        },
      ],
    } as any;
  }, [routePolyline]);

  function animateToRegionLike(
    region: Region,
    duration = 600,
    zoomLevel = 14,
  ) {
    if (IS_MAPBOX_ENABLED) {
      mapboxCameraRef.current?.setCamera({
        centerCoordinate: [region.longitude, region.latitude],
        zoomLevel,
        animationDuration: duration,
        animationMode: 'easeTo',
      });
      return;
    }
    mapRef.current?.animateToRegion(region, duration);
  }

  function fitToRouteCoords(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
  ) {
    if (IS_MAPBOX_ENABLED) {
      const ne: [number, number] = [
        Math.max(origin.longitude, destination.longitude),
        Math.max(origin.latitude, destination.latitude),
      ];
      const sw: [number, number] = [
        Math.min(origin.longitude, destination.longitude),
        Math.min(origin.latitude, destination.latitude),
      ];
      mapboxCameraRef.current?.fitBounds(ne, sw, [120, 40, 200, 40], 900);
      return;
    }
    mapRef.current?.fitToCoordinates([origin, destination], {
      edgePadding: { top: 120, right: 40, bottom: 200, left: 40 },
      animated: true,
    });
  }

  useEffect(() => {
    if (!HAS_MAPBOX_NATIVE && !HAS_GOOGLE_NATIVE) {
      Alert.alert(
        'Unsupported runtime',
        'Neither Mapbox nor react-native-maps native modules are available. Use an Android development build.',
      );
      return;
    }
    if (HAS_MAPBOX_TOKEN && !HAS_MAPBOX_NATIVE) {
      Alert.alert(
        'Mapbox requires a development build',
        'Mapbox token is set, but native Mapbox module is unavailable (likely Expo Go). Build and run the app with `pnpm --filter @safetag/mobile android` or use an EAS dev build.',
      );
      return;
    }
    if (IS_MAPBOX_ENABLED) {
      Mapbox.setAccessToken(MAPBOX_TOKEN);
      return;
    }
    if (Platform.OS !== 'android') return;
    const androidConfig = Constants.expoConfig?.android as
      | { config?: { googleMaps?: { apiKey?: string } } }
      | undefined;
    const hasMapsKey = Boolean(androidConfig?.config?.googleMaps?.apiKey);
    if (!hasMapsKey) {
      Alert.alert(
        'Map setup required',
        'Google Maps API key is missing for Android build. Set GOOGLE_MAPS_API_KEY in apps/mobile/.env and rebuild the app.',
      );
    }
  }, []);

  useEffect(() => {
    if (openAddPin === '1') setShowAddModal(true);
  }, [openAddPin]);

  async function loadPinsForRegion(region: Region) {
    const delta = 0.01;
    const bbox = {
      minLat: region.latitude - region.latitudeDelta / 2 - delta,
      minLng: region.longitude - region.longitudeDelta / 2 - delta,
      maxLat: region.latitude + region.latitudeDelta / 2 + delta,
      maxLng: region.longitude + region.longitudeDelta / 2 + delta,
    };
    try {
      const data = await pinsService.list(bbox);
      setPins(
        data.map((p: any) => ({
          id: p.id,
          type: (p.type as PinType) ?? 'safety',
          title: p.title,
          description: p.description,
          lat: p.lat ?? p.latitude,
          lng: p.lng ?? p.longitude,
          upvotes: p.upvotes ?? 0,
          downvotes: p.downvotes ?? 0,
        })),
      );
    } catch {
      // Silently fail
    }
  }

  function applyCurrentLocation(coords: { lat: number; lng: number }, shouldCenter = false) {
    setUserLocation(coords);
    usersService.updateLocation(coords.lat, coords.lng).catch(() => {});
    if (shouldCenter) {
      const targetRegion: Region = {
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };
      currentRegionRef.current = targetRegion;
      animateToRegionLike(targetRegion, 800, 15);
    }
  }

  async function getCurrentCoords(accuracy: Location.Accuracy) {
    const loc = await Location.getCurrentPositionAsync({ accuracy });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  }

  async function recenterToCurrentLocation() {
    try {
      setLocating(true);
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        const requested = await Location.requestForegroundPermissionsAsync();
        if (requested.status !== 'granted') {
          Alert.alert('Location permission denied', 'Enable location in Settings to use current location.');
          return;
        }
      }

      let coords: { lat: number; lng: number } | null = null;
      try {
        coords = await getCurrentCoords(Location.Accuracy.Highest);
      } catch {
        try {
          coords = await getCurrentCoords(Location.Accuracy.High);
        } catch {
          coords = await getCurrentCoords(Location.Accuracy.Balanced);
        }
      }

      applyCurrentLocation(coords, true);
      emergencyService.getActiveSosNear(coords.lat, coords.lng, 2000).then(setSosBeacons).catch(() => {});
    } catch {
      Alert.alert('Location unavailable', 'Could not fetch your current location. Please check device GPS settings.');
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission denied', 'Enable location in Settings to place pins.');
        return;
      }

      if (Platform.OS === 'android') {
        // Ask Android to improve provider accuracy (GPS/network) before first fix.
        await Location.enableNetworkProviderAsync().catch(() => {});
      }

      let lastKnownCoords: { lat: number; lng: number } | null = null;
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown && isMounted) {
          lastKnownCoords = { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude };
          applyCurrentLocation(
            lastKnownCoords,
            false,
          );
        }
      } catch {
        // Ignore last-known lookup failures
      }

      let coords: { lat: number; lng: number };
      try {
        coords = await getCurrentCoords(Location.Accuracy.High);
      } catch {
        try {
          coords = await getCurrentCoords(Location.Accuracy.Balanced);
        } catch {
          if (lastKnownCoords) {
            // Keep last known centered location when live GPS is unavailable.
            return;
          }
          Alert.alert('Location unavailable', 'Could not detect your current location. Please check device location settings.');
          return;
        }
      }

      if (!isMounted) return;

      applyCurrentLocation(coords, true);
      const initialRegion: Region = {
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      currentRegionRef.current = initialRegion;
      await loadPinsForRegion(initialRegion);
      emergencyService.getActiveSosNear(coords.lat, coords.lng, 2000).then(setSosBeacons).catch(() => {});

      locationWatcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (update) => {
          if (!isMounted) return;
          applyCurrentLocation(
            { lat: update.coords.latitude, lng: update.coords.longitude },
            false,
          );
        },
      );
    })();

    return () => {
      isMounted = false;
      locationWatcherRef.current?.remove();
      locationWatcherRef.current = null;
    };
  }, []);

  const visiblePins =
    activeFilter === 'all' ? pins : pins.filter((p) => p.type === activeFilter);

  async function handleVote(pinId: string, voteType: 'up' | 'down') {
    const currentVote = votedPins[pinId];
    if (currentVote === voteType) return;
    const applyVote = (p: Pin, ud: number, dd: number) =>
      p.id === pinId ? { ...p, upvotes: p.upvotes + ud, downvotes: p.downvotes + dd } : p;
    let ud = 0, dd = 0;
    if (currentVote === 'up' && voteType === 'down') { ud = -1; dd = 1; }
    else if (currentVote === 'down' && voteType === 'up') { ud = 1; dd = -1; }
    else if (!currentVote) { ud = voteType === 'up' ? 1 : 0; dd = voteType === 'down' ? 1 : 0; }
    else return;
    const prevPins = pins;
    const prevSelected = selectedPin;
    setPins((prev) => prev.map((p) => applyVote(p, ud, dd)));
    if (selectedPin?.id === pinId) setSelectedPin((prev) => (prev ? applyVote(prev, ud, dd) : prev));
    setVotedPins((prev) => ({ ...prev, [pinId]: voteType }));
    try {
      await pinsService.vote(pinId, voteType);
    } catch {
      setPins(prevPins);
      setSelectedPin(prevSelected);
      setVotedPins((prev) => { const n = { ...prev }; delete n[pinId]; return n; });
    }
  }

  async function handleAddPin() {
    if (!newPinTitle.trim()) {
      Alert.alert('Title required', 'Please enter a title for the pin.');
      return;
    }
    const lat = tapLocation?.lat ?? userLocation?.lat ?? currentRegionRef.current?.latitude ?? FALLBACK_REGION.latitude;
    const lng = tapLocation?.lng ?? userLocation?.lng ?? currentRegionRef.current?.longitude ?? FALLBACK_REGION.longitude;
    setSubmitting(true);
    try {
      const created = await pinsService.create({ type: newPinType, title: newPinTitle.trim(), description: newPinDesc.trim() || undefined, lat, lng });
      setPins((prev) => [...prev, { id: created.id, type: newPinType, title: newPinTitle.trim(), description: newPinDesc.trim() || undefined, lat, lng, upvotes: 0, downvotes: 0 }]);
      setNewPinTitle('');
      setNewPinDesc('');
      setNewPinType('traffic');
      setActiveFilter('all');
      setTapLocation(null);
      setShowAddModal(false);
      animateToRegionLike(
        { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        600,
        15,
      );
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to add pin'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSearchChange(text: string) {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!text.trim()) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await directionsService.geocode(text.trim(), userLocation ?? undefined);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }

  function handleSearchResultPress(result: { id: string; name: string; fullName: string; lat: number; lng: number }) {
    setSearchQuery('');
    setSearchResults([]);
    setSearchFocused(false);
    // Fly map to the result
    animateToRegionLike(
      { latitude: result.lat, longitude: result.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      600,
      16,
    );
    // Open POI sheet so user can get directions
    setSelectedPoi({ lat: result.lat, lng: result.lng, name: result.name });
  }

  async function toggleSafetyOverlay() {
    if (safetyOverlayOn) { setSafetyOverlayOn(false); setSafetyZones([]); return; }
    const region = currentRegionRef.current ?? FALLBACK_REGION;
    const d = region.latitudeDelta / 2;
    const bbox = { minLat: region.latitude - d, minLng: region.longitude - region.longitudeDelta / 2, maxLat: region.latitude + d, maxLng: region.longitude + region.longitudeDelta / 2 };
    setSafetyOverlayLoading(true);
    try {
      const zones = await directionsService.getSafetyOverlay(bbox);
      setSafetyZones(zones);
      setSafetyOverlayOn(true);
    } catch {
      Alert.alert('Safety data unavailable', 'Could not load safety zones for this area.');
    } finally {
      setSafetyOverlayLoading(false);
    }
  }

  // ── Directions handlers ───────────────────────────────────────────────────
  function handleGetDirectionsPress(pin: Pin) {
    if (!userLocation) {
      Alert.alert('Location unavailable', 'Enable location permissions to get directions.');
      return;
    }
    setPendingRoutePin(pin);
    setSelectedPin(null); // close pin sheet first, then open priority modal after it unmounts
    setTimeout(() => setShowRoutePriorityModal(true), 350);
  }

  async function fetchRoute(prioritize: 'safety' | 'speed' | 'balanced') {
    if (!userLocation) return;
    const dest = pendingRoutePin
      ? { lat: pendingRoutePin.lat, lng: pendingRoutePin.lng }
      : pendingPoiDest;
    if (!dest) return;
    setShowRoutePriorityModal(false);
    setRouteLoading(true);
    try {
      const routes = await directionsService.getRoute(userLocation, dest, prioritize);
      if (routes.length === 0) {
        Alert.alert('No route found', 'Could not find a route to this location.');
        return;
      }
      const best = routes[0];
      setActiveRoute(best);
      setRoutePolyline(decodePolyline(best.polyline));

      // Fit map to show origin + destination
      const destCoord = pendingRoutePin
        ? { latitude: pendingRoutePin.lat, longitude: pendingRoutePin.lng }
        : { latitude: dest.lat, longitude: dest.lng };
      fitToRouteCoords(
        { latitude: userLocation.lat, longitude: userLocation.lng },
        destCoord,
      );
    } catch (e: any) {
      Alert.alert('Directions failed', extractApiErrorMessage(e, 'Could not get directions.'));
    } finally {
      setRouteLoading(false);
    }
  }

  function handlePoiDirections() {
    if (!userLocation) {
      Alert.alert('Location unavailable', 'Enable location permissions to get directions.');
      return;
    }
    if (!selectedPoi) return;
    setPendingPoiDest({ lat: selectedPoi.lat, lng: selectedPoi.lng });
    setPendingRoutePin(null);
    setSelectedPoi(null);
    setTimeout(() => setShowRoutePriorityModal(true), 350);
  }

  function clearRoute() {
    setActiveRoute(null);
    setRoutePolyline([]);
    setPendingRoutePin(null);
    setPendingPoiDest(null);
  }

  function startNavigation() {
    const dest = pendingRoutePin
      ? { lat: pendingRoutePin.lat, lng: pendingRoutePin.lng }
      : pendingPoiDest;
    if (!dest) return;
    openNativeNavigation(dest, userLocation);
  }

  function openAddPinAtCoords(coords: { lat: number; lng: number }) {
    setSelectedPin(null);
    setSelectedPoi(null);
    setTapLocation(coords);
    setShowAddModal(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Full-screen map */}
      {IS_MAPBOX_ENABLED ? (
        <MapboxMapView
          style={StyleSheet.absoluteFill}
          styleURL="mapbox://styles/mapbox/streets-v12"
          zoomEnabled
          scrollEnabled
          rotateEnabled
          pitchEnabled
          gestureSettings={{
            longPressEnabled: true,
          }}
          onLongPress={(e: any) => {
            const coords = getMapboxPressCoords(e);
            if (!coords) {
              Alert.alert('Map tap failed', 'Could not read tapped location. Try long-pressing again.');
              return;
            }
            openAddPinAtCoords(coords);
          }}
          onPress={(e: any) => {
            // Some Android Mapbox builds do not consistently emit long-press.
            // Fallback: single tap on empty map area opens add-pin modal.
            if (isMapboxFeatureTap(e)) return;
            const coords = getMapboxPressCoords(e);
            if (!coords) return;
            openAddPinAtCoords(coords);
          }}
          onCameraChanged={(state: any) => {
            const center = state.properties.center;
            const zoom = state.properties.zoom;
            if (!center) return;
            const region = regionFromCenterZoom(center[1], center[0], zoom ?? 12);
            currentRegionRef.current = region;
            if (pinsDebounceRef.current) clearTimeout(pinsDebounceRef.current);
            pinsDebounceRef.current = setTimeout(() => loadPinsForRegion(region), 400);
          }}
        >
          <MapboxCamera
            ref={mapboxCameraRef}
            defaultSettings={{
              centerCoordinate: [FALLBACK_REGION.longitude, FALLBACK_REGION.latitude],
              zoomLevel: 12,
            }}
          />
          {userLocation && (
            <PointAnnotation
              id="current-user-location"
              coordinate={[userLocation.lng, userLocation.lat]}
            >
              <View style={styles.currentLocationMarker} />
            </PointAnnotation>
          )}
          {visiblePins.map((pin) => (
            <PointAnnotation
              key={pin.id}
              id={`pin-${pin.id}`}
              coordinate={[pin.lng, pin.lat]}
              onSelected={() => setSelectedPin(pin)}
            >
              <PinMarker type={pin.type} selected={selectedPin?.id === pin.id} />
            </PointAnnotation>
          ))}

          {sosGeoJson.features.length > 0 && (
            <ShapeSource id="sos-circles" shape={sosGeoJson}>
              <MapboxCircleLayer
                id="sos-circles-layer"
                style={{
                  circleColor: '#ef4444',
                  circleRadius: 28,
                  circleOpacity: 0.2,
                  circleStrokeColor: '#ef4444',
                  circleStrokeWidth: 2,
                }}
              />
            </ShapeSource>
          )}

          {sosBeacons.map((beacon) => (
            <PointAnnotation
              key={`sos-${beacon.id}`}
              id={`sos-${beacon.id}`}
              coordinate={[parseFloat(beacon.lng), parseFloat(beacon.lat)]}
            >
              <SosBeaconMarker />
            </PointAnnotation>
          ))}

          {safetyZonesGeoJson.features.length > 0 && (
            <ShapeSource id="safety-zones" shape={safetyZonesGeoJson}>
              <MapboxCircleLayer
                id="safety-zones-layer"
                style={{
                  circleColor: ['get', 'color'],
                  circleRadius: ['interpolate', ['linear'], ['zoom'], 8, 20, 12, 45, 15, 80],
                  circleOpacity: 0.2,
                  circleStrokeColor: ['get', 'color'],
                  circleStrokeWidth: 1,
                }}
              />
            </ShapeSource>
          )}

          {routeGeoJson && (
            <ShapeSource id="route-shape" shape={routeGeoJson}>
              <MapboxLineLayer
                id="route-line"
                style={{
                  lineColor: '#3b82f6',
                  lineWidth: 4,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </ShapeSource>
          )}

          {showAddModal && tapLocation && (
            <PointAnnotation
              id="preview-pin"
              coordinate={[tapLocation.lng, tapLocation.lat]}
            >
              <View style={styles.tapPreviewMarker}>
                <Text style={{ fontSize: 18 }}>📍</Text>
              </View>
            </PointAnnotation>
          )}

          {activeRoute && pendingRoutePin && (
            <PointAnnotation
              id="destination-pin"
              coordinate={[pendingRoutePin.lng, pendingRoutePin.lat]}
            >
              <PinMarker type={pendingRoutePin.type} selected />
            </PointAnnotation>
          )}
        </MapboxMapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallbackWrap]}>
          <Text style={styles.fallbackTitle}>Map unavailable in this runtime</Text>
          <Text style={styles.fallbackText}>
            Open the app using the installed development build instead of Expo Go.
          </Text>
        </View>
      )}

      {/* ── Floating top bar: Search + Location + Profile ── */}
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.searchRow}>
          {/* Profile avatar */}
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/(app)/profile')}
            activeOpacity={0.8}
          >
            {(user as any)?.avatarUrl ? (
              <Image source={{ uri: (user as any).avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={18} color="#f97316" />
              </View>
            )}
          </TouchableOpacity>

          {/* Search box */}
          <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
            <Ionicons name="search" size={16} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search places, pins..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => { setTimeout(() => setSearchFocused(false), 200); }}
              returnKeyType="search"
              onSubmitEditing={() => { if (searchQuery.trim()) handleSearchChange(searchQuery); }}
            />
            {searchLoading
              ? <ActivityIndicator size="small" color="#9ca3af" />
              : searchQuery.length > 0
                ? <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#9ca3af" />
                  </TouchableOpacity>
                : null
            }
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.chip, activeFilter === 'all' && styles.chipActiveAll]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.chipText, activeFilter === 'all' && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>

          {PIN_TYPES.map((pt) => (
            <TouchableOpacity
              key={pt.id}
              style={[
                styles.chip,
                activeFilter === pt.id && { backgroundColor: pt.color, borderColor: pt.color },
              ]}
              onPress={() => setActiveFilter(pt.id)}
            >
              <Text style={styles.chipEmoji}>{pt.emoji}</Text>
              <Text style={[styles.chipText, activeFilter === pt.id && styles.chipTextActive]}>{pt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Search results dropdown ── */}
      {searchResults.length > 0 && (
        <View style={styles.searchDropdown}>
          {searchResults.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.searchResultItem}
              onPress={() => handleSearchResultPress(r)}
            >
              <Ionicons name="location-outline" size={16} color="#f97316" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.searchResultName} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.searchResultFull} numberOfLines={1}>{r.fullName}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Right-side action buttons ── */}
      <View style={styles.rightActions} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.mapActionBtn, safetyOverlayOn && styles.mapActionBtnActive]}
          onPress={toggleSafetyOverlay}
          disabled={safetyOverlayLoading}
        >
          {safetyOverlayLoading
            ? <ActivityIndicator size="small" color="#16a34a" />
            : <Text style={{ fontSize: 20 }}>🛡️</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Left-side: My location ── */}
      <TouchableOpacity
        style={styles.locationBtn}
        onPress={recenterToCurrentLocation}
      >
        <Ionicons
          name={locating ? 'locate' : 'navigate'}
          size={20}
          color={userLocation ? '#f97316' : '#9ca3af'}
        />
      </TouchableOpacity>

      {/* ── Route loading overlay ── */}
      {routeLoading && (
        <View style={styles.routeLoadingOverlay}>
          <ActivityIndicator size="small" color="#ffffff" />
          <Text style={styles.routeLoadingText}>Getting directions…</Text>
        </View>
      )}

      {/* ── Active route info bar ── */}
      {activeRoute && !routeLoading && (
        <View style={styles.routeBar}>
          <View style={styles.routeBarLeft}>
            <View style={styles.routeBarRow}>
              <Ionicons name="navigate-circle" size={18} color="#3b82f6" />
              <Text style={styles.routeLabel}>
                {activeRoute.label.charAt(0).toUpperCase() + activeRoute.label.slice(1)} route
              </Text>
              {activeRoute.safetyScore != null && (
                <View style={[styles.routeSafetyBadge, { backgroundColor: safetyColor(activeRoute.safetyScore) + '22', borderColor: safetyColor(activeRoute.safetyScore) }]}>
                  <Text style={[styles.routeSafetyText, { color: safetyColor(activeRoute.safetyScore) }]}>
                    {activeRoute.safetyGrade ?? Math.round(activeRoute.safetyScore)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.routeStats}>
              {activeRoute.durationMinutes} min · {activeRoute.distanceKm} km
            </Text>
            {activeRoute.warnings.length > 0 && (
              <Text style={styles.routeWarning} numberOfLines={1}>
                ⚠️ {activeRoute.warnings[0]}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.routeNavBtn}
            onPress={startNavigation}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={14} color="#ffffff" />
            <Text style={styles.routeNavBtnText}>Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.routeClearBtn} onPress={clearRoute}>
            <Ionicons name="close" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Pin detail bottom sheet ── */}
      <Modal visible={!!selectedPin} transparent animationType="slide" onRequestClose={() => setSelectedPin(null)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSelectedPin(null)} />
        {selectedPin && (
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.sheetIconCircle, { backgroundColor: getPinConfig(selectedPin.type).color + '22', borderColor: getPinConfig(selectedPin.type).color }]}>
                <Text style={{ fontSize: 22 }}>{getPinConfig(selectedPin.type).emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetCategory}>{getPinConfig(selectedPin.type).label}</Text>
                <Text style={styles.sheetTitle}>{selectedPin.title}</Text>
                {selectedPin.description ? (
                  <Text style={styles.sheetDesc}>{selectedPin.description}</Text>
                ) : null}
              </View>
            </View>

            {/* Vote row */}
            <View style={styles.voteRow}>
              <TouchableOpacity
                style={[styles.voteBtn, votedPins[selectedPin.id] === 'up' && styles.voteBtnUpActive]}
                onPress={() => handleVote(selectedPin.id, 'up')}
              >
                <Text style={styles.voteBtnEmoji}>👍</Text>
                <Text style={[styles.voteBtnCount, votedPins[selectedPin.id] === 'up' && { color: '#16a34a' }]}>{selectedPin.upvotes}</Text>
                <Text style={styles.voteBtnLabel}>Helpful</Text>
              </TouchableOpacity>
              <View style={styles.voteDivider} />
              <TouchableOpacity
                style={[styles.voteBtn, votedPins[selectedPin.id] === 'down' && styles.voteBtnDownActive]}
                onPress={() => handleVote(selectedPin.id, 'down')}
              >
                <Text style={styles.voteBtnEmoji}>👎</Text>
                <Text style={[styles.voteBtnCount, votedPins[selectedPin.id] === 'down' && { color: '#ef4444' }]}>{selectedPin.downvotes}</Text>
                <Text style={styles.voteBtnLabel}>Not helpful</Text>
              </TouchableOpacity>
            </View>

            {/* Directions button */}
            <TouchableOpacity
              style={styles.directionsBtn}
              onPress={() => handleGetDirectionsPress(selectedPin)}
            >
              <Ionicons name="navigate" size={16} color="#ffffff" />
              <Text style={styles.directionsBtnText}>Get Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPin(null)}>
              <Text style={styles.closeBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* ── POI bottom sheet (native map place tap) ── */}
      <Modal visible={!!selectedPoi} transparent animationType="slide" onRequestClose={() => setSelectedPoi(null)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSelectedPoi(null)} />
        {selectedPoi && (
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.sheetIconCircle, { backgroundColor: '#f97316' + '22', borderColor: '#f97316' }]}>
                <Text style={{ fontSize: 22 }}>📍</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetCategory}>Place</Text>
                <Text style={styles.sheetTitle} numberOfLines={2}>{selectedPoi.name}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.directionsBtn} onPress={handlePoiDirections}>
              <Ionicons name="navigate" size={16} color="#ffffff" />
              <Text style={styles.directionsBtnText}>Get Directions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPoi(null)}>
              <Text style={styles.closeBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* ── Route priority picker modal ── */}
      <Modal visible={showRoutePriorityModal} transparent animationType="fade" onRequestClose={() => setShowRoutePriorityModal(false)}>
        <View style={styles.priorityOverlay}>
          <View style={styles.prioritySheet}>
            <Text style={styles.priorityTitle}>Route preference</Text>
            <Text style={styles.prioritySubtitle}>How should we choose your route?</Text>

            {([
              { key: 'balanced' as const, emoji: '⚖️', label: 'Balanced', desc: 'Best mix of safety & speed' },
              { key: 'safety' as const,   emoji: '🛡️', label: 'Safest',   desc: 'Prioritise low-crime areas' },
              { key: 'speed' as const,    emoji: '⚡', label: 'Fastest',  desc: 'Shortest travel time' },
            ]).map((opt) => (
              <TouchableOpacity key={opt.key} style={styles.priorityOption} onPress={() => fetchRoute(opt.key)}>
                <Text style={styles.priorityEmoji}>{opt.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.priorityOptionLabel}>{opt.label}</Text>
                  <Text style={styles.priorityOptionDesc}>{opt.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.priorityCancel} onPress={() => setShowRoutePriorityModal(false)}>
              <Text style={styles.priorityCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add Pin bottom sheet ── */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => { setShowAddModal(false); setTapLocation(null); }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { setShowAddModal(false); setTapLocation(null); }} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.addSheetHeader}>
            <Text style={styles.addSheetTitle}>Report an incident</Text>
            <View style={[styles.gpsBadge, tapLocation ? styles.gpsBadgeBlue : userLocation ? styles.gpsBadgeGreen : styles.gpsBadgeYellow]}>
              <Text style={styles.gpsBadgeText}>{tapLocation ? '📍 Tapped' : userLocation ? '📍 GPS' : '⚠️ No GPS'}</Text>
            </View>
          </View>

          {/* Type grid */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {PIN_TYPES.map((pt) => (
              <TouchableOpacity
                key={pt.id}
                style={[styles.typeChip, newPinType === pt.id && { backgroundColor: pt.color + '22', borderColor: pt.color }]}
                onPress={() => setNewPinType(pt.id)}
              >
                <Text style={styles.typeEmoji}>{pt.emoji}</Text>
                <Text style={[styles.typeLabel, newPinType === pt.id && { color: pt.color, fontWeight: '700' }]}>{pt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="What's happening here?"
              placeholderTextColor="#9ca3af"
              value={newPinTitle}
              onChangeText={setNewPinTitle}
              maxLength={100}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Details (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="Add more context..."
              placeholderTextColor="#9ca3af"
              value={newPinDesc}
              onChangeText={setNewPinDesc}
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleAddPin}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>{submitting ? 'Reporting…' : 'Report Incident'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },

  // ── Top overlay bar ─────────────────────────────────────
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  searchBoxFocused: {
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },

  // Profile avatar button
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Search dropdown ──────────────────────────────────────
  searchDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 130 : 114,
    left: 12,
    right: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    overflow: 'hidden',
    zIndex: 999,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  searchResultFull: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },

  // ── Filter chips ─────────────────────────────────────────
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    gap: 6,
    paddingRight: 4,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  chipActiveAll: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  chipEmoji: {
    fontSize: 12,
  },

  // ── Left location button ─────────────────────────────────
  locationBtn: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 160 : 144,
    left: 16,
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },

  // ── Right action buttons ─────────────────────────────────
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: Platform.OS === 'ios' ? 216 : 200,
    gap: 8,
  },
  mapActionBtn: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  mapActionBtnActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
  },

  // ── Route loading overlay ────────────────────────────────
  routeLoadingOverlay: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 160 : 144,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  routeLoadingText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Active route info bar ────────────────────────────────
  routeBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 160 : 144,
    left: 12,
    right: 72, // leave room for SOS button on the right
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  routeBarLeft: {
    flex: 1,
    gap: 3,
  },
  routeBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  routeSafetyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  routeSafetyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  routeStats: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  routeWarning: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '500',
  },
  routeClearBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  routeNavBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Pin marker ───────────────────────────────────────────
  pinOuter: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 0,
  },
  pinInner: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinEmoji: {
    fontSize: 17,
  },
  pinCaret: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -1,
  },

  // ── SOS Beacon ───────────────────────────────────────────
  sosBeaconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosPulseRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ef444430',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  sosBeaconCore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Bottom sheets ────────────────────────────────────────
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: -0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 4,
  },

  // Pin detail sheet
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sheetIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  sheetDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 18,
  },
  voteRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    backgroundColor: '#f9fafb',
    overflow: 'hidden',
  },
  voteBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 2,
  },
  voteBtnUpActive: {
    backgroundColor: '#f0fdf4',
  },
  voteBtnDownActive: {
    backgroundColor: '#fef2f2',
  },
  voteDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
  },
  voteBtnEmoji: {
    fontSize: 20,
  },
  voteBtnCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  voteBtnLabel: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
  },

  // Directions button
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  directionsBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  closeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },

  // ── Route priority modal ─────────────────────────────────
  priorityOverlay: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'flex-end',
  },
  prioritySheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 4,
  },
  priorityTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  prioritySubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
  },
  priorityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  priorityEmoji: {
    fontSize: 26,
    width: 36,
    textAlign: 'center',
  },
  priorityOptionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  priorityOptionDesc: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
  priorityCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  priorityCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },

  // Add Pin sheet
  addSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  gpsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  gpsBadgeGreen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  gpsBadgeYellow: {
    backgroundColor: '#fefce8',
    borderColor: '#fef08a',
  },
  gpsBadgeBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  gpsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  typeRow: {
    gap: 8,
    flexDirection: 'row',
  },
  typeChip: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    gap: 4,
    minWidth: 70,
  },
  typeEmoji: {
    fontSize: 22,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  inputWrap: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  inputMulti: {
    minHeight: 72,
  },
  submitBtn: {
    backgroundColor: '#f97316',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Tap-to-place preview marker
  tapPreviewMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3b82f6',
    borderColor: '#ffffff',
    borderWidth: 2,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  fallbackWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc',
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  fallbackText: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
  },
});
