import { redirect } from 'next/navigation';

/** Alerts list — same data as Lost Reports; dedicated route for mobile parity. */
export default function AlertsPage() {
  redirect('/dashboard/reports');
}
