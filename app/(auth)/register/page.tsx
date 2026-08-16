"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle, MessageSquare } from "lucide-react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkToken = searchParams.get("token") || "";

  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Chisinau";

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          phone: phone || undefined,
          password,
          linkToken: linkToken || undefined,
          timezone: userTimezone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка при регистрации");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Не удалось создать аккаунт. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-8"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>На главную</span>
      </Link>

      {/* Card */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-7 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-xl tracking-wider text-white">DELO</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Регистрация</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Создайте аккаунт для синхронизации задач
          </p>
        </div>

        {linkToken && (
          <div className="mb-5 p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 flex items-start gap-2.5 text-xs text-blue-200">
            <MessageSquare className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-blue-100">Связывание с Telegram:</span>
              <p className="text-blue-300/90 text-[11px] mt-0.5">
                Ваш создаваемый аккаунт будет автоматически подключен к боту.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-800/50 flex items-start gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Имя пользователя (username) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alex_smith"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Номер телефона <span className="text-zinc-500 text-[11px]">(опционально)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+79991234567"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Пароль <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-white text-zinc-950 font-semibold py-2.5 rounded-xl hover:bg-zinc-200 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Создание аккаунта...</span>
              </>
            ) : (
              <span>Создать аккаунт</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-zinc-800/80 text-center text-xs text-zinc-400">
          Уже есть аккаунт?{" "}
          <Link
            href={`/login${linkToken ? `?token=${linkToken}` : ""}`}
            className="text-white font-medium hover:underline"
          >
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-zinc-950 text-zinc-100">
      <Suspense fallback={<Loader2 className="w-6 h-6 animate-spin text-zinc-500" />}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
