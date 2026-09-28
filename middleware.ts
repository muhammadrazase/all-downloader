import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';
import { sessionVersionMatches } from '@/lib/auth/adminUser';

// Gates /admin/* only. Tool/blog visibility is NOT handled here — Next's Full
// Route Cache serves a force-static page's prerendered HTML directly and never
// invokes middleware (verified against a real `next build && next start`), so
// that gate lives in each page instead (redirect() on a disabled row,
// re-evaluated via revalidatePath — see src/app/admin/actions.ts).
export const config = {
  runtime: 'nodejs',
  matcher: ['/admin/:path*'],
};

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (pathname === '/admin/login') return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);

  let valid = false;
  try {
    valid = Boolean(payload && sessionVersionMatches(payload.v));
  } catch {
    valid = false;
  }

  if (!valid) return NextResponse.redirect(new URL('/admin/login', req.url));
  return NextResponse.next();
}
