import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/dashboard', '/admin', '/tags', '/profile', '/settings', '/onboard', '/guides'];
const AUTH_PATHS = ['/login', '/register'];
const AUTH_MARKER_COOKIE = 'st_auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Stripe Checkout still returns to the old path. Keep the query (?success=true / ?canceled=true).
  if (pathname === '/subscription' || pathname === '/subscription/') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard/subscription';
    return NextResponse.redirect(url);
  }

  const isAuthenticated = request.cookies.has(AUTH_MARKER_COOKIE);

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    const returnTo = `${pathname}${request.nextUrl.search}`;
    // After login, send new users into onboarding when they were headed to onboard
    loginUrl.searchParams.set('redirect', pathname.startsWith('/onboard') ? '/onboard/welcome' : returnTo);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && isAuthenticated) {
    // Dashboard layout runs OnboardingGate and may bounce to /onboard/welcome
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|q/).*)'],
};
