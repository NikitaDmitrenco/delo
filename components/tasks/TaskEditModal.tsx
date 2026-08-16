"use client";

import { useState, useEffect } from "react";
import { Task } from "@/types";
import { X, Loader2, Calendar } from "lucide-react";
import { format } from "date-fns";

interface TaskEditModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: { title?: string; deadline?: string | null }) => Promise<void>;
}

export function TaskEditModal({ task, isOpen, onClose, onSave }: TaskEditModalProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      if (task.deadline) {
        try {
          const d = new Date(task.deadline);
          // format as YYYY-MM-DDTHH:mm for datetime-local input
          setDeadline(format(d, "yyyy-MM-dd'T'HH:mm"));
        } catch {
          setDeadline("");
        }
      } else {
        setDeadline("");
      }
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    try {
      let isoDeadline: string | null = null;
      if (deadline) {
        isoDeadline = new Date(deadline).toISOString();
      }

      await onSave(task.id, {
        title: title.trim(),
        deadline: isoDeadline,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">Редактирование задачи</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Название задачи
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Дедлайн (дата и время)
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
            {deadline && (
              <button
                type="button"
                onClick={() => setDeadline("")}
                className="mt-1 text-[11px] text-zinc-500 hover:text-zinc-300 underline"
              >
                Удалить дедлайн
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSaving}
              className="bg-white text-zinc-950 font-semibold px-4 py-2 rounded-xl text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Сохранить</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
