'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Map, Tag, Bell, MessageSquare, Shield, Navigation, ShieldCheck, X, LocateFixed, BarChart3, Plus } from 'lucide-react';

import { BottomDock } from '@/components/ui/bottom-dock';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { SearchBar } from '@/components/ui/search-bar';
import { AreaSafetyPanel } from '@/components/dashboard/area-safety-panel';
import { MobileMenuButton } from '@/components/dashboard/mobile-menu-button';
import { useAuth } from '@/context/auth-context';
import { useUserLocation } from '@/hooks/use-user-location';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { pins as pinsApi, notifications as notificationsApi, reports, safetyEngine, users as usersApi, type SafetyZoneOverlay, type H3TileCollection, type AreaSummary, type Report } from '@/lib/api';
import { reversePlaceName, shortPlaceName } from '@/lib/place-name';
import type { H3ClickPayload } from '@/components/map/map-view';

import type { PinData, TrackedItem, ModalState, LatLng } from '@/types';

type AreaPanelSeed = { lat: number; lng: number; name: string };
type SearchedPlace = { label: string; lat: number; lng: number };

// Lazy-load heavy modal components
const PinDetailModal = dynamic(() => import('./modals/pin-detail-modal').then(m => ({ default: m.PinDetailModal })));
const CreatePinModal = dynamic(() => import('./modals/create-pin-modal').then(m => ({ default: m.CreatePinModal })));
const MyTagsModal = dynamic(() => import('./modals/my-tags-modal').then(m => ({ default: m.MyTagsModal })));
const RegisterTagModal = dynamic(() => import('./modals/register-tag-modal').then(m => ({ default: m.RegisterTagModal })));
const TagDetailModal = dynamic(() => import('./modals/tag-detail-modal').then(m => ({ default: m.TagDetailModal })));
const LostAlertsModal = dynamic(() => import('./modals/lost-alerts-modal').then(m => ({ default: m.LostAlertsModal })));
const EmergencyModal = dynamic(() => import('./modals/emergency-modal').then(m => ({ default: m.EmergencyModal })));
const MessagesModal = dynamic(() => import('./modals/messages-modal').then(m => ({ default: m.MessagesModal })));
const NotificationsModal = dynamic(() => import('./modals/notifications-modal').then(m => ({ default: m.NotificationsModal })));
const DirectionsModal = dynamic(() => import('./modals/directions-modal').then(m => ({ default: m.DirectionsModal })));

const MapView = dynamic(() => import('@/components/map/map-view').then(m => ({ default: m.MapView })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-surface flex items-center justify-center">
      <div className="text-[#9d8c7a] text-sm animate-pulse">Loading map…</div>
    </div>
  ),
});

const PANEL_TO_MODAL: Record<string, ModalState> = {
  tags: 'my-tags',
  alerts: 'notifications',
  messages: 'messages',
  emergency: 'emergency',
};

const NAV_MODALS: ModalState[] = [
  'my-tags',
  'notifications',
  'messages',
  'emergency',
  'register-tag',
  'tag-detail',
  'lost-alerts',
];

function PanelUrlSync({ onPanel }: { onPanel: (panel: string | null) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    onPanel(searchParams.get('panel'));
  }, [searchParams, onPanel]);
  return null;
}

function AreaReportUrlSync({ onOpen }: { onOpen: (seed: AreaPanelSeed) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const latStr = searchParams.get('areaLat');
    const lngStr = searchParams.get('areaLng');
    if (!latStr || !lngStr) return;
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    onOpen({ lat, lng, name: searchParams.get('areaName') ?? '' });
    const next = new URLSearchParams(searchParams.toString());
    next.delete('areaLat');
    next.delete('areaLng');
    next.delete('areaName');
    const rest = next.toString();
    router.replace(rest ? `/dashboard?${rest}` : '/dashboard', { scroll: false });
  }, [searchParams, onOpen, router]);
  return null;
}

