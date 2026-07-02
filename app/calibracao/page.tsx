import Link from "next/link";
import { AlertTriangle, CalendarDays, FileSpreadsheet, Search } from "lucide-react";

import { createCalibrationLog, importCalibrationsCsv, updateCalibrationLog } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type CalibrationPageProps = {
  searchParams?: Promise<{ q?: string; approved?: string; year?: string; month?: string; calibrationId?: string }>;
};

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function calibrationTone(nextDueDate: Date | null) {
  if (!nextDueDate) return "border-zinc-800 bg-black/30 text-zinc-100";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return "border-rose-300/50 bg-rose-950/25 text-rose-100";
  if (days <= 30) return "border-amber-300/50 bg-amber-950/25 text-amber-100";
  if (days <= 60) return "border-yellow-300/45 bg-yellow-950/20 text-yellow-100";
  return "border-emerald-300/35 bg-emerald-950/15 text-emerald-100";
}

function calibrationStatus(nextDueDate: Date | null) {
  if (!nextDueDate) return "Sem data";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return "Vencida";
  if (days === 0) return "Vence hoje";
  return `${days} dias`;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekDaysForMonth(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const start = new Date(first);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  const weeks: { label: string; days: { name: string; date: Date; inMonth: boolean }[] }[] = [];
  const names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
  const cursor = new Date(start);
  let week = 1;

  while (cursor <= last || weeks.length < 5) {
    const monday = new Date(cursor);
    const days = names.map((name, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { name, date, inMonth: date.getMonth() === monthIndex };
    });

    if (days.some((day) => day.inMonth)) {
      weeks.push({ label: `Semana ${week}`, days });
      week += 1;
    }

    cursor.setDate(cursor.getDate() + 7);
    if (cursor.getFullYear() > year && cursor.getMonth() > monthIndex) break;
    if (weeks.length > 6) break;
  }

  return weeks;
}

export default async function CalibrationPage({ searchParams }: CalibrationPageProps) {
  const params = (await searchParams) ?? {};
  const { equipment, calibrationLogs } = await getModuleData();
  const q = normalize(params.q);
  const approved = params.approved || "all";
  const selectedYear = Number(params.year || new Date().getFullYear());
  const selectedMonth = params.month ? Math.min(Math.max(Number(params.month), 1), 12) : null;
  const activeCalibrationLogs = calibrationLogs.filter((log) => log.active);
  const latestCalibrationByEquipment = Object.values(
    activeCalibrationLogs.reduce<Record<string, (typeof calibrationLogs)[number]>>((acc, log) => {
      acc[log.equipmentId] ??= log;
      return acc;
    }, {}),
  );
  const annualCalibrationMap = monthNames.map((month, index) => ({
    month,
    items: latestCalibrationByEquipment
      .filter((log) => log.nextDueDate && log.nextDueDate.getFullYear() === selectedYear && log.nextDueDate.getMonth() === index)
      .sort((a, b) => (a.nextDueDate?.getTime() ?? 0) - (b.nextDueDate?.getTime() ?? 0)),
  }));
  const filteredLogs = calibrationLogs.filter((log) => {
    const haystack = [log.title, log.certificateNo, log.result, log.notes, log.equipment.name, log.equipment.code].map(normalize).join(" ");
    return (!q || haystack.includes(q)) && (approved === "all" || String(log.approved) === approved);
  });
  const templateHref =
    "data:text/csv;charset=utf-8," +
    encodeURIComponent("codigo_equipamento;equipamento;descricao;numero_certificado;data_calibracao;proxima_validade;resultado;aprovado;link_certificado;nome_ficheiro;notas\nEQ-001;;Calibracao anual;CERT-001;2026-01-10;2027-01-10;Conforme;sim;https://...;certificado.pdf;\n");
  const selectedMonthItems = selectedMonth ? annualCalibrationMap[selectedMonth - 1]?.items ?? [] : [];
  const selectedWeeks = selectedMonth ? weekDaysForMonth(selectedYear, selectedMonth - 1) : [];
  const calibrationsByDay = selectedMonthItems.reduce<Record<string, typeof selectedMonthItems>>((acc, log) => {
    if (!log.nextDueDate) return acc;
    const key = dateKey(log.nextDueDate);
    acc[key] ??= [];
    acc[key].push(log);
    return acc;
  }, {});

  return (
    <AppShell activeHref="/calibracao">
      <PageHeader
        eyebrow="Metrologia"
        title="Calibracao de equipamentos"
        description="Controla certificados, resultados, aprovacao e proxima validade dos equipamentos calibraveis."
      />

      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <CalendarDays size={22} className="mt-1 text-lime-300" />
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Mapa anual de calibracoes</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Ultima validade por equipamento, com alerta por tempo restante.
              </p>
            </div>
          </div>

          <form className="grid gap-2 sm:grid-cols-[150px_auto]">
            <input name="year" className={inputClass} defaultValue={selectedYear} aria-label="Ano do mapa" />
            <button className={buttonClass}>
              <Search size={16} />
              Ver ano
            </button>
          </form>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {annualCalibrationMap.map(({ month, items }, index) => (
            <div key={month} className="min-h-44 overflow-hidden rounded-lg border border-lime-300/20 bg-zinc-950/60">
              <div className="border-b border-lime-300/20 bg-lime-300/10 px-4 py-3">
                <Link href={`/calibracao?year=${selectedYear}&month=${index + 1}`} className="block text-xs font-semibold uppercase tracking-[0.18em] text-lime-200 transition hover:text-lime-100">
                  {month}
                </Link>
              </div>
              <div className="space-y-2 p-3">
                {items.length === 0 ? (
                  <p className="text-xs text-zinc-600">Sem calibracoes</p>
                ) : (
                  items.slice(0, 4).map((log) => (
                    <Link
                      key={log.id}
                      href={`/calibracao?year=${selectedYear}&calibrationId=${log.id}#calibration-${log.id}`}
                      className={`block rounded-md border px-2 py-2 transition hover:border-lime-200/70 ${calibrationTone(log.nextDueDate)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-zinc-50">{log.title}</p>
                          <p className="mt-1 truncate text-[11px] text-zinc-400">{log.equipment.name}</p>
                        </div>
                        {calibrationStatus(log.nextDueDate) !== "Sem data" ? (
                          <AlertTriangle size={14} className="shrink-0" />
                        ) : null}
                      </div>
                      <p className="mt-2 text-[11px] font-semibold">{formatDate(log.nextDueDate)}</p>
                      <p className="mt-1 text-[11px] text-zinc-400">{calibrationStatus(log.nextDueDate)}</p>
                    </Link>
                  ))
                )}
                {items.length > 4 ? (
                  <Link href={`/calibracao?year=${selectedYear}&month=${index + 1}`} className="block rounded-md border border-lime-300/30 bg-lime-300/10 px-2 py-2 text-center text-xs font-semibold text-lime-200 transition hover:border-lime-200/70">
                    + {items.length - 4} calibracoes
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {selectedMonth ? (
          <div className="mt-6 rounded-xl border border-lime-300/20 bg-zinc-950/45 p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold uppercase tracking-[0.14em] text-zinc-100">
                  {monthNames[selectedMonth - 1]} por semanas
                </h3>
                <p className="text-sm text-zinc-500">Visualizacao de segunda a sexta para as proximas calibracoes do mes.</p>
              </div>
              <Link
                href={`/calibracao?year=${selectedYear}`}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 text-sm font-semibold text-zinc-200 transition hover:border-lime-300/40 hover:text-lime-200"
              >
                Fechar semanas
              </Link>
            </div>

            <div className="space-y-4">
              {selectedWeeks.map((week) => (
                <div key={week.label} className="overflow-hidden rounded-lg border border-lime-300/20">
                  <div className="border-b border-lime-300/20 bg-lime-300/10 px-4 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime-200">{week.label}</p>
                  </div>
                  <div className="grid md:grid-cols-5">
                    {week.days.map((day) => {
                      const dayItems = calibrationsByDay[dateKey(day.date)] ?? [];
                      return (
                        <div key={dateKey(day.date)} className={`min-h-48 border-b border-lime-300/10 p-3 md:border-b-0 md:border-r md:last:border-r-0 ${day.inMonth ? "bg-zinc-950/60" : "bg-zinc-950/20 opacity-45"}`}>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lime-200">{day.name}</p>
                          <p className="mt-1 text-[11px] text-zinc-500">{formatDate(day.date)}</p>
                          <div className="mt-3 space-y-2">
                            {dayItems.length === 0 ? (
                              <p className="text-xs text-zinc-600">Sem calibrações</p>
                            ) : (
                              dayItems.map((log) => (
                                <Link
                                  key={log.id}
                                  href={`/calibracao?year=${selectedYear}&month=${selectedMonth}&calibrationId=${log.id}#calibration-${log.id}`}
                                  className={`block rounded-md border px-2 py-2 transition hover:border-lime-200/70 ${calibrationTone(log.nextDueDate)}`}
                                >
                                  <p className="text-xs font-semibold text-zinc-50">{log.title}</p>
                                  <p className="mt-1 text-[11px] text-zinc-400">{log.equipment.name}</p>
                                  <p className="mt-2 text-[11px] font-semibold">{calibrationStatus(log.nextDueDate)}</p>
                                </Link>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Nova calibracao</h2>
          <form action={createCalibrationLog} className="mt-4 space-y-3">
            <select name="equipmentId" required className={inputClass}>
              <option value="">Selecionar equipamento</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input name="title" required className={inputClass} placeholder="Descricao" />
            <input name="certificateNo" className={inputClass} placeholder="N. certificado" />
            <div className="grid grid-cols-2 gap-3">
              <input name="calibrationDate" type="date" className={inputClass} />
              <input name="nextDueDate" type="date" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="result" className={inputClass} placeholder="Resultado" />
              <select name="approved" className={inputClass}>
                <option value="true">Aprovado</option>
                <option value="false">Reprovado</option>
              </select>
            </div>
            <input name="certificateUrl" className={inputClass} placeholder="Link/caminho do certificado" />
            <input name="certificateFileName" className={inputClass} placeholder="Nome do ficheiro do certificado" />
            <textarea name="notes" className={textareaClass} placeholder="Notas e criterios" />
            <button className={buttonClass}>Guardar calibracao</button>
          </form>

          <div className="mt-6 rounded-lg border border-zinc-800 bg-black/20 p-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={20} className="text-lime-300" />
              <h3 className="font-semibold text-zinc-100">Importar por Excel/CSV</h3>
            </div>
            <a href={templateHref} download="modelo_calibracoes.csv" className="mt-3 inline-flex text-sm font-semibold text-lime-200">
              Descarregar modelo
            </a>
            <form action={importCalibrationsCsv} encType="multipart/form-data" className="mt-3 grid gap-3">
              <input name="file" type="file" accept=".csv,text/csv" className={inputClass} />
              <button className={buttonClass}>Importar calibracoes</button>
            </form>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-zinc-50">Certificados</h2>
            <form className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
              <input name="q" defaultValue={params.q ?? ""} className={inputClass} placeholder="Pesquisar" />
              <select name="approved" defaultValue={approved} className={inputClass}>
                <option value="all">Todos</option>
                <option value="true">Aprovados</option>
                <option value="false">Reprovados</option>
              </select>
              <button className={buttonClass}>
                <Search size={16} />
                Filtrar
              </button>
            </form>
          </div>
          <div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-1">
            {filteredLogs.length === 0 ? (
              <EmptyState title="Sem calibracoes registadas" description="Os certificados e vencimentos passam a aparecer aqui." />
            ) : (
              filteredLogs.map((log) => {
                const certificate = log.documents.find((document) => document.type === "CERTIFICATE" && document.fileUrl);
                return (
                  <details
                    key={log.id}
                    id={`calibration-${log.id}`}
                    open={params.calibrationId === log.id}
                    className={`group scroll-mt-24 rounded-lg border bg-zinc-950/65 p-4 ${
                      params.calibrationId === log.id
                        ? "border-lime-300/70 shadow-[0_0_0_1px_rgba(190,242,100,0.25),0_0_35px_rgba(190,242,100,0.10)]"
                        : "border-zinc-800"
                    }`}
                  >
                    <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-100">{log.title}</h3>
                        <p className="mt-1 text-sm text-zinc-500">{log.equipment.name} - {log.certificateNo ?? "sem certificado"}</p>
                        {certificate && (
                          <a href={certificate.fileUrl ?? "#"} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-sky-300">
                            Abrir certificado
                          </a>
                        )}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className={log.active ? "text-xs font-semibold uppercase tracking-[0.14em] text-lime-300" : "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500"}>
                          {log.active ? "Vigente" : "Historico"}
                        </p>
                        <p className={log.approved ? "text-sm font-medium text-emerald-300" : "text-sm font-medium text-rose-300"}>
                          {log.approved ? "Aprovado" : "Reprovado"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">Prox.: {formatDate(log.nextDueDate)}</p>
                      </div>
                    </summary>
                    <form action={updateCalibrationLog} className="mt-4 grid gap-2 md:grid-cols-2">
                      <input type="hidden" name="id" value={log.id} />
                      <input name="title" className={inputClass} defaultValue={log.title} placeholder="Descricao" />
                      <input name="certificateNo" className={inputClass} defaultValue={log.certificateNo ?? ""} placeholder="N. certificado" />
                      <input name="calibrationDate" type="date" className={inputClass} defaultValue={log.calibrationDate.toISOString().slice(0, 10)} />
                      <input name="nextDueDate" type="date" className={inputClass} defaultValue={log.nextDueDate?.toISOString().slice(0, 10) ?? ""} />
                      <input name="result" className={inputClass} defaultValue={log.result ?? ""} placeholder="Resultado" />
                      <select name="approved" className={inputClass} defaultValue={log.approved ? "true" : "false"}>
                        <option value="true">Aprovado</option>
                        <option value="false">Reprovado</option>
                      </select>
                      <select name="active" className={inputClass} defaultValue={log.active ? "true" : "false"}>
                        <option value="true">Certificado vigente</option>
                        <option value="false">Historico / substituido</option>
                      </select>
                      <input name="certificateUrl" className={inputClass} defaultValue={certificate?.fileUrl ?? ""} placeholder="Link/caminho do certificado" />
                      <input name="certificateFileName" className={inputClass} defaultValue={certificate?.fileName ?? ""} placeholder="Nome do ficheiro" />
                      <textarea name="notes" className={`${textareaClass} md:col-span-2`} defaultValue={log.notes ?? ""} placeholder="Notas" />
                      <button className={buttonClass}>Guardar certificado</button>
                    </form>
                  </details>
                );
              })
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
