import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/config';

const LOGIN_PATH = '/login';
const HOME_PATH = '/dashboard';
// Pages a signed-out visitor may open: the landing page and the login page
const PUBLIC_PATHS = ['/', LOGIN_PATH];

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * signed-out visitors to /login (and signed-in visitors from the public
 * pages to the dashboard). Called from proxy.ts. In demo mode every request
 * passes through.
 */
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);
  const isPublicPage = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!isSignedIn && !isPublicPage) {
    return redirectKeepingCookies(request, response, LOGIN_PATH);
  }

  if (isSignedIn && isPublicPage) {
    return redirectKeepingCookies(request, response, HOME_PATH);
  }

  return response;
}

function redirectKeepingCookies(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
