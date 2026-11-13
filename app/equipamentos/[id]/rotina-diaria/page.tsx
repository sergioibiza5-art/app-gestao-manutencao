import Link from "next/link";
import { ArrowLeft, Download, Save } from "lucide-react";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import {
  dailyChecks, dailyEntryStatus, dailyMaintenanceAccess, dailyMaintenanceMonth, dailyPath,
  dailyResults, displayDay, displayRecordedAt, documentCode, entryChecks,
} from "@/lib/daily-maintenance";
import { recordDailyMaintenance } from "./actions";

const errors: Record<string, string> = {
  dia: "A data mudou. Confirma o dia antes de guardar.",
  respostas: "Responde aos três pontos antes de guardar.",
  observacoes: "Descreve a falha nas observações. O limite é de 1000 caracteres.",
  atualizado: "Este dia já foi atualizado. Consulta o registo abaixo.",
};

export default async function DailyMaintenancePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string; erro?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { equipment, canRecord } = await dailyMaintenanceAccess(id);
  const { month, today, days } = await dailyMaintenanceMonth(id, query.mes);
  const current = days.find(({ day }) => day === today)?.entries[0];
  const showToday = month === today.slice(0, 7);
  const save = recordDailyMaintenance.bind(null, id);
  const error = query.erro ? errors[query.erro] : undefined;

  return (
    <AppShell activeHref="/equipamentos">
      <PageHeader eyebrow={documentCode} title="Rotina diária" description={equipment.name}
        action={<Link href={`/equipamentos/${id}`} className={buttonClass}><ArrowLeft size={17} /> Ficha</Link>} />
      {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
      {query.guardado === "1" && <p role="status" className="text-sm text-teal-200">Registo guardado.</p>}
      {showToday && (
        <Panel>
          <h2 className="text-xl font-semibold">Hoje · {displayDay(today)}</h2>
          <p className="mt-1 text-sm text-zinc-400">{dailyEntryStatus(current)}</p>
          {canRecord && (!current || current.noProduction) && (
            <form action={save} className="mt-4 grid max-w-3xl gap-4">
              <input type="hidden" name="day" value={today} />
              <input type="hidden" name="revision" value={(current?.revision ?? 0) + 1} />
              {dailyChecks.map(({ key, label }, index) => (
                <fieldset key={key} className="min-w-0 border-b border-zinc-800 pb-3">
                  <legend className="mb-2 text-sm font-medium">{index + 1}. {label}</legend>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(dailyResults).map(([value, text]) => (
                      <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm has-checked:border-teal-300">
                        <input type="radio" name={key} value={value} required className="accent-teal-300" />
                        {text}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <label className="grid gap-1 text-sm">Observações
                <textarea name="notes" maxLength={1000} className={textareaClass} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button name="mode" value="checks" className={buttonClass}><Save size={17} /> Guardar verificação</button>
                {!current && <button name="mode" value="no-production" formNoValidate className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm font-semibold">Sem produção</button>}
              </div>
            </form>
          )}
        </Panel>
      )}
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Registo mensal</h2>
          <div className="flex flex-wrap items-end gap-2">
            <form className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-sm">Mês
                <input name="mes" type="month" defaultValue={month} max={today.slice(0, 7)} required className={inputClass} />
              </label>
              <button className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm font-semibold">Ver mês</button>
            </form>
            <a href={`${dailyPath(id)}/pdf?mes=${month}`} className={buttonClass}><Download size={17} /> Exportar PDF</a>
          </div>
        </div>
        <ul className="mt-4 divide-y divide-zinc-800">
          {days.map(({ day, future, entries }) => {
            const latest = entries[0];
            return (
              <li key={day} className="py-1">
                {latest ? (
                  <details>
                    <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-4 px-2 py-2 text-sm">
                      <time dateTime={day} className="font-semibold tabular-nums">{displayDay(day)}</time>
                      <span className={dailyEntryStatus(latest) === "Verificação com falhas" ? "text-rose-200" : "text-teal-200"}>{dailyEntryStatus(latest)}</span>
                      <span className="break-words text-zinc-400">{latest.recorderName}</span>
                    </summary>
                    <ol className="space-y-3 px-2 pb-3">
                      {entries.map((entry) => (
                        <li key={entry.id} className="space-y-1 border-l border-zinc-700 pl-3 text-sm">
                          <p className="font-semibold">{dailyEntryStatus(entry)} · {entry.recorderName}</p>
                          <p className="text-zinc-400">{displayRecordedAt(entry.recordedAt)} · {entry.documentCode}</p>
                          {entryChecks(entry).map(({ label, result }) => <p key={label}>{dailyResults[result]} · {label}</p>)}
                          {entry.notes && <p className="whitespace-pre-wrap break-words">{entry.notes}</p>}
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : (
                  <div className="flex min-h-11 flex-wrap items-center gap-x-4 px-2 py-2 text-sm">
                    <time dateTime={day} className="font-semibold tabular-nums">{displayDay(day)}</time>
                    <span className="text-zinc-400">{future ? "Dia futuro" : "Sem registo"}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </AppShell>
  );
}
