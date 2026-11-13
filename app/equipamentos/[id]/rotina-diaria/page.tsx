import Link from "next/link";
import { ArrowLeft, Download, Save } from "lucide-react";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import {
  biennialDueDate, canVerifyCleaning, cleaningDetails, currentMaintenancePeriods, dailyEntryStatus, dailyMaintenanceAccess, dailyMaintenanceMonth, dailyPath,
  dailyResults, displayDay, displayRecordedAt, entryChecks, lisbonDay, maintenancePeriodStart,
} from "@/lib/daily-maintenance";
import { cleaningDocumentCode, cleaningProduct, documentCode, isCleaning, maintenanceGroup, maintenancePlan } from "@/lib/mcc-maintenance-plan";
import { recordDailyMaintenance, verifyCleaning } from "./actions";

const errors: Record<string, string> = {
  dia: "A data mudou. Confirma o dia antes de guardar.",
  respostas: "Responde a todos os pontos antes de guardar.",
  horimetro: "Indica uma leitura válida do horímetro, com até duas casas decimais.",
  observacoes: "Descreve a falha nas observações. O limite é de 1000 caracteres.",
  atualizado: "Este dia já foi atualizado. Consulta o registo abaixo.",
  materiais: "Indica os produtos e os equipamentos utilizados.",
  verificacao: "O registo já foi verificado ou precisa de ser confirmado por outra pessoa.",
};

const periodLabels: Record<string, string> = {
  daily: "Hoje",
  weekly: "Esta semana",
  fortnightly: "Esta quinzena",
  monthly: "Este mês",
  semiannual: "Este semestre",
  annual: "Este ano",
};

