"use client";

import { startTransition, useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { productionAction } from "./actions";
import { inputClass } from "@/app/components/ui";

export function ProductionForm({ children, className = "", batchId, command }: { children: ReactNode; className?: string; batchId?: string; command: string }) {
  const [result, action, pending] = useActionState(productionAction, {});
  const router = useRouter();
  useEffect(() => {
    if (result.success) {
      if (!batchId && result.batchId) router.push(`/producao?lote=${encodeURIComponent(result.batchId)}`);
      router.refresh();
    }
  }, [result, router, batchId]);
  return <form className={className} onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }}>
    <input type="hidden" name="command" value={command} />
    {batchId && <input type="hidden" name="batchId" value={batchId} />}
    <fieldset disabled={pending} className="min-w-0 space-y-3 disabled:opacity-60">{children}</fieldset>
    <p role="status" aria-live="polite" className={`mt-2 text-sm ${result.error ? "text-rose-300" : "text-teal-200"}`}>{pending ? "A guardar…" : result.error || result.success}</p>
  </form>;
}

export function StopFields({ hasStop = false, start = "", end = "" }: { hasStop?: boolean; start?: string; end?: string }) {
  const [stopped, setStopped] = useState(hasStop);
  return <div className="space-y-3 border-t border-zinc-800 pt-3">
    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" name="hasStop" checked={stopped} onChange={e => setStopped(e.target.checked)} className="size-5 accent-teal-300" />Houve paragem de produção?</label>
    {stopped && <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm text-zinc-300">Início da paragem<input type="datetime-local" name="stopStartedAt" required defaultValue={start} className={inputClass} /></label>
      <label className="space-y-1 text-sm text-zinc-300">Fim da paragem<input type="datetime-local" name="stopEndedAt" defaultValue={end} className={inputClass} /></label>
    </div>}
  </div>;
}
