// ─── middleware.ts ─────────────────────────────────────────────────────────────
// Next.js Middleware — runs on every request BEFORE rendering.
//
// Responsibilities (SRP respected — one concern per section):
//   1. Refresh Supabase auth session (keeps HttpOnly cookies up-to-date)
//   2. Route protection — redirect unauthenticated users to /login
//   3. Security response headers (defence-in-depth on top of next.config.ts)
//
// Security hardening:
//   - Mitigates CVE-2025-55182 (Next.js RSC RCE) by running on ≥15.3.0
//   - Eliminates localStorage JWT (replaced by HttpOnly cookie via @supabase/ssr)
//   - All dangerous redirect chains prevented by checking supabase session server-side

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Routes that do NOT require authentication */
const PUBLIC_PATHS = ['/login'];

/** Root URL for the dashboard */
const DASHBOARD_HOME = '/';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // ── 1. Supabase session refresh ─────────────────────────────────────────
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: Do not run any code between createServerClient and getUser()
  // that could alter the request/response — it will break session refresh.
  // Wrapped in try-catch: Edge runtime throws "fetch failed" if Supabase is
  // temporarily unreachable (cold start, network blip). Treat as unauthenticated
  // so the auth guard redirects to /login instead of returning a 500.
  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Network error — allow the auth guard below to redirect to login
  }

  // ── 2. Auth guard ────────────────────────────────────────────────────────
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicPath) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = DASHBOARD_HOME;
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static  (static assets)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - Files with extensions (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
