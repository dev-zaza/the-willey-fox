'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart2,
  Users,
  QrCode,
  Flag,
  MapPin,
  Shield,
  DollarSign,
  Tag,
  ClipboardList,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  LogOut,
  EllipsisVertical,
  LayoutTemplate,
  Printer,
  Palette,
  Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const NAV_ITEMS = [
  {
    group: 'Overview',
    items: [
      { id: 'overview', label: 'Overview', icon: BarChart2, href: '/admin' },
    ],
  },
  {
    group: 'Management',
    items: [
      { id: 'users', label: 'Users', icon: Users, href: '/admin/users' },
      { id: 'qr-codes', label: 'QR Codes', icon: QrCode, href: '/admin/qr-codes' },
      { id: 'reports', label: 'Reports', icon: Flag, href: '/admin/reports' },
      { id: 'pins', label: 'Pins', icon: MapPin, href: '/admin/pins' },
      { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone, href: '/admin/broadcasts' },
    ],
  },
  {
    group: 'Platform',
    items: [
      { id: 'safety', label: 'Safety', icon: Shield, href: '/admin/safety' },
      { id: 'pricing', label: 'Pricing', icon: DollarSign, href: '/admin/pricing' },
      { id: 'categories', label: 'Categories', icon: Tag, href: '/admin/categories' },
      { id: 'qr-template', label: 'QR Template', icon: LayoutTemplate, href: '/admin/qr-template' },
      { id: 'print-templates', label: 'Print Templates', icon: Printer, href: '/admin/print-templates' },
      { id: 'visual-themes', label: 'Visual Themes', icon: Palette, href: '/admin/visual-themes' },
    ],
  },
  {
    group: 'Logs',
    items: [
      { id: 'audit-logs', label: 'Audit Logs', icon: ClipboardList, href: '/admin/audit-logs' },
      { id: 'user-reports', label: 'User Reports', icon: AlertTriangle, href: '/admin/user-reports' },
    ],
  },
];

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const SidebarContext = React.createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
});

export function useSidebar() {
  return React.useContext(SidebarContext);
}

export function AdminSidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { collapsed, setCollapsed } = useSidebar();

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col border-r admin-border-color admin-surface transition-all duration-300 ease-in-out',
          collapsed ? 'w-[60px]' : 'w-[240px]',
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex h-14 items-center border-b admin-border-color px-3',
          collapsed ? 'justify-center' : 'justify-between',
        )}>
          {!collapsed && (
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg admin-accent-bg">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold admin-text-color">Admin</p>
                <p className="text-[10px] admin-text-subtle">TheWileyfox</p>
              </div>
            </Link>
          )}
          {collapsed && (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg admin-accent-bg">
              <Shield className="h-4 w-4 text-white" />
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="rounded-md p-1 admin-text-subtle admin-hover transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-3">
          <nav className="space-y-4 px-2">
            {NAV_ITEMS.map((group) => (
              <div key={group.group}>
                {!collapsed && (
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest admin-text-subtle">
                    {group.group}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    if (collapsed) {
                      return (
                        <li key={item.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={item.href}
                                className={cn(
                                  'flex h-9 w-9 items-center justify-center rounded-lg transition-colors mx-auto',
                                  active
                                    ? 'admin-accent-bg-dim admin-accent-text'
                                    : 'admin-text-muted admin-hover',
                                )}
                              >
                                <item.icon className="h-4 w-4" />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">{item.label}</TooltipContent>
                          </Tooltip>
                        </li>
                      );
                    }
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
                            active
                              ? 'admin-accent-bg-dim admin-accent-text font-medium'
                              : 'admin-text-muted admin-hover',
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {item.label}
                          {active && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full admin-accent-bg" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t admin-border-color p-2">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCollapsed(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg admin-text-subtle admin-hover transition-colors mx-auto"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand</TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm admin-text-muted admin-hover transition-colors">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full admin-accent-bg-dim admin-accent-text text-xs font-bold flex-shrink-0">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <div className="flex-1 text-left leading-tight min-w-0">
                    <p className="text-xs font-medium admin-text-color truncate">{user?.firstName} {user?.lastName}</p>
                    <p className="text-[10px] admin-text-subtle truncate">{user?.email}</p>
                  </div>
                  <EllipsisVertical className="h-3.5 w-3.5 shrink-0 admin-text-subtle" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-medium admin-text-color">{user?.firstName} {user?.lastName}</p>
                    <p className="text-[10px] admin-text-subtle">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="cursor-pointer">
                    <BarChart2 className="h-3.5 w-3.5" />
                    Back to App
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-400 focus:text-red-400 cursor-pointer">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
