import type { Metadata } from 'next';
import { Geist, Geist_Mono, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/context/auth-context';
import './globals.css';

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
  title: { default: 'TheWileyfox', template: '%s | TheWileyfox' },
  description: 'Community-driven navigation platform. Real-time alerts, emergency SOS, and trusted routes.',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`} style={{ colorScheme: 'light dark' }} suppressHydrationWarning>
      <body className="antialiased" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
