'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Map, Tag, Bell, MessageSquare, Shield, Star, Navigation, ShieldCheck, X } from 'lucide-react';

import { BottomDock } from '@/components/ui/bottom-dock';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { SearchBar } from '@/components/ui/search-bar';
import { useAuth } from '@/context/auth-context';
import { pins as pinsApi, notifications as notificationsApi, safetyEngine, type SafetyZoneOverlay, type H3TileCollection, type AreaSummary } from '@/lib/api';

import type { PinData, TrackedItem, ModalState, LatLng } from '@/types';

// Lazy-load heavy modal components
const PinDetailModal = dynamic(() => import('./modals/pin-detail-modal').then(m => ({ default: m.PinDetailModal })));
const CreatePinModal = dynamic(() => import('./modals/create-pin-modal').then(m => ({ default: m.CreatePinModal })));
const MyTagsModal = dynamic(() => import('./modals/my-tags-modal').then(m => ({ default: m.MyTagsModal })));
const RegisterTagModal = dynamic(() => import('./modals/register-tag-modal').then(m => ({ default: m.RegisterTagModal })));
const TagDetailModal = dynamic(() => import('./modals/tag-detail-modal').then(m => ({ default: m.TagDetailModal })));
const LostAlertsModal = dynamic(() => import('./modals/lost-alerts-modal').then(m => ({ default: m.LostAlertsModal })));
const ProfileModal = dynamic(() => import('./modals/profile-modal').then(m => ({ default: m.ProfileModal })));
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

