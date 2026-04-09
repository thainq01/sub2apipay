import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Auto-extract origin from SUB2API_BASE_URL to allow Sub2API main site iframe embedding
  const sub2apiUrl = process.env.SUB2API_BASE_URL || '';
  const extraOrigins = process.env.IFRAME_ALLOW_ORIGINS || '';

  // Check if wildcard * is included
  const extras = extraOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const hasWildcard = extras.includes('*');

  if (hasWildcard) {
    // Wildcard: allow any site to embed
    response.headers.set('Content-Security-Policy', 'frame-ancestors *');
    response.headers.delete('X-Frame-Options');
  } else {
    const origins = new Set<string>();

    if (sub2apiUrl) {
      try {
        origins.add(new URL(sub2apiUrl).origin);
      } catch {
        // ignore invalid URL
      }
    }

    for (const trimmed of extras) {
      origins.add(trimmed);
    }

    if (origins.size > 0) {
      response.headers.set('Content-Security-Policy', `frame-ancestors 'self' ${[...origins].join(' ')}`);
      // Remove X-Frame-Options when custom origins exist (conflicts with CSP frame-ancestors)
      response.headers.delete('X-Frame-Options');
    } else {
      response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    }
  }

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
