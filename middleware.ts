import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Mismo patrón que nexo/middleware.ts: chequeo barato de "hay cookie de
// sesión" antes de llegar al layout. La verificación real de sesión +
// Membership + Workspace vive en modules/business/current.ts y en cada
// route handler, no acá.
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const runtime = "nodejs";

export const config = {
  matcher: ["/dashboard/:path*"],
};
