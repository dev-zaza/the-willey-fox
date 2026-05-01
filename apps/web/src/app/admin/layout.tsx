import React from 'react';
import { AdminLayoutClient } from '@/components/admin/admin-layout-client';

// Inline script that reads localStorage and sets .admin-dark BEFORE hydration
// to prevent flash of light theme on dark-mode admin sessions.
const ADMIN_THEME_INIT = `
(function() {
  try {
    var dark = localStorage.getItem('admin-dark-mode');
    // Default is light (cream brand). Only enable dark if explicitly opted in.
    if (dark === 'true') {
      document.documentElement.classList.add('admin-dark');
    }
    var radius = localStorage.getItem('admin-radius');
    if (radius) document.documentElement.style.setProperty('--admin-radius', radius);
  } catch(e) {}
})();
`.trim();

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-component */}
      <script dangerouslySetInnerHTML={{ __html: ADMIN_THEME_INIT }} />
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </>
  );
}
