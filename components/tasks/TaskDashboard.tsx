"use client";

import { useState } from "react";
import { Task } from "@/types";
import { TaskItem } from "./TaskItem";
import { TaskForm } from "./TaskForm";
import { TaskEditModal } from "./TaskEditModal";
import { isOverdue } from "@/lib/utils/dates";
import { CheckCircle2, ListFilter, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type FilterType = "all" | "active" | "completed";

interface TaskDashboardProps {
  initialTasks: Task[];
}

export function TaskDashboard({ initialTasks }: TaskDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [filter, setFilter] = useState<FilterType>("active");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtered list
  const filteredTasks = tasks.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  const activeCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;
  const overdueCount = tasks.filter((t) => isOverdue(t.deadline, t.completed)).length;

  // Add Task
  const handleAddTask = async (title: string, deadline: string | null) => {
    setErrorMessage(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, deadline, source: "web", inputType: "manual" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось создать задачу");

      setTasks((prev) => [data.task, ...prev]);
    } catch (err: any) {
      setErrorMessage(err.message || "Ошибка при добавлении задачи");
    }
  };

  // Toggle Complete
  const handleToggle = async (taskId: string, completed: boolean) => {
    setErrorMessage(null);
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Не удалось обновить задачу");
      }
    } catch (err: any) {
      // Rollback on error
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed: !completed } : t))
      );
      setErrorMessage(err.message || "Ошибка при обновлении задачи");
    }
  };

  // Edit Task
  const handleSaveEdit = async (
    taskId: string,
    updates: { title?: string; deadline?: string | null }
  ) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить изменения");

      setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
    } catch (err: any) {
      setErrorMessage(err.message || "Ошибка при сохранении задачи");
    }
  };

  // Delete Task
  const handleDelete = async (taskId: string) => {
    setErrorMessage(null);
    const previousTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Не удалось удалить задачу");
      }
    } catch (err: any) {
      setTasks(previousTasks);
      setErrorMessage(err.message || "Ошибка при удалении задачи");
    }
  };

  return (
    <div className="w-full">
      {/* Error alert */}
      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 flex items-center justify-between gap-3 text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-200 underline font-medium"
          >
            Закрыть
          </button>
        </div>
      )}

      {/* Task Creation Form */}
      <TaskForm onAddTask={handleAddTask} />

      {/* Filters & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-850">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              filter === "active"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <span>Активные</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-950/60 text-zinc-300">
              {activeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter("completed")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              filter === "completed"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <span>Выполненные</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-950/60 text-zinc-400">
              {completedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              filter === "all"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <span>Все</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-950/60 text-zinc-400">
              {tasks.length}
            </span>
          </button>
        </div>

        {overdueCount > 0 && (
          <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>
              Просрочено: <strong>{overdueCount}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Task List / Empty State */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">
            {filter === "active"
              ? "Все активные задачи выполнены 🎉"
              : filter === "completed"
              ? "Нет выполненных задач"
              : "Список задач пуст"}
          </h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {filter === "active"
              ? "Добавьте новую задачу выше или отправьте сообщение в Telegram-бота."
              : "Задачи появятся здесь после их выполнения."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={(t) => setEditingTask(t)}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <TaskEditModal
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
