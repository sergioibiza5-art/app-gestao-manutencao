"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { calibrationGroup, calibrationGroups } from "@/lib/calibration-alerts";
import { claimCalibrationSummary } from "./alert-actions";

type Entry = { id: string; title: string; equipment: string; date: string; days: number };

export function CalibrationSummary({ entries, manual, automatic }: { entries: Entry[]; manual: boolean; automatic: boolean }) {
  const [visible, setVisible] = useState(manual);
  const [failed, setFailed] = useState(false);
  const claim = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    if (!automatic || manual || !entries.length) return;
    let mounted = true;
    claim.current ??= claimCalibrationSummary();
    claim.current.then(show => { if (mounted) setVisible(show); })
      .catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, [automatic, manual, entries.length]);

  return (
    <div className="mt-4">
      <form action="/calibracao" method="get">
        <button className="rounded-lg border border-teal-400/50 px-4 py-2 text-teal-200" name="alertas" value="verificar">Verificar calibrações</button>
      </form>
      {failed && <p role="alert">Falhou a verificação automática. Usa «Verificar calibrações» para consultar os prazos.</p>}
      {visible && (
        <section aria-label="Resumo de calibrações" className="mt-3 space-y-3 rounded-lg border border-zinc-700 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Resumo de calibrações</h3>
            <button onClick={() => setVisible(false)} className="px-3 py-2 text-zinc-300">Fechar</button>
          </div>
          {!entries.length && <p>Sem calibrações vencidas ou a vencer nos próximos 30 dias.</p>}
          {calibrationGroups.map((label, index) => {
            const items = entries.filter(entry => calibrationGroup(entry.days) === index);
            if (!items.length) return null;
            return <div key={label}>
              <h4 className="font-semibold text-amber-200">{label} ({items.length})</h4>
              {items.map(item => <Link key={item.id} className="block rounded p-2 hover:bg-zinc-800 underline" href={`/calibracao?calibrationId=${item.id}#calibration-${item.id}`}>
                {item.title} · {item.equipment} · {item.date} · {item.days < 0 ? "Vencida há" : item.days === 0 ? "Vence hoje" : "Faltam"} {item.days !== 0 && `${Math.abs(item.days)} ${Math.abs(item.days) === 1 ? "dia" : "dias"}`}
              </Link>)}
            </div>;
          })}
        </section>
      )}
    </div>
  );
}
