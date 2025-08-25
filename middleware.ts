import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  try {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    // If there's an error getting the session, treat as unauthenticated
    if (error) {
      console.error('Middleware auth error:', error);
    }

    // REMOVED: Aggressive user validation that was clearing sessions
    // This was causing forced session expiry during idle periods
    // Now we only check if session exists, not if user is still valid

    const isAuthPage = req.nextUrl.pathname.startsWith('/auth/');
    const isDashboard = req.nextUrl.pathname.startsWith('/dashboard');
    const isCallback = req.nextUrl.pathname.includes('/callback');
    const isRoot = req.nextUrl.pathname === '/';

    // Auth pages - redirect to dashboard if already logged in
    if (isAuthPage && !isCallback) {
      if (session) {
        console.log('Redirecting authenticated user from auth page to dashboard');
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    // Protected routes - redirect to login if not authenticated
    if (isDashboard) {
      if (!session) {
        console.log('Redirecting unauthenticated user from dashboard to login');
        const loginUrl = new URL('/auth/login', req.url);
        loginUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }
    }

    // Root page - redirect based on auth status
    if (isRoot) {
      if (session) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      } else {
        return NextResponse.redirect(new URL('/auth/login', req.url));
      }
    }

    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    // If middleware fails, allow the request to continue
    return res;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
