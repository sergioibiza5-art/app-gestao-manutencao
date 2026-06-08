import { CalendarDays, Filter, Map, Plus, Trash2 } from "lucide-react";

import { createAnnualMaintenanceSchedule, createMaintenanceLog, createWorkOrderFromSchedule, deleteMaintenanceLog, deleteMaintenanceSchedule, updateMaintenanceLog, updateMaintenanceSchedule } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getMaintenanceData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type MaintenancePageProps = {
  searchParams: Promise<{
    view?: string;
    date?: string;
    type?: string;
  }>;
};

function typeLabel(type: string) {
  return type === "EXTERNAL" ? "Externa" : "Interna";
}

function statusLabel(status: string) {
  if (status === "DONE") return "Concluída";
  if (status === "CANCELED") return "Cancelada";
  return "Agendada";
}

function dateInputValue(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function groupByDate<T extends { scheduledAt: Date }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = formatDate(item.scheduledAt);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}

export default async function MaintenancePage({ searchParams }: MaintenancePageProps) {
  const filters = await searchParams;
  const selectedView = filters.view || "month";
  const selectedDate = filters.date || new Date().toISOString().slice(0, 10);
  const selectedType = filters.type || "ALL";
  const { equipment, maintenanceLogs, schedules, range } = await getMaintenanceData({
    view: selectedView,
    date: selectedDate,
    type: selectedType,
  });
  const groupedSchedules = groupByDate(schedules);
  const year = new Date().getFullYear();

  return (
    <AppShell activeHref="/manutencao">
      <PageHeader
        eyebrow="Ativos"
        title="Manutenção"
        description="Cria manutenções internas ou externas, agenda o ano completo e consulta o mapa por dia, semana, mês ou ano."
        action={
          <a href="#agendamento-anual" className={buttonClass}>
            <Plus size={18} />
            Agendar ano
          </a>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <CalendarDays size={22} className="text-cyan-300" />
            <h2 id="agendamento-anual" className="text-xl font-semibold text-zinc-50">Agendamento anual</h2>
          </div>
          <form action={createAnnualMaintenanceSchedule} className="mt-4 space-y-3">
            <select name="equipmentId" required className={inputClass}>
              <option value="">Selecionar equipamento</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input name="title" required className={inputClass} placeholder="Manutenção a agendar" />
            <div className="grid grid-cols-2 gap-3">
              <select name="type" className={inputClass}>
                <option value="INTERNAL">Interna</option>
                <option value="EXTERNAL">Externa</option>
              </select>
              <select name="frequency" className={inputClass}>
                <option value="MONTHLY">Mensal</option>
                <option value="QUARTERLY">Trimestral</option>
                <option value="FOUR_MONTHLY">Quadrimestral</option>
                <option value="SEMIANNUAL">Semestral</option>
                <option value="ANNUAL">Anual</option>
                <option value="WEEKLY">Semanal</option>
                <option value="DAILY">Diária</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="year" defaultValue={year} className={inputClass} placeholder="Ano" />
              <input name="startDate" type="date" className={inputClass} />
            </div>
            <input name="supplier" className={inputClass} placeholder="Fornecedor / equipa" />
            <input name="costCenter" className={inputClass} placeholder="Centro de custos" />
            <textarea name="description" className={textareaClass} placeholder="Descrição, critério SGQ ou instrução de trabalho" />
            <button className={buttonClass}>Criar agendamentos do ano</button>
          </form>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Map size={22} className="text-teal-300" />
                <h2 className="text-xl font-semibold text-zinc-50">Mapa de agendamentos</h2>
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                {formatDate(range.start)} até {formatDate(range.end)}
              </p>
            </div>
            <div className="mb-1 grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <span>Periodo</span>
              <span>Data base</span>
              <span>Tipo</span>
              <span />
            </div>
            <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <select name="view" defaultValue={selectedView} className={inputClass}>
                <option value="day">Dia</option>
                <option value="week">Semana</option>
                <option value="month">Mês</option>
                <option value="year">Ano</option>
              </select>
              <input name="date" type="date" defaultValue={selectedDate} className={inputClass} />
              <select name="type" defaultValue={selectedType} className={inputClass}>
                <option value="ALL">Todas</option>
                <option value="INTERNAL">Internas</option>
                <option value="EXTERNAL">Externas</option>
              </select>
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
                <Filter size={17} />
                Filtrar
              </button>
            </form>
          </div>

          <div className="mt-5 space-y-4">
            {schedules.length === 0 ? (
              <EmptyState title="Sem agendamentos neste período" description="Cria um agendamento anual ou altera o filtro para veres outros períodos." />
            ) : (
              Object.entries(groupedSchedules).map(([date, items]) => (
                <div key={date} className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-zinc-100">{date}</h3>
                    <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-400">{items.length} agendamento(s)</span>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {items.map((schedule) => (
                      <article key={schedule.id} className="rounded-lg border border-zinc-800 bg-black/25 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-medium text-zinc-100">{schedule.title}</h4>
                            <p className="mt-1 text-sm text-zinc-500">{schedule.equipment.name}</p>
                          </div>
                          <span className={schedule.type === "EXTERNAL" ? "rounded-md bg-amber-300/10 px-2 py-1 text-xs text-amber-200" : "rounded-md bg-teal-300/10 px-2 py-1 text-xs text-teal-200"}>
                            {typeLabel(schedule.type)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                          <span className="rounded-md border border-zinc-800 px-2 py-1">{statusLabel(schedule.status)}</span>
                          <span className="rounded-md border border-zinc-800 px-2 py-1">{schedule.frequency}</span>
                          {schedule.costCenter && <span className="rounded-md border border-zinc-800 px-2 py-1">CC {schedule.costCenter}</span>}
                          {schedule.workOrder && <span className="rounded-md border border-teal-300/30 px-2 py-1 text-teal-200">{schedule.workOrder.number}</span>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a href={`/manutencao/${schedule.id}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
                            Abrir agendamento
                          </a>
                          {!schedule.workOrder && (
                            <form action={createWorkOrderFromSchedule}>
                              <input type="hidden" name="scheduleId" value={schedule.id} />
                              <button className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-300 px-3 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200">
                                Criar OP
                              </button>
                            </form>
                          )}
                        </div>
                        <form action={updateMaintenanceSchedule} className="mt-3 grid gap-2 md:grid-cols-2">
                          <input type="hidden" name="id" value={schedule.id} />
                          <select name="equipmentId" className={inputClass} defaultValue={schedule.equipmentId}>
                            {equipment.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                          <input name="title" className={inputClass} defaultValue={schedule.title} />
                          <select name="type" className={inputClass} defaultValue={schedule.type}>
                            <option value="INTERNAL">Interna</option>
                            <option value="EXTERNAL">Externa</option>
                          </select>
                          <select name="status" className={inputClass} defaultValue={schedule.status}>
                            <option value="SCHEDULED">Agendada</option>
                            <option value="DONE">Concluida</option>
                            <option value="CANCELED">Cancelada</option>
                          </select>
                          <input name="scheduledAt" type="date" className={inputClass} defaultValue={dateInputValue(schedule.scheduledAt)} />
                          <select name="frequency" className={inputClass} defaultValue={schedule.frequency}>
                            <option value="MONTHLY">Mensal</option>
                            <option value="QUARTERLY">Trimestral</option>
                            <option value="FOUR_MONTHLY">Quadrimestral</option>
                            <option value="SEMIANNUAL">Semestral</option>
                            <option value="ANNUAL">Anual</option>
                            <option value="WEEKLY">Semanal</option>
                            <option value="DAILY">Diaria</option>
                          </select>
                          <input name="supplier" className={inputClass} defaultValue={schedule.supplier ?? ""} placeholder="Fornecedor" />
                          <input name="costCenter" className={inputClass} defaultValue={schedule.costCenter ?? ""} placeholder="Centro de custos" />
                          <textarea name="description" className={`${textareaClass} md:col-span-2`} defaultValue={schedule.description ?? ""} placeholder="Descricao" />
                          <textarea name="notes" className={`${textareaClass} md:col-span-2`} defaultValue={schedule.notes ?? ""} placeholder="Notas" />
                          <button className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100">Editar agendamento</button>
                        </form>
                        <form action={deleteMaintenanceSchedule} className="mt-2">
                          <input type="hidden" name="id" value={schedule.id} />
                          <button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-200">
                            <Trash2 size={14} />
                            Eliminar agendamento
                          </button>
                        </form>
                      </article>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Registo executado</h2>
          <form action={createMaintenanceLog} className="mt-4 space-y-3">
            <select name="equipmentId" required className={inputClass}>
              <option value="">Selecionar equipamento</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input name="title" required className={inputClass} placeholder="Intervenção executada" />
            <div className="grid grid-cols-2 gap-3">
              <select name="type" className={inputClass}>
                <option value="INTERNAL">Interna</option>
                <option value="EXTERNAL">Externa</option>
              </select>
              <input name="costCenter" className={inputClass} placeholder="Centro de custos" />
            </div>
            <input name="supplier" className={inputClass} placeholder="Fornecedor / técnico" />
            <input name="performedBy" className={inputClass} placeholder="Feito por" />
            <div className="grid grid-cols-2 gap-3">
              <input name="amount" className={inputClass} placeholder="Custo" />
              <input name="date" type="date" className={inputClass} />
            </div>
            <input name="nextDate" type="date" className={inputClass} />
            <textarea name="description" className={textareaClass} placeholder="Descrição do trabalho executado" />
            <button className={buttonClass}>Guardar manutenção</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Histórico</h2>
          <div className="mt-4 space-y-3">
            {maintenanceLogs.length === 0 ? (
              <EmptyState title="Sem manutenções registadas" description="Quando adicionares intervenções, o histórico por equipamento aparece aqui." />
            ) : (
              maintenanceLogs.map((log) => (
                <article key={log.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{log.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {log.equipment.name} · {typeLabel(log.type)} · {log.supplier ?? "sem fornecedor"}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-cyan-300">{formatCurrency(log.cost)}</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatDate(log.date)}</p>
                    </div>
                  </div>
                  <form action={updateMaintenanceLog} className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    <input type="hidden" name="id" value={log.id} />
                    <select name="equipmentId" className={inputClass} defaultValue={log.equipmentId}>
                      {equipment.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <input name="title" className={inputClass} defaultValue={log.title} />
                    <select name="type" className={inputClass} defaultValue={log.type}>
                      <option value="INTERNAL">Interna</option>
                      <option value="EXTERNAL">Externa</option>
                    </select>
                    <input name="costCenter" className={inputClass} defaultValue={log.costCenter ?? ""} placeholder="Centro de custos" />
                    <input name="supplier" className={inputClass} defaultValue={log.supplier ?? ""} placeholder="Fornecedor" />
                    <input name="performedBy" className={inputClass} defaultValue={log.performedBy ?? ""} placeholder="Feito por" />
                    <input name="amount" className={inputClass} defaultValue={log.cost ? String(log.cost) : ""} placeholder="Custo" />
                    <input name="date" type="date" className={inputClass} defaultValue={dateInputValue(log.date)} />
                    <input name="nextDate" type="date" className={inputClass} defaultValue={dateInputValue(log.nextDate)} />
                    <textarea name="description" className={`${textareaClass} md:col-span-2 xl:col-span-3`} defaultValue={log.description ?? ""} placeholder="Descricao" />
                    <textarea name="notes" className={`${textareaClass} md:col-span-2 xl:col-span-3`} defaultValue={log.notes ?? ""} placeholder="Notas" />
                    <button className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100">Editar servico</button>
                  </form>
                  <form action={deleteMaintenanceLog} className="mt-2">
                    <input type="hidden" name="id" value={log.id} />
                    <button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-200">
                      <Trash2 size={14} />
                      Eliminar servico
                    </button>
                  </form>
                </article>
              ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
