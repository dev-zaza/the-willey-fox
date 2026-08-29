import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { OnboardingGate } from '@/components/onboarding/onboarding-gate';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard">
      <OnboardingGate>
        <DashboardShell>{children}</DashboardShell>
      </OnboardingGate>
    </div>
  );
}
