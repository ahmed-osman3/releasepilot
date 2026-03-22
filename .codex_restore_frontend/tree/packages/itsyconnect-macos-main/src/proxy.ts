import { NextRequest, NextResponse } from "next/server";

const SETUP_PATHS = new Set(["/setup", "/api/health"]);

const PUBLIC_PREFIXES = ["/_next", "/favicon", "/api/setup"];

function isPublic(pathname: string): boolean {
  if (SETUP_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow setup and static paths through
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Allow all API routes through (no auth needed for local app)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Only check setup on root – avoids health check on every navigation
  if (pathname === "/") {
    try {
      const healthUrl = new URL("/api/health", request.url);
      const res = await fetch(healthUrl);
      const data = await res.json();

      if (data.setup) {
        return NextResponse.redirect(new URL("/setup", request.url));
      }
      return NextResponse.redirect(new URL("/dashboard?entry=1", request.url));
    } catch {
      // If health check fails, let the request through
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
