import Link from "next/link";
import { FlaskConical, ArrowUpRight } from "lucide-react";
import { ProductionRefresh } from "./forms";
import { elapsedMinutes, minutesLabel } from "@/lib/production";

type Request = {
  id: string; calledAt: Date; arrivedAt: Date | null; hasStop: boolean; stopEndedAt: Date | null;
  technician: { name: string } | null;
  batch: { id: string; lot: string; reference: string; line: string; equipment: { code: string | null; name: string } };
};
const date = (value: Date) => new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "medium" }).format(value);

export function QualityRequests({ calls, now }: { calls: Request[]; now: Date }) {
  return <section className="space-y-4 border-b border-zinc-800 pb-5" data-testid="quality-requests">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><FlaskConical size={20} className="text-teal-300" />Pedidos de controlo de qualidade</h2><ProductionRefresh live /></div>
    {([false, true] as const).map(started => {
      const rows = calls.slice(0, 100).filter(c => Boolean(c.arrivedAt) === started);
      return <section key={String(started)} className="space-y-2"><h3 className="font-semibold text-zinc-300">{started ? "Em controlo" : "A aguardar técnico"} ({rows.length})</h3>
        {rows.length ? <ul className="divide-y divide-zinc-800">{rows.map(c => <li key={c.id} className="grid min-w-0 gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center" data-testid={`quality-request-${c.id}`}>
          <div className="min-w-0 space-y-1"><p className="break-words font-semibold">Lote {c.batch.lot} · {c.batch.reference}</p><p className="break-words text-sm text-zinc-400">{c.batch.line} · {c.batch.equipment.code || c.batch.equipment.name} · Chamada: {date(c.calledAt)}</p><p className="text-sm">{started ? `${c.technician?.name || "Técnico"} · ${minutesLabel(elapsedMinutes(c.arrivedAt!, null, now))}` : `Espera: ${minutesLabel(elapsedMinutes(c.calledAt, null, now))}`}{c.hasStop && !c.stopEndedAt && <strong className="ml-3 text-amber-200">Produção parada</strong>}</p></div>
          <Link href={`/producao?lote=${c.batch.id}#cq-${c.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-teal-300/50 px-4 text-sm font-semibold text-teal-200"><ArrowUpRight size={17} />Abrir pedido</Link>
        </li>)}</ul> : <p className="py-2 text-sm text-zinc-400">{started ? "Sem controlos em curso." : "Sem pedidos em espera."}</p>}
      </section>;
    })}
    {calls.length > 100 && <p className="text-sm text-amber-200">Mostrados os 100 pedidos mais antigos.</p>}
  </section>;
}
