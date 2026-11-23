import Link from "next/link";
import { ArrowLeft, Download, Save } from "lucide-react";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import {
  biennialDueDate, canVerifyCleaning, cleaningDetails, cleaningPerformerMaxLength, cleaningPerformerName, currentMaintenancePeriods, dailyEntryStatus, dailyMaintenanceAccess, dailyMaintenanceMonth, dailyPath,
  dailyResults, displayDay, displayRecordedAt, entryChecks, lisbonDay, maintenancePeriodStart,
} from "@/lib/daily-maintenance";
import { cleaningProduct, isCleaning, maintenanceGroup, maintenancePlan } from "@/lib/mcc-maintenance-plan";
import { recordDailyMaintenance, recordMeterReading, verifyCleaning } from "./actions";
import { maintenanceMeterState } from "@/lib/maintenance-meter";
import { getPrisma } from "@/lib/prisma";

const errors: Record<string, string> = {
  dia: "A data mudou. Confirma o dia antes de guardar.",
  respostas: "Responde a todos os pontos antes de guardar.",
  horimetro: "Indica uma leitura válida do horímetro, com até duas casas decimais.",
  referencia: "As horas não podem ser inferiores à última leitura. A referência da última manutenção não pode exceder a leitura atual.",
  observacoes: "Descreve a falha nas observações. O limite é de 1000 caracteres.",
  atualizado: "Este dia já foi atualizado. Consulta o registo abaixo.",
  materiais: "Indica os produtos utilizados. Cada campo aceita até 300 caracteres.",
  assinatura: "Indica o nome de quem fez a limpeza.",
  pressao: "Indica a pressão medida em bar, com até duas casas decimais.",
  verificacao: "O registo já foi verificado ou precisa de ser confirmado por outra pessoa.",
};

const periodLabels: Record<string, string> = {
  daily: "Hoje",
  weekly: "Esta semana",
  fortnightly: "Esta quinzena",
  monthly: "Este mês",
  bimonthly: "Este bimestre",
  quarterly: "Este trimestre",
  semiannual: "Este semestre",
  annual: "Este ano",
};

