"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { productionAction } from "./actions";
import { inputClass, buttonClass } from "@/app/components/ui";
import { RefreshCw, Square, X } from "lucide-react";

export function CloseBatchControl({ batchId, lot, quantity, unit, activities, quality, stops }: {
  batchId: string; lot: string; quantity: string; unit: string; activities: number; quality: number; stops: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const pending = activities + quality + stops;
  return <>
    <button type="button" onClick={() => { setAttempt(value => value + 1); dialog.current?.showModal(); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm font-semibold"><Square size={17} />Fechar lote</button>
    <dialog ref={dialog} aria-labelledby="close-batch-title" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 p-5 text-zinc-100 backdrop:bg-black/70">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 id="close-batch-title" className="min-w-0 break-words text-lg font-semibold">Fechar lote {lot}</h2><button type="button" aria-label="Cancelar fecho" title="Cancelar fecho" onClick={() => dialog.current?.close()} className="grid size-11 shrink-0 place-items-center rounded-lg border border-zinc-700"><X size={18} /></button></div>
      <dl className="mb-4 grid grid-cols-3 gap-3 border-y border-zinc-800 py-3 text-sm">{[["Atividades em curso", activities], ["CQ por terminar", quality], ["Paragens em curso", stops]].map(([label, value]) => <div key={String(label)}><dt className="text-zinc-400">{label}</dt><dd className={`mt-1 text-xl font-semibold ${Number(value) ? "text-amber-200" : "text-teal-200"}`}>{value}</dd></div>)}</dl>
      {pending > 0 && <div className="mb-4 space-y-2"><p role="alert" className="text-sm text-amber-200">Existem registos por terminar. O lote ainda não pode ser fechado.</p><button type="button" onClick={() => router.refresh()} className="inline-flex min-h-11 items-center gap-2 text-sm text-teal-200"><RefreshCw size={17} />Atualizar pendências</button></div>}
      <ProductionForm key={attempt} command="batch-end" batchId={batchId}>
        <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">Quantidade final produzida<input name="quantity" type="number" min="0" step="0.001" required defaultValue={quantity} className={inputClass} /></label><label className="space-y-1 text-sm">Unidade<input name="unit" required maxLength={180} defaultValue={unit} className={inputClass} /></label></div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="confirmClose" value="true" required className="size-5 shrink-0 accent-teal-300" />Confirmo a quantidade final e o fecho deste lote.</label>
        <button data-testid="confirm-close-batch" disabled={pending > 0} className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-40`}><Square size={17} />Confirmar fecho</button>
      </ProductionForm>
    </dialog>
  </>;
}

export function ProductionRefresh({ live }: { live: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible" || document.activeElement?.matches("input,textarea,select")) return;
      router.refresh();
    }, 15_000);
    return () => clearInterval(interval);
  }, [live, router]);
  return <button type="button" title="Atualizar lote" aria-label="Atualizar lote" onClick={() => router.refresh()} className="grid size-11 place-items-center rounded-lg border border-zinc-700 hover:border-teal-300"><RefreshCw size={18} /></button>;
}

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
