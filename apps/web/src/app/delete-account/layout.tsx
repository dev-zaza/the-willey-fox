import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request Account Deletion – SafeTag',
  description: 'Submit a GDPR account deletion request for your SafeTag / Wiley Fox account.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
