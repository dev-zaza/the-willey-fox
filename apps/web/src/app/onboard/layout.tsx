import type { Metadata } from 'next';
import { OnboardAuthGuard } from '@/components/onboarding/onboard-auth-guard';

export const metadata: Metadata = { title: 'Get started' };

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return <OnboardAuthGuard>{children}</OnboardAuthGuard>;
}
