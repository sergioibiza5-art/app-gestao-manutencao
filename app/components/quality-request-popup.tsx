"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, FlaskConical, X } from "lucide-react";
import { qualityPopupAcknowledged, qualityPopupStorageKey, type QualityPopupCall } from "@/lib/quality-popup";

const date = (value: string) => new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function QualityRequestPopup({ userId }: { userId: string }) {
  const [calls, setCalls] = useState<QualityPopupCall[]>([]);
  const acknowledged = useRef(new Set<string>());
  const storageKey = qualityPopupStorageKey(userId);

  useEffect(() => {
    let disposed = false, busy = false;
    const controller = new AbortController();
    try { acknowledged.current = new Set(qualityPopupAcknowledged(localStorage.getItem(storageKey))); } catch { /* Private browsing may disable storage. */ }
    const poll = async () => {
      if (disposed || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const response = await fetch("/api/producao/quality-requests", { cache: "no-store", signal: controller.signal });
        if (disposed) return;
        if (response.status === 401 || response.status === 403) { setCalls([]); return; }
        if (!response.ok) return;
        const data: { calls: QualityPopupCall[] } = await response.json();
        if (!disposed) setCalls(data.calls.filter(call => !acknowledged.current.has(call.id)));
      } catch { /* Keep the last known requests during a temporary network failure. */ }
      finally { busy = false; }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      for (const id of qualityPopupAcknowledged(event.newValue)) acknowledged.current.add(id);
      setCalls(current => current.filter(call => !acknowledged.current.has(call.id)));
    };
    void poll();
    const interval = setInterval(() => { void poll(); }, 10_000);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("focus", poll);
    window.addEventListener("storage", onStorage);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("focus", poll);
      window.removeEventListener("storage", onStorage);
    };
  }, [storageKey]);

  function dismiss(ids: string[]) {
    for (const id of ids) acknowledged.current.add(id);
    try {
      for (const id of qualityPopupAcknowledged(localStorage.getItem(storageKey))) acknowledged.current.add(id);
      localStorage.setItem(storageKey, JSON.stringify([...acknowledged.current].slice(-500)));
    } catch { /* In-memory acknowledgement still prevents repeated popups. */ }
    setCalls(current => current.filter(call => !acknowledged.current.has(call.id)));
  }

  if (!calls.length) return null;
  return <section aria-label="Avisos de controlo de qualidade" data-testid="quality-request-popup" className="fixed bottom-3 right-3 z-50 w-[calc(100%-1.5rem)] max-w-md overflow-hidden rounded-lg border border-teal-300/60 bg-zinc-950 text-zinc-100 shadow-2xl sm:bottom-5 sm:right-5">
    <header className="flex items-center justify-between gap-3 border-b border-zinc-700 px-4 py-2">
      <div role="status" aria-live="polite" className="flex min-w-0 items-center gap-2 font-semibold"><FlaskConical size={20} className="shrink-0 text-teal-300" /><span>{calls.length === 1 ? "Novo pedido de CQ" : `Novos pedidos de CQ (${calls.length})`}</span></div>
      <button type="button" onClick={() => dismiss(calls.map(c => c.id))} aria-label="Dispensar todos os avisos de CQ" title="Dispensar avisos" className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-zinc-800"><X size={19} /></button>
    </header>
    <ul className="max-h-[55dvh] divide-y divide-zinc-800 overflow-y-auto overscroll-contain">{calls.map(call => <li key={call.id} data-testid={`quality-popup-${call.id}`} className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words font-semibold">Lote {call.lot}</p><p className="break-words text-sm text-zinc-300">{call.reference}</p></div><button type="button" aria-label={`Dispensar aviso do lote ${call.lot}`} title="Dispensar aviso" onClick={() => dismiss([call.id])} className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-zinc-800"><X size={17} /></button></div>
      <p className="break-words text-sm text-zinc-400">{call.line} · {call.equipment} · {date(call.calledAt)}</p>
      {call.stopped && <p className="text-sm font-semibold text-amber-200">Produção parada</p>}
      <Link href={`/producao?lote=${call.batchId}#cq-${call.id}`} onClick={() => dismiss([call.id])} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-teal-300 px-4 text-sm font-semibold text-zinc-950"><ArrowUpRight size={17} />Abrir pedido</Link>
    </li>)}</ul>
  </section>;
}