export default async function DailyMaintenancePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string; grupo?: string; erro?: string; guardado?: string; verificado?: string; leitura?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { equipment, units, canRecord, user } = await dailyMaintenanceAccess(id);
  const isPost = user.role === "TICKET";
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
  const meterStates = new Map(await Promise.all(groups.filter((item) => item.intervalHours).map(async (item) => [
    item.key, await maintenanceMeterState(getPrisma(), id, item.key, item.intervalHours!, item.firstHours),
  ] as const)));
  const meterState = meterStates.get(group.key);
  const visibleDays = isDaily ? days : days.filter(({ entries }) => entries.length > 0);
  const current = days.find(({ day }) => day === today)?.entries[0];
  const showToday = month === today.slice(0, 7);
  const save = recordDailyMaintenance.bind(null, id, group.key);
  const verify = verifyCleaning.bind(null, id, group.key, month);
  const error = query.erro ? errors[query.erro] : undefined;

  return (
    <AppShell activeHref={isPost ? "/tickets" : "/equipamentos"}>
      <PageHeader eyebrow={group.documentCode} title={cleaning ? "Limpezas" : "Plano preventivo"} description={equipment.name}
        action={<Link href={isPost ? "/tickets#equipamentos-do-posto" : `/equipamentos/${id}`} className={buttonClass}>
          <ArrowLeft size={17} /> {isPost ? "Voltar ao posto" : "Ficha"}
        </Link>} />
      <Panel>
        {!cleaning && <nav aria-label="Equipamentos do plano" className="flex flex-wrap gap-2">
          {units.filter((unit) => maintenancePlan(unit.code).some((item) => item.documentCode === group.documentCode)).map((unit) => (
            <Link key={unit.id} href={`${dailyPath(unit.id)}?grupo=${maintenancePlan(unit.code).find((item) => item.documentCode === group.documentCode)?.key}`} aria-current={unit.id === id ? "page" : undefined}
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
            const pending = (!entry && !item.intervalHours) || biennialDue;
            const status = hasFailures ? "Com falhas" : pending ? "Pendente" : entry?.noProduction
              ? "Sem produção" : entry ? (cleaning ? entry.verifiedAt ? "Verificada" : "Por verificar" : "Registada") : "Sem leitura";
            const meter = meterStates.get(item.key);
            const remaining = meter?.next && meter.current ? meter.next.minus(meter.current) : null;
            const meterStatus = !meter?.current ? "Sem leitura" : !meter.next ? "Sem referência"
              : remaining!.lte(0) ? "Intervenção devida" : `Faltam ${remaining!.toString()} h`;
            return (
              <Link key={item.key} href={`?grupo=${item.key}&mes=${month}`} aria-current={item.key === group.key ? "page" : undefined}
                className={`inline-flex min-h-11 flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${item.key === group.key ? "border-teal-300 bg-teal-300/10 text-teal-200" : "border-zinc-700"}`}>
                {item.label}
                <span className={`text-xs ${hasFailures ? "text-rose-200" : pending || !entry || (cleaning && !entry.verifiedAt) ? "text-amber-200" : "text-teal-200"}`}>
                  {item.intervalHours ? meterStatus : status}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-3 space-y-1 text-sm text-zinc-300">
          {periodStart && (
            <p>{periodLabels[group.key.replace(/^(cleaning|conveyor)-/, "")]} · Desde {displayDay(periodStart.toISOString().slice(0, 10))}</p>
          )}
          <p>{periodEntry
            ? `${dailyEntryStatus(periodEntry)} em ${displayDay(periodEntry.day.toISOString().slice(0, 10))} por ${periodEntry.recorderName}.`
            : "Ainda sem verificação registada."}</p>
          {nextBiennialDay && <p>Próxima intervenção: {displayDay(nextBiennialDay)}{nextBiennialDay <= today ? " · Pendente" : ""}</p>}
          {meterState && <>
            <p>Última leitura: {meterState.current ? `${meterState.current.toString()} h` : "Sem leitura"}</p>
            <p>Última manutenção: {meterState.baseline !== null ? `${meterState.baseline.toString()} h` : "Sem referência"}</p>
            {meterState.next && <p>Próxima intervenção: {meterState.next.toString()} h{meterState.current
              ? meterState.current.gte(meterState.next) ? " · Intervenção devida" : ` · Faltam ${meterState.next.minus(meterState.current).toString()} h` : ""}</p>}
          </>}
        </div>
      </Panel>
      {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
      {query.guardado === "1" && <p role="status" className="text-sm text-teal-200">Registo guardado.</p>}
      {query.verificado === "1" && <p role="status" className="text-sm text-teal-200">Verificação guardada.</p>}
      {query.leitura === "1" && <p role="status" className="text-sm text-teal-200">Leitura guardada. Não foi registada uma manutenção.</p>}
      {showToday && meterState && <Panel>
        <h2 className="text-xl font-semibold">Leitura do horímetro</h2>
        {canRecord && <form action={recordMeterReading.bind(null, id, group.key)} className="mt-4 grid max-w-3xl gap-3">
          <input type="hidden" name="day" value={today} />
          <label className="grid gap-1 text-sm">Horas atuais (h)
            <input type="number" name="meterHours" min={meterState.current?.toString() ?? "0"} max="9999999999.99" step="0.01" required className={inputClass} />
          </label>
          {meterState.baseline === null && meterState.next === null && <label className="grid gap-1 text-sm">Horímetro na última manutenção (h)
            <input type="number" name="referenceHours" min="0" max="9999999999.99" step="0.01" required className={inputClass} />
          </label>}
          <button className={buttonClass}><Save size={17} /> Guardar apenas leitura</button>
        </form>}
        {meterState.reading && <p className="mt-3 text-sm text-zinc-400">{displayRecordedAt(meterState.reading.recordedAt)} · {meterState.reading.recorderName}</p>}
      </Panel>}
      {showToday && (
        <Panel>
          <h2 className="text-xl font-semibold">{group.intervalHours ? "Registar manutenção executada" : group.label} · {displayDay(today)}</h2>
          <p className="mt-1 text-sm text-zinc-400">Pág. {group.pages} · {group.primary} · {dailyEntryStatus(current)}</p>
          {canRecord && (!current || current.noProduction) && (
            <form key={`${id}:${group.key}`} action={save} className="mt-4 grid max-w-3xl gap-4">
              <input type="hidden" name="day" value={today} />
              <input type="hidden" name="revision" value={(current?.revision ?? 0) + 1} />
              {group.intervalHours && <label className="grid gap-1 text-sm">Leitura do horímetro (h)
                <input type="number" name="meterHours" min="0" max="9999999999.99" step="0.01" required className={inputClass} />
              </label>}
              {group.pressureReading && <label className="grid gap-1 text-sm">Pressão medida (bar)
                <input name="pressure" inputMode="decimal" required maxLength={6} className={inputClass} />
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
                  <input name="products" defaultValue={["MAS_2", "MAS_3"].includes(equipment.code ?? "") ? "" : cleaningProduct} maxLength={300} required className={inputClass} />
                </label>
                <label className="grid gap-1 text-sm">Equipamentos utilizados (opcional)
                  <input name="tools" maxLength={300} className={inputClass} />
                </label>
              </div>}
              <label className="grid gap-1 text-sm">Observações
                <textarea name="notes" maxLength={1000} className={textareaClass} />
              </label>
              {cleaning && (
                isPost ? (
                  <label className="grid gap-1 text-sm">Executada por
                    <input name="performedBy" maxLength={cleaningPerformerMaxLength} required autoComplete="off" className={inputClass} />
                  </label>
                ) : (
                  <p className="text-sm text-zinc-300">Executada por: <strong>{user.name}</strong></p>
                )
              )}
              <div className="flex flex-wrap gap-2">
                <button name="mode" value="checks" className={buttonClass}>
                  <Save size={17} />
                  {cleaning ? "Assinar execução" : "Guardar verificação"}
                </button>
                {isDaily && !current && <button name="mode" value="no-production" formNoValidate className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm font-semibold">Sem produção</button>}
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
                      {!cleaning && <span className="break-words text-zinc-400">{latest.recorderName}</span>}
                      {cleaning && latest.noProduction && (
                        <span className="break-words text-zinc-400">Assinalado por: {latest.recorderName}</span>
                      )}
                      {cleaning && !latest.noProduction && (
                        <span className="grid w-full min-w-0 grid-cols-2 gap-3 py-1 sm:w-auto sm:grow">
                          <span className="min-w-0 break-words">
                            <span className="block text-xs text-zinc-400">Executada por</span>
                            {cleaningPerformerName(latest)}
                            <span className="block text-xs text-zinc-400">{displayRecordedAt(latest.recordedAt)}</span>
                          </span>
                          <span className={`min-w-0 break-words ${latest.verifiedAt ? "text-teal-200" : "text-amber-200"}`}>
                            <span className="block text-xs text-zinc-400">Verificada por</span>
                            {latest.verifiedAt ? latest.verifierName ?? "Nome não registado" : "Por verificar"}
                            {latest.verifiedAt && <span className="block text-xs text-zinc-400">{displayRecordedAt(latest.verifiedAt)}</span>}
                          </span>
                        </span>
                      )}
                    </summary>
                    <ol className="space-y-3 px-2 pb-3">
                      {entries.map((entry) => {
                        const materials = cleaningDetails(entry);
                        return (
                        <li key={entry.id} className="space-y-1 border-l border-zinc-700 pl-3 text-sm">
                          <p className="font-semibold">{dailyEntryStatus(entry)} · {materials ? cleaningPerformerName(entry) : entry.recorderName}</p>
                          <p className="text-zinc-400">{displayRecordedAt(entry.recordedAt)} · {entry.documentCode}</p>
                          {materials?.performedBy && <p className="break-words text-zinc-400">Conta do posto: {entry.recorderName}</p>}
                          {entry.meterHours !== null && <p>Horímetro: {entry.meterHours.toString()} h</p>}
                          {entryChecks(entry).map(({ label, result, reading }) => <p key={label}>{dailyResults[result]} · {label}{reading ? ` · ${reading}` : ""}</p>)}
                          {entry.notes && <p className="whitespace-pre-wrap break-words">{entry.notes}</p>}
                          {materials && <>
                            <p className="break-words">Produtos: {materials.products}</p>
                            {materials.tools && <p className="break-words">Equipamentos: {materials.tools}</p>}
                            {!entry.verifiedAt && canVerifyCleaning(user) && entry.recordedById !== user.id && (
                              <form action={verify} className="pt-2">
                                <input type="hidden" name="entryId" value={entry.id} />
                                <button className={buttonClass}>Assinar verificação</button>
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
