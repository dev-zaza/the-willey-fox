'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Map, Tag, Bell, MessageSquare, Shield, Star, Navigation, ShieldCheck } from 'lucide-react';

import { BottomDock } from '@/components/ui/bottom-dock';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { SearchBar } from '@/components/ui/search-bar';
import { useAuth } from '@/context/auth-context';
import { pins as pinsApi, notifications as notificationsApi, safetyOverlay, type SafetyZoneOverlay } from '@/lib/api';

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
      <div className="text-slate-500 text-sm animate-pulse">Loading map…</div>
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
      return;
    }
    if (!lastBounds) return;
    setSafetyOverlayLoading(true);
    try {
      const res = await safetyOverlay.get(lastBounds);
      setSafetyZones(res.zones ?? []);
      setSafetyOverlayOn(true);
    } catch {
      // Silently ignore
    } finally {
      setSafetyOverlayLoading(false);
    }
  }, [safetyOverlayOn, lastBounds]);

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
          safetyZones={safetyZones}
          center={mapCenter}
          zoom={mapZoom}
          onPinClick={handlePinClick}
          onMapClick={handleMapClick}
          onBoundsChange={handleBoundsChange}
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
              : 'border-surface-border text-slate-400 hover:text-white'
          }`}
          aria-label="Toggle safety overlay"
          title="Safety overlay"
        >
          <ShieldCheck className="w-4 h-4" />
        </button>
        <button
          onClick={() => setModal('directions')}
          className="flex-shrink-0 w-10 h-10 rounded-full glass flex items-center justify-center border border-surface-border text-slate-400 hover:text-white transition-colors"
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
            }}
          />
        )}
      </BottomSheet>
    </div>
  );
}
