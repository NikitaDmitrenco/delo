"use client";

import { useState } from "react";
import { Mic, CheckCircle2, Clock, Sparkles, Send } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const PRESET_EXAMPLES = [
  "Завтра в три часа дня позвонить Ивану и согласовать договор",
  "В пятницу до 17:00 отправить документы бухгалтеру",
  "Позвонить маме",
  "Так, завтра где-то к обеду надо позвонить Сергею и узнать насчёт встречи",
];

export function InteractiveDemo() {
  const [input, setInput] = useState(PRESET_EXAMPLES[0]);

  // Fast client-side demo parser simulation for landing
  const parseSimulation = (text: string) => {
    const lower = text.toLowerCase();
    let deadline = "Без дедлайна";

    if (lower.includes("завтра") && (lower.includes("три") || lower.includes("15:00") || lower.includes("3"))) {
      deadline = "Завтра · 15:00";
    } else if (lower.includes("завтра") && (lower.includes("обед") || lower.includes("12:00"))) {
      deadline = "Завтра · 12:00";
    } else if (lower.includes("завтра")) {
      deadline = "Завтра";
    } else if (lower.includes("пятниц") && (lower.includes("17:00") || lower.includes("до 17"))) {
      deadline = "Пятница · 17:00";
    }

    let title = text
      .replace(/(завтра в три часа дня|в пятницу до 17:00|так, завтра где-то к обеду надо|надо|завтра|в пятницу)/gi, "")
      .trim();

    if (!title) title = "Новая задача";
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return { title, deadline };
  };

  const parsed = parseSimulation(input);

  return (
    <div className="w-full max-w-2xl bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-2xl backdrop-blur-sm text-left">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-5">
        <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Попробуйте прямо сейчас:</span>
        </div>
        <span className="text-[11px] text-zinc-500 font-mono">AI Parser Engine</span>
      </div>

      {/* Preset Pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESET_EXAMPLES.map((example, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setInput(example)}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-lg border transition-all text-left truncate max-w-xs",
              input === example
                ? "bg-zinc-800 border-zinc-700 text-white font-medium"
                : "bg-zinc-950/60 border-zinc-850 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            )}
          >
            {example}
          </button>
        ))}
      </div>

      {/* Input box */}
      <div className="relative mb-5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Напишите любую задачу своими словами..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors pr-10"
        />
        <div className="absolute right-3 top-3.5 text-zinc-500">
          <Mic className="w-4 h-4" />
        </div>
      </div>

      {/* AI Extraction Result */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 rounded-md border border-zinc-700 mt-0.5 flex items-center justify-center text-transparent hover:text-zinc-400 transition-colors shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-medium text-white">{parsed.title}</div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-400">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>{parsed.deadline}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
            AI Structured
          </span>
        </div>
      </div>
    </div>
  );
}
