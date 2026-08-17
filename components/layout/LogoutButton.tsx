"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (e) {
      console.error("Logout request error:", e);
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 transition-colors disabled:opacity-50 cursor-pointer"
      title="Выйти из аккаунта"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
      ) : (
        <LogOut className="w-3.5 h-3.5 text-zinc-400" />
      )}
      <span>{loading ? "Выход..." : "Выйти"}</span>
    </button>
  );
}
