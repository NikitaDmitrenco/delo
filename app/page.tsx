"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquare, Mic, Sparkles, Clock, Shield } from "lucide-react";

export default function LandingPage() {
  const [demoInput, setDemoInput] = useState("Завтра в три часа дня позвонить Ивану и согласовать договор");

  // Client-side demonstration parsing simulation for landing preview
  const parsePreview = (text: string) => {
    const isTomorrow = text.toLowerCase().includes("завтра");
    const hasThree = text.toLowerCase().includes("три") || text.includes("15:00") || text.includes("3");
    
    let deadline = "Без дедлайна";
    if (isTomorrow && hasThree) {
      deadline = "Завтра · 15:00";
    } else if (isTomorrow) {
      deadline = "Завтра";
    }

    let title = text.replace(/(завтра|в три часа дня|в 15:00|к обеду)/gi, "").trim();
    if (!title) title = "Новая задача";
    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return { title, deadline };
  };

  const preview = parsePreview(demoInput);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-lg tracking-wider text-white">DELO</span>
            <span className="text-xs uppercase tracking-widest px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
              MVP
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-300 hover:text-white px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-white text-zinc-950 hover:bg-zinc-200 px-4 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              Создать аккаунт
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-300 text-xs font-medium mb-8">
          <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
          <span>Умный таск-менеджер нового поколения</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white max-w-2xl leading-[1.15]">
          Turn thoughts <br className="hidden sm:inline" /> into done.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-xl font-normal leading-relaxed">
          Просто напишите или скажите голосом, что нужно сделать. Delo сам извлечёт суть, выставит точный дедлайн и сохранит в ваш список задач.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-zinc-950 font-semibold px-6 py-3 rounded-xl hover:bg-zinc-200 transition-all text-sm shadow-sm"
          >
            <span>Начать бесплатно</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="https://t.me"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-200 font-medium px-6 py-3 rounded-xl hover:bg-zinc-800/80 hover:text-white transition-all text-sm"
          >
            <MessageSquare className="w-4 h-4 text-zinc-400" />
            <span>Открыть в Telegram</span>
          </a>
        </div>

        {/* Interactive Live Demo */}
        <div className="mt-16 w-full max-w-2xl bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 text-left shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Интерактивное превью AI-парсера
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Mic className="w-3.5 h-3.5" />
              <span>Голос или текст</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Входящее сообщение:
              </label>
              <input
                type="text"
                value={demoInput}
                onChange={(e) => setDemoInput(e.target.value)}
                placeholder="Например: В пятницу в 17:00 отправить отчёт"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-md border border-zinc-700 mt-0.5 flex items-center justify-center text-transparent hover:text-zinc-400 transition-colors">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-100">{preview.title || "..."}</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-400">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{preview.deadline}</span>
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                AI extracted
              </span>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800/60">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-200">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-base">Голос и текст в Telegram</h3>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
              Отправляйте голосовые сообщения на бегу. Delo мгновенно расшифрует речь и превратит её в чёткую задачу.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800/60">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-base">Никаких выдуманных дедлайнов</h3>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
              AI точно понимает относительные даты с учётом вашего часового пояса и никогда не ставит случайное время.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800/60">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-200">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-base">Мгновенная синхронизация</h3>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
              Задачи доступны в Telegram и на сайте в режиме реального времени с полной изоляцией данных (RLS).
            </p>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-900 py-8 text-center text-xs text-zinc-600">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} Delo. Turn thoughts into done.</div>
          <div className="flex items-center gap-4 text-zinc-500">
            <span>Next.js</span>
            <span>·</span>
            <span>Supabase</span>
            <span>·</span>
            <span>OpenAI</span>
            <span>·</span>
            <span>Telegram Bot</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
