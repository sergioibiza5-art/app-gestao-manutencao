"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function DayRefresh({ live }: { live: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !document.activeElement?.matches("input, select, textarea")) router.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [live, router]);
  return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} title="Atualizar registos" aria-label="Atualizar registos" className="grid size-11 shrink-0 place-items-center rounded-lg border border-zinc-700 text-zinc-200 hover:border-teal-300 disabled:opacity-50"><RefreshCw size={18} className={pending ? "animate-spin" : ""} /></button>;
}
