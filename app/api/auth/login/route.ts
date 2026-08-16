import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Неверные данные для входа" },
        { status: 400 }
      );
    }

    const { identifier, password } = result.data;
    const cleanIdentifier = identifier.trim().toLowerCase();
    const admin = createAdminClient();
    const supabase = await createClient();

    let targetEmail: string | null = null;

    // Check if identifier is phone number or username
    const isPhone = /^\+?[0-9]{7,15}$/.test(cleanIdentifier.replace(/[\s-()]/g, ""));

    if (isPhone) {
      const { data: profile } = await admin
        .from("profiles")
        .select("username")
        .eq("phone", cleanIdentifier)
        .maybeSingle();

      if (!profile || !profile.username) {
        return NextResponse.json(
          { error: "Пользователь с таким номером телефона не найден" },
          { status: 404 }
        );
      }
      targetEmail = `${profile.username.toLowerCase()}@delo.local`;
    } else {
      // Username login
      targetEmail = `${cleanIdentifier}@delo.local`;
    }

    // Sign in with password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Неверный логин или пароль" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера при входе" },
      { status: 500 }
    );
  }
}
