import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Bypass API routes (webhooks, crons, auth endpoints)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const { supabaseResponse, user } = await updateSession(request);

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isProtectedRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/settings");

  // If unauthenticated user tries to access protected dashboard routes
  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already authenticated user visits /login or /register, redirect to /dashboard
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
