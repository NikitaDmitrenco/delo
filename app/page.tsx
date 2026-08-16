import Link from "next/link";
import { ArrowRight, MessageSquare, Sparkles } from "lucide-react";
import { InteractiveDemo } from "@/components/landing/InteractiveDemo";
import { VoiceFlowShowcase } from "@/components/landing/VoiceFlowShowcase";
import { ComparisonSection } from "@/components/landing/ComparisonSection";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800">
      {/* Top Navigation */}
      <header className="border-b border-zinc-850 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-lg tracking-wider text-white">DELO</span>
            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
              MVP
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-medium text-zinc-300 hover:text-white px-3.5 py-2 rounded-lg transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="text-xs font-medium bg-white text-zinc-950 hover:bg-zinc-200 px-4 py-2 rounded-lg transition-colors shadow-sm font-semibold"
            >
              Создать аккаунт
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-300 text-xs font-medium mb-8">
          <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
          <span>Умный таск-менеджер нового поколения</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-2xl leading-[1.12]">
          Turn thoughts <br className="hidden sm:inline" /> into done.
        </h1>

        <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-xl font-normal leading-relaxed">
          Просто напишите или надиктуйте голосом, что нужно сделать. Delo сам извлечёт суть, вычислит точный дедлайн и сохранит в ваш список задач.
        </p>

        {/* CTA Buttons */}
        <div className="mt-9 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
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
            <MessageSquare className="w-4 h-4 text-sky-400" />
            <span>Открыть в Telegram</span>
          </a>
        </div>

        {/* Interactive Live Demo */}
        <div className="mt-16 w-full flex justify-center">
          <InteractiveDemo />
        </div>

        {/* Pipeline Breakdown */}
        <VoiceFlowShowcase />

        {/* Comparison */}
        <ComparisonSection />

        {/* Bottom CTA Card */}
        <div className="mt-12 w-full p-8 sm:p-12 rounded-3xl bg-zinc-900/40 border border-zinc-800 text-center relative overflow-hidden shadow-2xl">
          <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Освободите голову от рутины
          </h3>
          <p className="text-zinc-400 text-sm mt-3 max-w-md mx-auto">
            Подключите бота в Telegram или создайте веб-аккаунт за 30 секунд.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-white text-zinc-950 font-semibold px-7 py-3.5 rounded-xl hover:bg-zinc-200 transition-all text-sm shadow-md"
            >
              <span>Создать аккаунт в Delo</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-900 py-8 text-center text-xs text-zinc-500">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} Delo. Turn thoughts into done.</div>
          <div className="flex items-center gap-4 text-zinc-500">
            <span>Next.js 15</span>
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
