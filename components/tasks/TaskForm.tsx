"use client";

import { useState } from "react";
import { Plus, Calendar, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface TaskFormProps {
  onAddTask: (title: string, deadline: string | null) => Promise<void>;
}

export function TaskForm({ onAddTask }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let isoDeadline: string | null = null;
      if (deadline) {
        isoDeadline = new Date(deadline).toISOString();
      }

      await onAddTask(title.trim(), isoDeadline);
      setTitle("");
      setDeadline("");
      setShowDatePicker(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="bg-zinc-900/60 border border-zinc-800 focus-within:border-zinc-600 rounded-2xl p-3 transition-colors shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Что нужно сделать? Напишите сюда..."
            className="flex-1 bg-transparent px-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={cn(
              "p-2 rounded-xl border text-xs transition-colors flex items-center gap-1.5",
              deadline || showDatePicker
                ? "bg-zinc-800 border-zinc-700 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
            )}
            title="Выбрать дедлайн"
          >
            <Calendar className="w-4 h-4 text-zinc-400" />
            <span className="hidden sm:inline text-[11px]">
              {deadline ? "Дедлайн выбран" : "Дедлайн"}
            </span>
          </button>

          <button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className="bg-white text-zinc-950 font-semibold px-4 py-2 rounded-xl text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Добавить</span>
          </button>
        </div>

        {showDatePicker && (
          <div className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-3 px-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Срок выполнения:</span>
            </div>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
            />
            {deadline && (
              <button
                type="button"
                onClick={() => setDeadline("")}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 underline"
              >
                Очистить
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
