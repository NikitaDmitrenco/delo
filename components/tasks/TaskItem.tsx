"use client";

import { useState } from "react";
import { Task } from "@/types";
import { formatDeadline, isOverdue } from "@/lib/utils/dates";
import { Check, Clock, Trash2, Edit3, MessageSquare, Globe, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string, completed: boolean) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onEdit: (task: Task) => void;
}

export function TaskItem({ task, onToggle, onDelete, onEdit }: TaskItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const overdue = isOverdue(task.deadline, task.completed);
  const formattedDate = formatDeadline(task.deadline);

  const handleCheckboxClick = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      await onToggle(task.id, !task.completed);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsUpdating(true);
    try {
      await onDelete(task.id);
    } finally {
      setIsUpdating(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-start justify-between gap-3 p-4 rounded-xl border transition-all",
        task.completed
          ? "bg-zinc-950/40 border-zinc-850 opacity-60"
          : overdue
          ? "bg-red-950/10 border-red-900/30 hover:border-red-800/50"
          : "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700/80"
      )}
    >
      {/* Left: Checkbox & Info */}
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        <button
          type="button"
          onClick={handleCheckboxClick}
          disabled={isUpdating}
          className={cn(
            "w-5 h-5 rounded-md border mt-0.5 flex items-center justify-center transition-all shrink-0 cursor-pointer",
            task.completed
              ? "bg-emerald-600 border-emerald-600 text-white"
              : "border-zinc-700 bg-zinc-950 hover:border-zinc-500 text-transparent"
          )}
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-normal text-zinc-100 leading-snug break-words transition-all",
              task.completed && "line-through text-zinc-500"
            )}
          >
            {task.title}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs text-zinc-400">
            {/* Deadline */}
            <div
              className={cn(
                "inline-flex items-center gap-1.5",
                overdue && !task.completed ? "text-red-400 font-medium" : "text-zinc-400"
              )}
            >
              {overdue && !task.completed ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
              )}
              <span>{formattedDate}</span>
            </div>

            {/* Source indicator */}
            {task.source === "telegram" ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800/60">
                <MessageSquare className="w-3 h-3 text-sky-400" />
                <span>Telegram</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Редактировать"
        >
          <Edit3 className="w-4 h-4" />
        </button>

        {showDeleteConfirm ? (
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 px-2 py-1 rounded-lg">
            <span className="text-[11px] text-zinc-300 mr-1">Удалить?</span>
            <button
              type="button"
              onClick={handleDelete}
              className="text-[11px] text-red-400 hover:text-red-300 font-semibold px-1.5 py-0.5 bg-red-950/60 rounded"
            >
              Да
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 px-1"
            >
              Нет
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
