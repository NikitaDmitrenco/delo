import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Неверные данные регистрации" },
        { status: 400 }
      );
    }

    const { username, phone, password, linkToken, timezone } = result.data;
    const cleanUsername = username.trim().toLowerCase();
    const cleanPhone = phone?.trim() || null;
    const syntheticEmail = `${cleanUsername}@delo.local`;

    const admin = createAdminClient();
    const supabase = await createClient();

    // 1. Check if username already exists in profiles
    const { data: existingUser } = await admin
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким именем уже существует" },
        { status: 409 }
      );
    }

    // 2. Check if phone already exists if provided
    if (cleanPhone) {
      const { data: existingPhone } = await admin
        .from("profiles")
        .select("id")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (existingPhone) {
        return NextResponse.json(
          { error: "Пользователь с таким номером телефона уже существует" },
          { status: 409 }
        );
      }
    }

    // 3. Handle linking token if provided
    let linkedTelegramId: number | null = null;
    let linkedTelegramUsername: string | null = null;

    if (linkToken) {
      const { data: tokenRecord } = await admin
        .from("telegram_link_tokens")
        .select("*")
        .eq("token", linkToken)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (tokenRecord) {
        linkedTelegramId = tokenRecord.telegram_user_id;
        linkedTelegramUsername = tokenRecord.telegram_username || null;
      }
    }

    // 4. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: syntheticEmail,
      password: password,
      options: {
        data: {
          username: cleanUsername,
          phone: cleanPhone,
          timezone: timezone || "Europe/Chisinau",
          telegram_user_id: linkedTelegramId,
          telegram_username: linkedTelegramUsername,
        },
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Не удалось зарегистрировать пользователя" },
        { status: 400 }
      );
    }

    // 5. Ensure profile is saved with telegram linking details
    await admin.from("profiles").upsert({
      id: authData.user.id,
      username: cleanUsername,
      phone: cleanPhone,
      telegram_user_id: linkedTelegramId,
      telegram_username: linkedTelegramUsername,
      timezone: timezone || "Europe/Chisinau",
    });

    // Mark linking token as used if applied
    if (linkToken && linkedTelegramId) {
      await admin
        .from("telegram_link_tokens")
        .update({ used: true })
        .eq("token", linkToken);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        username: cleanUsername,
        phone: cleanPhone,
        telegram_linked: !!linkedTelegramId,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера при регистрации" },
      { status: 500 }
    );
  }
}
