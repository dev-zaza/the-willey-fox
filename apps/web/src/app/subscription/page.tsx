import { redirect } from 'next/navigation';

/**
 * Legacy Stripe return URL. Checkout sessions created before the path fix
 * still land on /subscription?success=true.
 */
export default async function LegacySubscriptionRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
  }

  const qs = query.toString();
  redirect(qs ? `/dashboard/subscription?${qs}` : '/dashboard/subscription');
}
