'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { AdminSidebar, AdminSidebarProvider } from '@/components/admin/admin-sidebar';
import { ThemeCustomizer, ThemeCustomizerTrigger } from '@/components/admin/theme-customizer';

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [customizerOpen, setCustomizerOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user?.isAdmin) {
    return (
      <div className="min-h-screen admin-bg flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin admin-text-subtle" />
      </div>
    );
  }

  return (
    <AdminSidebarProvider>
      <div className="flex h-screen admin-bg overflow-hidden">
        <AdminSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto admin-bg">
            {children}
          </main>
        </div>
      </div>

      <ThemeCustomizerTrigger onClick={() => setCustomizerOpen(true)} />
      <ThemeCustomizer open={customizerOpen} onOpenChange={setCustomizerOpen} />
    </AdminSidebarProvider>
  );
}
