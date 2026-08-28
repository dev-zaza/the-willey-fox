import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/context/auth-context';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { SerwistRegister } from '@/components/pwa/serwist-provider';
import './globals.css';

const APP_NAME = 'TheWileyfox';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

const fraunces = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '700', '900'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: '%s | TheWileyfox' },
  description:
    'Community-driven navigation platform. Real-time alerts, emergency SOS, and trusted routes.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#ea2e00',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`}
      style={{ colorScheme: 'light dark' }}
      suppressHydrationWarning
    >
      <body
        className="antialiased"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <SerwistRegister>
          <AuthProvider>{children}</AuthProvider>
          <InstallPrompt />
        </SerwistRegister>
      </body>
    </html>
  );
}