export function DashboardClient() {
  const { user } = useAuth();
  const router = useRouter();

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
  const [selectedH3, setSelectedH3] = useState<{ h3: string; score: number | null; band: string; color: string; incidentCount: number } | null>(null);
  const [safetyMode, setSafetyMode] = useState<'uk' | 'global'>('uk');
  const [lastBounds, setLastBounds] = useState<{ minLat: number; minLng: number; maxLat: number; maxLng: number } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const closeModal = useCallback(() => setModal('none'), []);

  // Fetch unread notification count on mount
  useEffect(() => {
    if (!user) return;
    notificationsApi
      .list()
      .then((data) => setUnreadCount(data.unreadCount))
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
      // Load area summary for map centre
      const centerLat = (lastBounds.minLat + lastBounds.maxLat) / 2;
      const centerLng = (lastBounds.minLng + lastBounds.maxLng) / 2;
      setAreaSummaryLoading(true);
      safetyEngine.getAreaSummary({ lat: centerLat, lng: centerLng, radius: 5000 })
        .then(setAreaSummary)
        .catch(() => setAreaSummary(null))
        .finally(() => setAreaSummaryLoading(false));
    } catch {
      // Silently ignore
    } finally {
      setSafetyOverlayLoading(false);
    }
  }, [safetyOverlayOn, lastBounds]);

  const handleH3Click = useCallback((props: { h3: string; score: number | null; band: string; color: string; incidentCount: number }) => {
    setSelectedH3(props);
  }, []);

  function handleDockSelect(id: string) {
    setActiveDock(id);
    if (id === 'tags') setModal('my-tags');
    else if (id === 'alerts') setModal('notifications');
    else if (id === 'messages') setModal('messages');
    else if (id === 'emergency') setModal('emergency');
    else if (id === 'places') { router.push('/dashboard/places'); return; }
    else closeModal();
  }

  function handlePinClick(pin: PinData) {
    setSelectedPin(pin);
    setModal('pin-detail');
  }

  function handleMapClick(latlng: LatLng) {
    setClickedLocation(latlng);
    if (modal === 'none') setModal('create-pin');
  }

  function handleSearchSelect(result: { label: string; location: LatLng }) {
    setMapCenter(result.location);
    setMapZoom(15);
  }

  function handleTagSelect(tag: TrackedItem) {
    setSelectedTag(tag);
    setModal('tag-detail');
  }

  return (
    <div className="fixed inset-0 bg-surface flex flex-col overflow-hidden">
      {/* Map — full screen */}
      <div className="absolute inset-0 z-0">
        <MapView
          pins={pins}
          route={route}
          safetyZones={safetyOverlayOn ? safetyZones : []}
          h3Tiles={safetyOverlayOn ? h3Tiles : null}
          center={mapCenter}
          zoom={mapZoom}
          onPinClick={handlePinClick}
          onMapClick={handleMapClick}
          onBoundsChange={handleBoundsChange}
          onH3Click={handleH3Click}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center gap-2 px-4 pt-safe pt-4 pb-2">
        <div className="flex-1">
          <SearchBar onSelect={handleSearchSelect} />
        </div>
        <button
          onClick={toggleSafetyOverlay}
          disabled={safetyOverlayLoading}
          className={`flex-shrink-0 w-10 h-10 rounded-full glass flex items-center justify-center border transition-colors ${
            safetyOverlayOn
              ? 'bg-green-500/20 border-green-500/50 text-green-400'
              : 'border-surface-border text-[#7a6957] hover:text-white'
          }`}
          aria-label="Toggle safety overlay"
          title="Safety overlay"
        >
          <ShieldCheck className="w-4 h-4" />
        </button>
        {safetyOverlayOn && (
          <button
            onClick={() => setSafetyMode((m) => m === 'uk' ? 'global' : 'uk')}
            className="flex-shrink-0 h-10 px-3 rounded-full glass flex items-center justify-center border border-surface-border text-[#7a6957] hover:text-white transition-colors text-xs font-semibold"
            title="Toggle UK / Global mode"
          >
            {safetyMode === 'uk' ? '🇬🇧 UK' : '🌍 Global'}
          </button>
        )}
        <button
          onClick={() => setModal('directions')}
          className="flex-shrink-0 w-10 h-10 rounded-full glass flex items-center justify-center border border-surface-border text-[#7a6957] hover:text-white transition-colors"
          aria-label="Directions"
          title="Get directions"
        >
          <Navigation className="w-4 h-4" />
        </button>
        <button
          onClick={() => setModal('profile')}
          className="flex-shrink-0 w-10 h-10 rounded-full glass flex items-center justify-center text-sm font-bold text-brand-400 border border-brand-500/30"
          aria-label="Profile"
        >
          {user?.firstName?.[0]?.toUpperCase() ?? 'U'}
        </button>
      </div>

      {/* Active route banner */}
      {route && route.length >= 2 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 glass px-4 py-2 rounded-full border border-surface-border shadow-lg">
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

      {/* FAB — create pin */}
      <button
        onClick={() => setModal('create-pin')}
        className="absolute right-4 bottom-24 z-20 w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-2xl flex items-center justify-center shadow-lg brand-glow transition-transform hover:scale-105 active:scale-95"
        aria-label="Add pin"
      >
        +
      </button>

      {/* Bottom dock */}
      <BottomDock
        items={[
          { id: 'map', icon: <Map className="w-5 h-5" />, label: 'Map' },
          { id: 'tags', icon: <Tag className="w-5 h-5" />, label: 'My Tags' },
          { id: 'alerts', icon: <Bell className="w-5 h-5" />, label: 'Alerts', badge: unreadCount },
          { id: 'messages', icon: <MessageSquare className="w-5 h-5" />, label: 'Messages' },
          { id: 'places', icon: <Star className="w-5 h-5" />, label: 'Places' },
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

      <BottomSheet open={modal === 'profile'} onClose={closeModal} title="Profile">
        {modal === 'profile' && <ProfileModal onClose={closeModal} />}
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

      {/* ── Safety Sidebar (desktop, shown when overlay on) ── */}
      {safetyOverlayOn && (
        <div className="hidden md:flex fixed top-0 right-0 bottom-0 z-20 w-80 flex-col bg-[#1a1d27] border-l border-[#2a2f45] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2f45]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-400" />
              <span className="text-sm font-bold text-white">Safety Report</span>
            </div>
            <button onClick={() => { setSafetyOverlayOn(false); setH3Tiles(null); setAreaSummary(null); }} className="text-[#64748b] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {/* UK/Global toggle */}
            <div className="flex rounded-lg border border-[#2a2f45] overflow-hidden text-xs font-semibold">
              {(['uk', 'global'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSafetyMode(m)}
                  className={`flex-1 py-2 transition-colors ${safetyMode === m ? 'bg-green-500/20 text-green-400' : 'text-[#64748b] hover:text-white'}`}
                >
                  {m === 'uk' ? '🇬🇧 UK Mode' : '🌍 Global Mode'}
                </button>
              ))}
            </div>

            {/* Score card */}
            {areaSummaryLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : areaSummary ? (
              <>
                <div className="bg-[#0f1117] rounded-xl p-4 flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black border-2"
                    style={{ borderColor: SIDEBAR_BAND_META[areaSummary.band ?? '']?.color ?? '#888', color: SIDEBAR_BAND_META[areaSummary.band ?? '']?.color ?? '#888' }}
                  >
                    {areaSummary.score != null ? Math.round(areaSummary.score) : '–'}
                  </div>
                  <div>
                    <div className="text-base font-bold text-white">
                      {SIDEBAR_BAND_META[areaSummary.band ?? '']?.label ?? areaSummary.band ?? 'No Data'}
                    </div>
                    <div className="text-xs text-[#64748b] mt-1">
                      {areaSummary.cityName || 'Current area'}
                    </div>
                    <div className="text-xs text-[#64748b] mt-0.5">
                      {areaSummary.incidentCount.toLocaleString()} crimes · {areaSummary.dataMonth}
                    </div>
                  </div>
                </div>

                {/* Band strip */}
                <div className="flex gap-1 rounded-md overflow-hidden h-2">
                  {['#D7263D', '#F46036', '#FFC857', '#A4C957', '#3FA34D'].map((c, i) => {
                    const bandNum = SIDEBAR_BAND_META[areaSummary.band ?? '']?.num ?? 0;
                    return <div key={i} style={{ flex: 1, backgroundColor: c, opacity: (bandNum > 0 && i + 1 === bandNum) ? 1 : 0.2 }} />;
                  })}
                </div>

                <div className="text-[10px] text-[#64748b]">{areaSummary.scoreMethodology}</div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0f1117] rounded-lg p-3 text-center">
                    <div className="text-lg font-black text-white">{areaSummary.incidentCount.toLocaleString()}</div>
                    <div className="text-[10px] text-[#64748b]">Crimes Recorded</div>
                  </div>
                  <div className="bg-[#0f1117] rounded-lg p-3 text-center">
                    <div className="text-lg font-black text-white">{areaSummary.weightedPerKm2}</div>
                    <div className="text-[10px] text-[#64748b]">Weighted/km²</div>
                  </div>
                </div>

                {/* Crime breakdown */}
                {areaSummary.crimeBreakdown.length > 0 && (
                  <div className="bg-[#0f1117] rounded-xl p-4">
                    <div className="text-xs font-bold text-white mb-3">Crime Breakdown</div>
                    <div className="flex flex-col gap-2">
                      {areaSummary.crimeBreakdown.slice(0, 6).map((item, i) => {
                        const colors = ['#D7263D', '#F46036', '#FFC857', '#A4C957', '#3FA34D', '#2196F3'];
                        const topTotal = areaSummary.crimeBreakdown.slice(0, 6).reduce((s, x) => s + x.count, 0);
                        const pct = topTotal > 0 ? (item.count / topTotal) * 100 : 0;
                        return (
                          <div key={item.type}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i] }} />
                                <span className="text-[11px] text-[#94a3b8] truncate max-w-[140px]">
                                  {item.type.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                </span>
                              </div>
                              <span className="text-[11px] font-semibold text-[#64748b]">{item.count.toLocaleString()}</span>
                            </div>
                            <div className="h-1 rounded bg-[#2a2f45]">
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
              <div className="text-xs text-[#64748b] text-center py-4">
                Click a hex cell to view safety data
              </div>
            )}

            {/* Selected hex detail */}
            {selectedH3 && (
              <div className="bg-[#0f1117] rounded-xl p-4 border border-[#2a2f45]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white">Selected Cell</span>
                  <button onClick={() => setSelectedH3(null)} className="text-[#64748b] hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border"
                    style={{ borderColor: selectedH3.color, color: selectedH3.color }}
                  >
                    {selectedH3.score != null ? Math.round(selectedH3.score) : '–'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {SIDEBAR_BAND_META[selectedH3.band]?.label ?? selectedH3.band}
                    </div>
                    <div className="text-xs text-[#64748b]">{selectedH3.incidentCount} incidents</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
