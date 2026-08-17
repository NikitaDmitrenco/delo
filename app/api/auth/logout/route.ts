import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    // Check if client expects JSON or direct redirect
    const acceptHeader = request.headers.get("accept") || "";
    if (acceptHeader.includes("application/json")) {
      return NextResponse.json({ success: true, redirectUrl: "/login" });
    }

    return NextResponse.redirect(new URL("/login", request.url), {
      status: 303,
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 303,
    });
  }
}