export function DashboardClient() {
  const { user } = useAuth();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const reduceMotion = useReducedMotion();

  const [modal, setModal] = useState<ModalState>('none');
  const [activeDock, setActiveDock] = useState('map');
  const [mapCenter, setMapCenter] = useState<LatLng | undefined>();
  const [mapZoom, setMapZoom] = useState<number | undefined>();
  const [pins, setPins] = useState<PinData[]>([]);
  const [selectedPin, setSelectedPin] = useState<PinData | null>(null);
  const [selectedTag, setSelectedTag] = useState<TrackedItem | null>(null);
  const [clickedLocation, setClickedLocation] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<LatLng[] | undefined>();
  const [safetyZones, setSafetyZones] = useState<SafetyZoneOverlay[]>([]);
  const [safetyOverlayOn, setSafetyOverlayOn] = useState(false);
  const [safetyOverlayLoading, setSafetyOverlayLoading] = useState(false);
  const [h3Tiles, setH3Tiles] = useState<H3TileCollection | null>(null);
  const [areaSummary, setAreaSummary] = useState<AreaSummary | null>(null);
  const [areaSummaryLoading, setAreaSummaryLoading] = useState(false);
  const [selectedH3, setSelectedH3] = useState<H3ClickPayload | null>(null);
  const [safetyMode, setSafetyMode] = useState<'uk' | 'global'>('uk');
  const [lastBounds, setLastBounds] = useState<{ minLat: number; minLng: number; maxLat: number; maxLng: number } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [locating, setLocating] = useState(false);
  const [searchedPlace, setSearchedPlace] = useState<SearchedPlace | null>(null);
  const [areaPanel, setAreaPanel] = useState<AreaPanelSeed | null>(null);
  const [mapAlert, setMapAlert] = useState<Report | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const {
    location: userLocation,
    permission: locationPermission,
    loading: locationLoading,
    error: locationError,
    requestLocation,
  } = useUserLocation();

  // Sync location to backend when we get a fix
  useEffect(() => {
    if (!user || !userLocation) return;
    usersApi.updateLocation(userLocation.lat, userLocation.lng).catch(() => {});
  }, [user, userLocation?.lat, userLocation?.lng]);

  const closeModal = useCallback(() => {
    setModal('none');
    setActiveDock('map');
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('panel')) {
      router.replace('/dashboard', { scroll: false });
    }
  }, [router]);

  const applyPanel = useCallback((panel: string | null) => {
    if (!panel) {
      setModal((current) => (NAV_MODALS.includes(current) ? 'none' : current));
      return;
    }
    const next = PANEL_TO_MODAL[panel];
    if (next) {
      setModal(next);
      setActiveDock(panel === 'alerts' ? 'alerts' : panel);
    }
  }, []);

  const openAreaPanelFromUrl = useCallback((seed: AreaPanelSeed) => {
    setAreaPanel(seed);
  }, []);

  useEffect(() => {
    if (!areaPanel) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAreaPanel(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [areaPanel]);

  // Center map on first GPS fix (like mobile)
  const hasCenteredOnUser = useRef(false);
  useEffect(() => {
    if (!userLocation || hasCenteredOnUser.current) return;
    hasCenteredOnUser.current = true;
    setMapCenter(userLocation);
    setMapZoom(14);
  }, [userLocation]);

  // Fetch unread notification count on mount
  useEffect(() => {
    if (!user) return;
    notificationsApi
      .list()
      .then((data) => setUnreadCount(data.unreadCount))
      .catch(() => {/* silently ignore */});
    reports
      .list()
      .then((items) => {
        const open = items.find((r) => r.status !== 'resolved' && r.status !== 'found' && r.status !== 'closed');
        setMapAlert(open ?? null);
      })
      .catch(() => {/* silently ignore */});
  }, [user]);

  const handleBoundsChange = useCallback(
    async (bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number }) => {
      setLastBounds(bounds);
      try {
        const data = await pinsApi.list(bounds);
        setPins(data);
      } catch {
        // Silently ignore — map pins are best-effort
      }
    },
    [],
  );

  const toggleSafetyOverlay = useCallback(async () => {
    if (safetyOverlayOn) {
      setSafetyOverlayOn(false);
      setSafetyZones([]);
      setH3Tiles(null);
      setAreaSummary(null);
      setSelectedH3(null);
      return;
    }
    if (!lastBounds) return;
    setSafetyOverlayLoading(true);
    try {
      const [h3Res] = await Promise.all([
        safetyEngine.getTiles(lastBounds, 9),
      ]);
      setH3Tiles(h3Res);
      setSafetyOverlayOn(true);
      const centerLat = searchedPlace?.lat ?? (lastBounds.minLat + lastBounds.maxLat) / 2;
      const centerLng = searchedPlace?.lng ?? (lastBounds.minLng + lastBounds.maxLng) / 2;
      const city = searchedPlace?.label ?? '';
      setAreaSummaryLoading(true);
      safetyEngine.getAreaSummary({ lat: centerLat, lng: centerLng, radius: 5000, city })
        .then(setAreaSummary)
        .catch(() => setAreaSummary(null))
        .finally(() => setAreaSummaryLoading(false));
    } catch {
      // Silently ignore
    } finally {
      setSafetyOverlayLoading(false);
    }
  }, [safetyOverlayOn, lastBounds, searchedPlace]);

  const handleH3Click = useCallback((props: H3ClickPayload) => {
    setSelectedH3(props);
  }, []);

  const openAreaReport = useCallback(async (opts?: { lat?: number; lng?: number; name?: string }) => {
    const lat = opts?.lat ?? selectedH3?.lat ?? searchedPlace?.lat ?? mapCenter?.lat ?? userLocation?.lat;
    const lng = opts?.lng ?? selectedH3?.lng ?? searchedPlace?.lng ?? mapCenter?.lng ?? userLocation?.lng;
    let name = (opts?.name || searchedPlace?.label || areaSummary?.cityName || '').trim();
    if (lat == null || lng == null) return;
    if (!name) {
      name = await reversePlaceName(lat, lng);
    }
    if (isDesktop) {
      setAreaPanel({ lat, lng, name });
      return;
    }
    const qs = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    });
    if (name) qs.set('name', name);
    router.push(`/dashboard/area?${qs}`);
  }, [selectedH3, searchedPlace, mapCenter, userLocation, areaSummary, isDesktop, router]);

  function handleDockSelect(id: string) {
    setActiveDock(id);
    if (id === 'tags') setModal('my-tags');
    else if (id === 'alerts') setModal('notifications');
    else if (id === 'messages') setModal('messages');
    else if (id === 'emergency') setModal('emergency');
    else closeModal();
  }

  async function handleRecenterToUser() {
    setLocating(true);
    const loc = await requestLocation();
    setLocating(false);
    if (loc) {
      setMapCenter(loc);
      setMapZoom(15);
    }
  }

  function handlePinClick(pin: PinData) {
    setSelectedPin(pin);
    setModal('pin-detail');
  }

  function handleMapLongPress(latlng: LatLng) {
    setClickedLocation(latlng);
    if (modal === 'none') setModal('create-pin');
  }

  function handleSearchSelect(result: { label: string; location: LatLng }) {
    const label = shortPlaceName(result.label);
    const place = { label, lat: result.location.lat, lng: result.location.lng };
    setSearchedPlace(place);
    setMapCenter(result.location);
    setMapZoom(15);
    if (safetyOverlayOn) {
      setAreaSummaryLoading(true);
      safetyEngine.getAreaSummary({ lat: place.lat, lng: place.lng, radius: 5000, city: label })
        .then(setAreaSummary)
        .catch(() => setAreaSummary(null))
        .finally(() => setAreaSummaryLoading(false));
    }
  }

  function handleTagSelect(tag: TrackedItem) {
    setSelectedTag(tag);
    setModal('tag-detail');
  }

  const toolBtn =
    'flex-shrink-0 h-11 w-11 cursor-pointer rounded-xl glass flex items-center justify-center border transition-colors duration-200';

  return (
    <div className="fixed inset-0 bg-surface flex flex-col overflow-hidden lg:left-[var(--desktop-rail)]">
      <Suspense fallback={null}>
        <PanelUrlSync onPanel={applyPanel} />
        <AreaReportUrlSync onOpen={openAreaPanelFromUrl} />
      </Suspense>
      {/* Map — full screen */}
      <div className="absolute inset-0 z-0">
        <MapView
          pins={pins}
          route={route}
          safetyZones={safetyOverlayOn ? safetyZones : []}
          h3Tiles={safetyOverlayOn ? h3Tiles : null}
          center={mapCenter}
          zoom={mapZoom}
          userLocation={userLocation}
          onPinClick={handlePinClick}
          onMapLongPress={handleMapLongPress}
          onBoundsChange={handleBoundsChange}
          onH3Click={handleH3Click}
        />
      </div>

      {/* Top bar — mobile only */}
      <div className="relative z-10 flex items-center gap-2 px-3 pt-safe pt-3 pb-2 lg:hidden">
        <MobileMenuButton />
        <div className="min-w-0 flex-1">
          <SearchBar onSelect={handleSearchSelect} />
        </div>
        <button
          onClick={toggleSafetyOverlay}
          disabled={safetyOverlayLoading}
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border glass transition-colors ${
            safetyOverlayOn
              ? 'border-green-500/50 bg-green-500/20 text-green-400'
              : 'border-surface-border text-[#7a6957] hover:text-white'
          }`}
          aria-label="Toggle safety overlay"
          title="Safety overlay"
        >
          <ShieldCheck className="h-4 w-4" />
        </button>
        <button
          onClick={() => { void openAreaReport(); }}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-surface-border glass text-[#FF7B14] transition-colors hover:text-brand-400"
          aria-label="Area safety report"
          title="Area safety & travel guide"
        >
          <BarChart3 className="h-4 w-4" />
        </button>
        <button
          onClick={handleRecenterToUser}
          disabled={locating || locationLoading}
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border glass transition-colors ${
            userLocation
              ? 'border-blue-500/40 text-blue-500'
              : 'border-surface-border text-[#7a6957] hover:text-white'
          }`}
          aria-label="My location"
          title={locationError ?? 'Center map on your location'}
        >
          <LocateFixed className={`h-4 w-4 ${locating || locationLoading ? 'animate-pulse' : ''}`} />
        </button>
        <button
          onClick={() => router.push('/dashboard/profile')}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-500/30 glass text-sm font-bold text-brand-400"
          aria-label="Profile"
          title="Profile"
        >
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            user?.firstName?.[0]?.toUpperCase() ?? 'U'
          )}
        </button>
      </div>

      {/* Desktop overlay chrome — search + UK/Global left, tools right */}
      <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
        <div className="pointer-events-auto absolute left-4 top-4 z-30 flex max-w-[calc(100%-420px)] flex-wrap items-start gap-2">
          <div className="w-[min(344px,var(--desktop-panel))]">
            <SearchBar onSelect={handleSearchSelect} placeholder="Search a city or country…" />
          </div>
          <div className="flex overflow-hidden rounded-xl border border-[#D8CBB6] bg-white shadow-[0_10px_26px_-14px_rgba(23,19,15,.5)]">
            {(['uk', 'global'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSafetyMode(m);
                  if (!safetyOverlayOn) void toggleSafetyOverlay();
                }}
                className={`px-3.5 py-2.5 text-xs font-bold ${
                  safetyMode === m ? 'bg-[#17130F] text-white' : 'text-[#5C5245] hover:bg-[#FBF7F1]'
                }`}
              >
                {m === 'uk' ? 'UK · Live data' : 'Global · 186 countries'}
              </button>
            ))}
          </div>
        </div>

        {mapAlert && !alertDismissed ? (
          <div className="pointer-events-auto absolute left-4 top-[4.75rem] z-20 flex max-w-md items-center gap-3 rounded-2xl border border-[#D8CBB6] bg-white px-3 py-2.5 shadow-lg">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-black text-white">
              !
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#17130F]">Lost item reported</p>
              <p className="truncate text-xs text-[#8A7B67]">
                {mapAlert.locationAddress || mapAlert.finderNotes || 'Open inbox for details'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/alerts/${mapAlert.id}`)}
              className="rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-bold text-white"
            >
              Help
            </button>
            <button
              type="button"
              onClick={() => setAlertDismissed(true)}
              className="text-[#8A7B67] hover:text-[#17130F]"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div
          className={`pointer-events-auto absolute top-4 flex flex-col gap-2 ${
            areaPanel ? 'right-[calc(var(--desktop-panel)+1.5rem)]' : safetyOverlayOn ? 'right-[22rem]' : 'right-4'
          }`}
        >
          <button
            type="button"
            onClick={toggleSafetyOverlay}
            disabled={safetyOverlayLoading}
            className={`${toolBtn} ${
              safetyOverlayOn
                ? 'border-green-500/50 bg-green-500/15 text-green-700'
                : 'border-surface-border text-[#7a6957] hover:text-[var(--text-primary)]'
            }`}
            aria-label="Toggle safety overlay"
            title="Safety overlay"
          >
            <ShieldCheck className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { void openAreaReport(); }}
            className={`${toolBtn} border-surface-border text-[#FF7B14] hover:text-brand-500`}
            aria-label="Area safety report"
            title="Area safety & travel guide"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRecenterToUser}
            disabled={locating || locationLoading}
            className={`${toolBtn} ${
              userLocation
                ? 'border-blue-500/40 text-blue-500'
                : 'border-surface-border text-[#7a6957] hover:text-[var(--text-primary)]'
            }`}
            aria-label="My location"
            title={locationError ?? 'Center map on your location'}
          >
            <LocateFixed className={`h-4 w-4 ${locating || locationLoading ? 'animate-pulse' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setModal('directions')}
            className={`${toolBtn} border-surface-border text-[#7a6957] hover:text-[var(--text-primary)]`}
            aria-label="Directions"
            title="Get directions"
          >
            <Navigation className="h-4 w-4" />
          </button>
        </div>

        <div className="pointer-events-auto absolute bottom-8 left-4 z-20 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModal('create-pin')}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D8CBB6] bg-white px-3.5 text-[13px] font-bold text-[#17130F] shadow-[0_8px_22px_-12px_rgba(23,19,15,.5)]"
          >
            <Plus className="h-4 w-4" />
            Report
          </button>
          <button
            type="button"
            onClick={() => setModal('emergency')}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-3.5 text-[13px] font-bold text-white shadow-[0_8px_22px_-12px_rgba(23,19,15,.5)]"
          >
            SOS
          </button>
        </div>
      </div>

      {/* Active route banner */}
      {route && route.length >= 2 && (
        <div className="absolute top-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-surface-border glass px-4 py-2 shadow-lg lg:top-4">
          <Navigation className="w-3.5 h-3.5 text-brand-500" />
          <span className="text-xs font-medium text-[var(--text-primary)]">Route active</span>
          <button
            onClick={() => setRoute(undefined)}
            className="ml-1 text-[#7a6957] hover:text-brand-500 transition-colors"
            aria-label="Clear route"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* GPS status */}
      <div className="absolute left-4 bottom-24 z-20 lg:bottom-[4.75rem]">
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold glass border shadow-sm ${
            userLocation
              ? 'border-green-500/30 text-green-600'
              : locationPermission === 'denied'
                ? 'border-amber-500/30 text-amber-600'
                : 'border-surface-border text-[#7a6957]'
          }`}
        >
          <LocateFixed className="h-3 w-3" />
          {userLocation ? 'GPS' : locationPermission === 'denied' ? 'No GPS' : locating || locationLoading ? 'Locating…' : 'No GPS'}
        </div>
      </div>

      {/* FAB — create pin */}
      <button
        onClick={() => setModal('create-pin')}
        className={`absolute z-20 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-brand-500 text-2xl text-white shadow-lg brand-glow transition-transform hover:scale-105 hover:bg-brand-600 active:scale-95 bottom-24 right-4 lg:bottom-8 ${
          areaPanel ? 'lg:right-[calc(var(--desktop-panel)+1.5rem)]' : safetyOverlayOn ? 'lg:right-[22rem]' : 'lg:right-4'
        }`}
        aria-label="Add pin"
      >
        +
      </button>

      {/* Bottom dock — 5 core items; People / Places / Shop / Account in hamburger */}
      <BottomDock
        items={[
          { id: 'map', icon: <Map className="w-5 h-5" />, label: 'Map' },
          { id: 'tags', icon: <Tag className="w-5 h-5" />, label: 'My Tags' },
          { id: 'alerts', icon: <Bell className="w-5 h-5" />, label: 'Alerts', badge: unreadCount },
          { id: 'messages', icon: <MessageSquare className="w-5 h-5" />, label: 'Messages' },
          { id: 'emergency', icon: <Shield className="w-5 h-5" />, label: 'SOS' },
        ]}
        activeId={activeDock}
        onSelect={handleDockSelect}
      />

      {/* ── Modals ── */}

      <BottomSheet open={modal === 'pin-detail'} onClose={closeModal} title={selectedPin?.title}>
        {modal === 'pin-detail' && selectedPin && (
          <PinDetailModal pin={selectedPin} onClose={closeModal} />
        )}
      </BottomSheet>

      <BottomSheet open={modal === 'create-pin'} onClose={closeModal} title="Add pin" snapPoint="full">
        {modal === 'create-pin' && (
          <CreatePinModal
            location={clickedLocation}
            onClose={closeModal}
            onCreated={(pin) => {
              setPins((prev) => [...prev, pin]);
              closeModal();
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet open={modal === 'my-tags'} onClose={closeModal} title="My Tags" snapPoint="full">
        {modal === 'my-tags' && (
          <MyTagsModal
            onClose={closeModal}
            onTagSelect={handleTagSelect}
            onRegister={() => setModal('register-tag')}
          />
        )}
      </BottomSheet>

      <BottomSheet open={modal === 'register-tag'} onClose={closeModal} title="Register Tag" snapPoint="full">
        {modal === 'register-tag' && (
          <RegisterTagModal onClose={closeModal} onCreated={() => setModal('my-tags')} />
        )}
      </BottomSheet>

      <BottomSheet open={modal === 'tag-detail'} onClose={closeModal} title={selectedTag?.label} snapPoint="full">
        {modal === 'tag-detail' && selectedTag && (
          <TagDetailModal tag={selectedTag} onClose={closeModal} />
        )}
      </BottomSheet>

      <BottomSheet open={modal === 'lost-alerts'} onClose={closeModal} title="Lost Alerts" snapPoint="full">
        {modal === 'lost-alerts' && <LostAlertsModal onClose={closeModal} />}
      </BottomSheet>

      <BottomSheet open={modal === 'emergency'} onClose={closeModal} title="Emergency" snapPoint="full">
        {modal === 'emergency' && <EmergencyModal onClose={closeModal} />}
      </BottomSheet>

      <BottomSheet open={modal === 'messages'} onClose={closeModal} title="Messages" snapPoint="full">
        {modal === 'messages' && <MessagesModal onClose={closeModal} />}
      </BottomSheet>

      <BottomSheet open={modal === 'notifications'} onClose={closeModal} title="Notifications" snapPoint="full">
        {modal === 'notifications' && (
          <NotificationsModal
            onClose={closeModal}
            onMarkRead={() => setUnreadCount(0)}
          />
        )}
      </BottomSheet>

      <BottomSheet open={modal === 'directions'} onClose={closeModal} title="Directions" snapPoint="full">
        {modal === 'directions' && (
          <DirectionsModal
            onRouteSelect={(r) => {
              setRoute(r);
              closeModal();
              if (r.length > 0) {
                const lats = r.map(p => p.lat);
                const lngs = r.map(p => p.lng);
                const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                const spanLat = Math.max(...lats) - Math.min(...lats);
                const spanLng = Math.max(...lngs) - Math.min(...lngs);
                const span = Math.max(spanLat, spanLng);
                const zoom = span > 2 ? 9 : span > 1 ? 10 : span > 0.5 ? 11 : span > 0.2 ? 12 : 13;
                setMapCenter({ lat: midLat, lng: midLng });
                setMapZoom(zoom);
              }
            }}
          />
        )}
      </BottomSheet>

      {/* ── Safety panel (desktop, shown when overlay on) ── */}
      {safetyOverlayOn && !areaPanel && (
        <div className="fixed z-20 hidden w-80 flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-card shadow-xl lg:flex"
          style={{ top: '5.5rem', right: '1rem', bottom: '1rem' }}
        >
          <div className="flex items-center justify-between border-b border-surface-border px-5 py-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <span className="text-sm font-bold text-[var(--text-primary)]">Safety Report</span>
            </div>
            <button
              type="button"
              onClick={() => { setSafetyOverlayOn(false); setH3Tiles(null); setAreaSummary(null); }}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[#7a6957] transition-colors hover:bg-surface-elevated hover:text-[var(--text-primary)]"
              aria-label="Close safety report"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="flex overflow-hidden rounded-lg border border-surface-border text-xs font-semibold">
              {(['uk', 'global'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSafetyMode(m)}
                  className={`flex-1 cursor-pointer py-2.5 transition-colors ${safetyMode === m ? 'bg-green-500/15 text-green-700' : 'text-[#7a6957] hover:text-[var(--text-primary)]'}`}
                >
                  {m === 'uk' ? 'UK Mode' : 'Global Mode'}
                </button>
              ))}
            </div>

            {areaSummaryLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              </div>
            ) : areaSummary ? (
              <>
                <div className="flex items-center gap-4 rounded-xl bg-surface-elevated p-4">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full border-2 text-xl font-black"
                    style={{ borderColor: SIDEBAR_BAND_META[areaSummary.band ?? '']?.color ?? '#888', color: SIDEBAR_BAND_META[areaSummary.band ?? '']?.color ?? '#888' }}
                  >
                    {areaSummary.score != null ? Math.round(areaSummary.score) : '–'}
                  </div>
                  <div>
                    <div className="text-base font-bold text-[var(--text-primary)]">
                      {SIDEBAR_BAND_META[areaSummary.band ?? '']?.label ?? areaSummary.band ?? 'No Data'}
                    </div>
                    <div className="mt-1 text-xs text-[#7a6957]">
                      {areaSummary.cityName || searchedPlace?.label || 'Current area'}
                    </div>
                    <div className="mt-0.5 text-xs text-[#7a6957]">
                      {areaSummary.incidentCount.toLocaleString()} crimes · {areaSummary.dataMonth}
                    </div>
                  </div>
                </div>

                <div className="flex h-2 gap-1 overflow-hidden rounded-md">
                  {['#D7263D', '#F46036', '#FFC857', '#A4C957', '#3FA34D'].map((c, i) => {
                    const bandNum = SIDEBAR_BAND_META[areaSummary.band ?? '']?.num ?? 0;
                    return <div key={i} style={{ flex: 1, backgroundColor: c, opacity: (bandNum > 0 && i + 1 === bandNum) ? 1 : 0.2 }} />;
                  })}
                </div>

                <div className="text-[10px] text-[#7a6957]">{areaSummary.scoreMethodology}</div>

                <button
                  type="button"
                  onClick={() => {
                    void openAreaReport({
                      lat: areaSummary.lat,
                      lng: areaSummary.lng,
                      name: searchedPlace?.label || areaSummary.cityName,
                    });
                  }}
                  className="w-full cursor-pointer rounded-lg border border-green-600/30 bg-green-500/10 py-2.5 text-xs font-semibold text-green-700 hover:bg-green-500/20"
                >
                  Full report & travel guide →
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-surface-elevated p-3 text-center">
                    <div className="text-lg font-black text-[var(--text-primary)]">{areaSummary.incidentCount.toLocaleString()}</div>
                    <div className="text-[10px] text-[#7a6957]">Crimes Recorded</div>
                  </div>
                  <div className="rounded-lg bg-surface-elevated p-3 text-center">
                    <div className="text-lg font-black text-[var(--text-primary)]">{areaSummary.weightedPerKm2}</div>
                    <div className="text-[10px] text-[#7a6957]">Weighted/km²</div>
                  </div>
                </div>

                {areaSummary.crimeBreakdown.length > 0 && (
                  <div className="rounded-xl bg-surface-elevated p-4">
                    <div className="mb-3 text-xs font-bold text-[var(--text-primary)]">Crime Breakdown</div>
                    <div className="flex flex-col gap-2">
                      {areaSummary.crimeBreakdown.slice(0, 6).map((item, i) => {
                        const colors = ['#D7263D', '#F46036', '#FFC857', '#A4C957', '#3FA34D', '#2196F3'];
                        const topTotal = areaSummary.crimeBreakdown.slice(0, 6).reduce((s, x) => s + x.count, 0);
                        const pct = topTotal > 0 ? (item.count / topTotal) * 100 : 0;
                        return (
                          <div key={item.type}>
                            <div className="mb-1 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[i] }} />
                                <span className="max-w-[140px] truncate text-[11px] text-[#5a4a3d]">
                                  {item.type.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                </span>
                              </div>
                              <span className="text-[11px] font-semibold text-[#7a6957]">{item.count.toLocaleString()}</span>
                            </div>
                            <div className="h-1 rounded bg-surface-border">
                              <div className="h-1 rounded" style={{ backgroundColor: colors[i], width: `${Math.round(pct)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-4 text-center text-xs text-[#7a6957]">
                Click a hex cell to view safety data
              </div>
            )}

            {selectedH3 && (
              <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)]">Selected Cell</span>
                  <button type="button" onClick={() => setSelectedH3(null)} className="cursor-pointer text-[#7a6957] hover:text-[var(--text-primary)]" aria-label="Clear selected cell">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black"
                    style={{ borderColor: selectedH3.color, color: selectedH3.color }}
                  >
                    {selectedH3.score != null ? Math.round(selectedH3.score) : '–'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {SIDEBAR_BAND_META[selectedH3.band]?.label ?? selectedH3.band}
                    </div>
                    <div className="text-xs text-[#7a6957]">{selectedH3.incidentCount} incidents</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void openAreaReport({
                      lat: selectedH3.lat,
                      lng: selectedH3.lng,
                    });
                  }}
                  className="mt-3 w-full cursor-pointer rounded-lg bg-brand-500/15 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-500/25"
                >
                  View area report & travel guide
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Area Safety right slider (desktop) ── */}
      <AnimatePresence>
        {areaPanel && (
          <motion.div
            role="dialog"
            aria-modal="false"
            aria-label="Area Safety"
            initial={reduceMotion ? { opacity: 0 } : { x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: 24, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'tween', duration: 0.22, ease: [0.22, 1, 0.36, 1] }
            }
            className="fixed z-30 hidden min-h-0 overflow-hidden rounded-2xl border border-surface-border bg-surface-card shadow-xl lg:flex lg:flex-col"
            style={{
              top: '5.5rem',
              right: '1rem',
              bottom: '1rem',
              width: 'var(--desktop-panel)',
            }}
          >
            <AreaSafetyPanel
              key={`${areaPanel.lat}-${areaPanel.lng}-${areaPanel.name}`}
              seedLat={areaPanel.lat}
              seedLng={areaPanel.lng}
              seedName={areaPanel.name}
              variant="panel"
              onClose={() => setAreaPanel(null)}
              onFlyTo={(lat, lng, name) => {
                setMapCenter({ lat, lng });
                setMapZoom(12);
                setAreaPanel({ lat, lng, name });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SIDEBAR_BAND_META: Record<string, { label: string; color: string; num: number }> = {
  band5:     { label: 'Safe',         color: '#3FA34D', num: 5 },
  band4:     { label: 'Low Risk',     color: '#A4C957', num: 4 },
  band3:     { label: 'Stay Aware',   color: '#FFC857', num: 3 },
  band2:     { label: 'Elevated',     color: '#F46036', num: 2 },
  band1:     { label: 'High Caution', color: '#D7263D', num: 1 },
  low_count: { label: 'Low Data',     color: '#9ED2B2', num: 0 },
  green:     { label: 'Safe',         color: '#3FA34D', num: 5 },
  amber:     { label: 'Stay Aware',   color: '#FFC857', num: 3 },
  red:       { label: 'High Caution', color: '#D7263D', num: 1 },
  purple:    { label: 'High Caution', color: '#D7263D', num: 1 },
};