export default async function DailyMaintenancePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string; grupo?: string; erro?: string; guardado?: string; verificado?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { equipment, units, canRecord, user } = await dailyMaintenanceAccess(id);
  const group = maintenanceGroup(equipment.code, query.grupo);
  const cleaning = isCleaning(group.key);
  const groups = maintenancePlan(equipment.code).filter((item) => isCleaning(item.key) === cleaning);
  const isDaily = group.key === "daily" || group.key === "cleaning-daily";
  const today = lisbonDay();
  const [report, periodEntries] = await Promise.all([
    dailyMaintenanceMonth(id, group.key, query.mes),
    currentMaintenancePeriods(id, groups.map(({ key }) => key), today),
  ]);
  const { month, days } = report;
  const periodStart = maintenancePeriodStart(group.key, today);
  const periodEntry = periodEntries.get(group.key);
  const nextBiennialDay = group.key === "biennial" && periodEntry ? biennialDueDate(periodEntry.day).toISOString().slice(0, 10) : null;
  const nextMeter = group.key === "500-hours" && periodEntry?.meterHours != null
    ? periodEntry.meterHours.plus(500).toString()
    : null;
  const visibleDays = isDaily ? days : days.filter(({ entries }) => entries.length > 0);
  const current = days.find(({ day }) => day === today)?.entries[0];
  const showToday = month === today.slice(0, 7);
  const save = recordDailyMaintenance.bind(null, id, group.key);
  const verify = verifyCleaning.bind(null, id, group.key, month);
  const error = query.erro ? errors[query.erro] : undefined;

  return (
    <AppShell activeHref="/equipamentos">
      <PageHeader eyebrow={cleaning ? cleaningDocumentCode : documentCode} title={cleaning ? "Limpezas" : "Plano preventivo"} description={equipment.name}
        action={<Link href={`/equipamentos/${id}`} className={buttonClass}><ArrowLeft size={17} /> Ficha</Link>} />
      <Panel>
        {!cleaning && <nav aria-label="Equipamentos do plano" className="flex flex-wrap gap-2">
          {units.map((unit) => (
            <Link key={unit.id} href={dailyPath(unit.id)} aria-current={unit.id === id ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold ${unit.id === id ? "border-teal-300 bg-teal-300/10 text-teal-200" : "border-zinc-700"}`}>
              {unit.code}
            </Link>
          ))}
        </nav>}
        <nav aria-label="Periodicidade" className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
          {groups.map((item) => {
            const entry = periodEntries.get(item.key);
            const hasFailures = entry && dailyEntryStatus(entry) === "Verificação com falhas";
            const biennialDue = item.key === "biennial" && entry && biennialDueDate(entry.day).toISOString().slice(0, 10) <= today;
            const pending = (!entry && item.key !== "500-hours") || biennialDue;
            const status = hasFailures ? "Com falhas" : pending ? "Pendente" : entry?.noProduction
              ? "Sem produção" : entry ? (cleaning ? entry.verifiedAt ? "Verificada" : "Por verificar" : "Registada") : "Sem leitura";
            return (
              <Link key={item.key} href={`?grupo=${item.key}&mes=${month}`} aria-current={item.key === group.key ? "page" : undefined}
                className={`inline-flex min-h-11 flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${item.key === group.key ? "border-teal-300 bg-teal-300/10 text-teal-200" : "border-zinc-700"}`}>
                {item.label}
                <span className={`text-xs ${hasFailures ? "text-rose-200" : pending || !entry || (cleaning && !entry.verifiedAt) ? "text-amber-200" : "text-teal-200"}`}>
                  {status}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-3 space-y-1 text-sm text-zinc-300">
          {periodStart && (
            <p>{periodLabels[group.key.replace(/^cleaning-/, "")]} · Desde {displayDay(periodStart.toISOString().slice(0, 10))}</p>
          )}
          <p>{periodEntry
            ? `${dailyEntryStatus(periodEntry)} em ${displayDay(periodEntry.day.toISOString().slice(0, 10))} por ${periodEntry.recorderName}.`
            : "Ainda sem verificação registada."}</p>
          {nextBiennialDay && <p>Próxima intervenção: {displayDay(nextBiennialDay)}{nextBiennialDay <= today ? " · Pendente" : ""}</p>}
          {group.key === "500-hours" && <p>{nextMeter
            ? `Horímetro no último registo: ${periodEntry?.meterHours?.toString()} h · Próxima intervenção: ${nextMeter} h`
            : "Sem leitura de referência para calcular a próxima intervenção."}</p>}
        </div>
      </Panel>
      {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
      {query.guardado === "1" && <p role="status" className="text-sm text-teal-200">Registo guardado.</p>}
      {query.verificado === "1" && <p role="status" className="text-sm text-teal-200">Verificação guardada.</p>}
      {showToday && (
        <Panel>
          <h2 className="text-xl font-semibold">{group.label} · {displayDay(today)}</h2>
          <p className="mt-1 text-sm text-zinc-400">Pág. {group.pages} · {group.primary} · {dailyEntryStatus(current)}</p>
          {canRecord && (!current || current.noProduction) && (
            <form action={save} className="mt-4 grid max-w-3xl gap-4">
              <input type="hidden" name="day" value={today} />
              <input type="hidden" name="revision" value={(current?.revision ?? 0) + 1} />
              {group.key === "500-hours" && <label className="grid gap-1 text-sm">Leitura do horímetro (h)
                <input type="number" name="meterHours" min="0" max="9999999999.99" step="0.01" required className={inputClass} />
              </label>}
              {group.checks.map(({ key, label }, index) => (
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
              {cleaning && <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">Produtos utilizados
                  <input name="products" defaultValue={cleaningProduct} maxLength={300} required className={inputClass} />
                </label>
                <label className="grid gap-1 text-sm">Equipamentos utilizados
                  <input name="tools" maxLength={300} required className={inputClass} />
                </label>
              </div>}
              <label className="grid gap-1 text-sm">Observações
                <textarea name="notes" maxLength={1000} className={textareaClass} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button name="mode" value="checks" className={buttonClass}><Save size={17} /> {cleaning ? "Guardar limpeza" : "Guardar verificação"}</button>
                {!cleaning && isDaily && !current && <button name="mode" value="no-production" formNoValidate className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm font-semibold">Sem produção</button>}
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
              <input type="hidden" name="grupo" value={group.key} />
              <label className="grid gap-1 text-sm">Mês
                <input name="mes" type="month" defaultValue={month} max={today.slice(0, 7)} required className={inputClass} />
              </label>
              <button className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm font-semibold">Ver mês</button>
            </form>
            <a href={`${dailyPath(id)}/pdf?mes=${month}&grupo=${group.key}`} className={buttonClass}><Download size={17} /> Exportar PDF</a>
          </div>
        </div>
        <ul className="mt-4 divide-y divide-zinc-800">
          {visibleDays.map(({ day, future, entries }) => {
            const latest = entries[0];
            return (
              <li key={day} className="py-1">
                {latest ? (
                  <details>
                    <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-4 px-2 py-2 text-sm">
                      <time dateTime={day} className="font-semibold tabular-nums">{displayDay(day)}</time>
                      <span className={dailyEntryStatus(latest) === "Verificação com falhas" ? "text-rose-200" : "text-teal-200"}>{dailyEntryStatus(latest)}</span>
                      <span className="break-words text-zinc-400">{latest.recorderName}</span>
                      {cleaning && <span className={latest.verifiedAt ? "text-teal-200" : "text-amber-200"}>{latest.verifiedAt ? "Verificada" : "Por verificar"}</span>}
                    </summary>
                    <ol className="space-y-3 px-2 pb-3">
                      {entries.map((entry) => {
                        const materials = cleaningDetails(entry);
                        return (
                        <li key={entry.id} className="space-y-1 border-l border-zinc-700 pl-3 text-sm">
                          <p className="font-semibold">{dailyEntryStatus(entry)} · {entry.recorderName}</p>
                          <p className="text-zinc-400">{displayRecordedAt(entry.recordedAt)} · {entry.documentCode}</p>
                          {entry.meterHours !== null && <p>Horímetro: {entry.meterHours.toString()} h</p>}
                          {entryChecks(entry).map(({ label, result }) => <p key={label}>{dailyResults[result]} · {label}</p>)}
                          {entry.notes && <p className="whitespace-pre-wrap break-words">{entry.notes}</p>}
                          {materials && <>
                            <p className="break-words">Produtos: {materials.products}</p>
                            <p className="break-words">Equipamentos: {materials.tools}</p>
                            <p>{entry.verifiedAt ? `Verificado por ${entry.verifierName} · ${displayRecordedAt(entry.verifiedAt)}` : "Por verificar"}</p>
                            {!entry.verifiedAt && canVerifyCleaning(user.role) && entry.recordedById !== user.id && (
                              <form action={verify} className="pt-2">
                                <input type="hidden" name="entryId" value={entry.id} />
                                <button className={buttonClass}>Confirmar verificação</button>
                              </form>
                            )}
                          </>}
                        </li>
                        );
                      })}
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
        {visibleDays.length === 0 && <p className="mt-3 text-sm text-zinc-400">Sem intervenções registadas neste mês.</p>}
      </Panel>
    </AppShell>
  );
}
