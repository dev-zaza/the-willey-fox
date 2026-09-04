'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Bell, Map, MessageSquare, Shield, Tag } from 'lucide-react';
import { BottomDock, type DockItem } from '@/components/ui/bottom-dock';

/** Core 5 — everything else lives in the hamburger drawer. */
const DOCK_IDS = ['map', 'tags', 'alerts', 'messages', 'emergency'] as const;

export function MobileDashboardDock({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();

  const items: DockItem[] = [
    { id: 'map', icon: <Map className="h-5 w-5" />, label: 'Map' },
    { id: 'tags', icon: <Tag className="h-5 w-5" />, label: 'My Tags' },
    { id: 'alerts', icon: <Bell className="h-5 w-5" />, label: 'Alerts', badge: unreadCount },
    { id: 'messages', icon: <MessageSquare className="h-5 w-5" />, label: 'Messages' },
    { id: 'emergency', icon: <Shield className="h-5 w-5" />, label: 'SOS' },
  ];

  let activeId: string = 'map';
  if (pathname.startsWith('/dashboard/qr')) activeId = 'tags';
  else if (
    pathname.startsWith('/dashboard/notifications') ||
    pathname.startsWith('/dashboard/alerts') ||
    pathname.startsWith('/dashboard/reports')
  ) {
    activeId = 'alerts';
  } else if (pathname.startsWith('/dashboard/messages')) activeId = 'messages';
  else if (pathname.startsWith('/dashboard/emergency')) activeId = 'emergency';
  else if (pathname === '/dashboard') activeId = 'map';
  else activeId = '';

  function onSelect(id: string) {
    if (!(DOCK_IDS as readonly string[]).includes(id)) return;
    if (id === 'map') router.push('/dashboard');
    else if (id === 'tags') router.push('/dashboard/qr');
    else if (id === 'alerts') router.push('/dashboard/notifications');
    else if (id === 'messages') router.push('/dashboard/messages');
    else if (id === 'emergency') router.push('/dashboard?panel=emergency');
  }

  return <BottomDock items={items} activeId={activeId || undefined} onSelect={onSelect} />;
}
