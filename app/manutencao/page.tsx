import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  Map,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";

import {
  createAnnualMaintenanceSchedule,
  createMaintenanceLog,
  createWorkOrderFromSchedule,
  deleteMaintenanceLog,
  deleteMaintenanceSchedule,
  updateMaintenanceLog,
  updateMaintenanceSchedule,
} from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getMaintenanceData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const maintenanceTypeOptions = [
  "Preventiva",
  "Corretiva",
  "Preditiva",
  "Inspeção",
  "Calibração",
  "Lubrificação",
  "Limpeza",
  "Segurança",
  "Melhoria",
  "Outro",
];

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
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

const weekDayNames = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

type MaintenancePageProps = {
  searchParams: Promise<{
    view?: string;
    date?: string;
    type?: string;
    calendar?: string;
    equipmentId?: string;
  }>;
};

type ScheduleStatusInfo = {
  label: string;
  className: string;
  icon: typeof Clock;
};

function typeLabel(type: string) {
  return type === "EXTERNAL" ? "Externa" : "Interna";
}

function scheduleStatusLabel(status: string) {
  if (status === "DONE") return "Concluída";
  if (status === "CANCELED") return "Cancelada";
  return "Agendada";
}

function workOrderStatusLabel(status?: string | null) {
  if (!status) return "OP não iniciada";

  const labels: Record<string, string> = {
    OPEN: "OP criada",
    IN_PROGRESS: "OP iniciada",
    PAUSED: "OP pausada",
    SUSPENDED: "OP suspensa",
    DONE: "OP concluída",
    VALIDATED: "OP validada",
    CANCELED: "OP cancelada",
  };

  return labels[status] ?? status;
}

function workOrderStatusInfo(status?: string | null): ScheduleStatusInfo {
  if (status === "IN_PROGRESS") {
    return { label: "OP iniciada", className: "border-yellow-300/35 bg-yellow-300/10 text-yellow-200", icon: PlayCircle };
  }

  if (status === "PAUSED") {
    return { label: "OP pausada", className: "border-amber-300/35 bg-amber-300/10 text-amber-200", icon: PauseCircle };
  }

  if (status === "SUSPENDED") {
    return { label: "OP suspensa", className: "border-orange-300/35 bg-orange-300/10 text-orange-200", icon: PauseCircle };
  }

  if (status === "DONE" || status === "VALIDATED") {
    return { label: workOrderStatusLabel(status), className: "border-emerald-300/35 bg-emerald-300/10 text-emerald-200", icon: CheckCircle2 };
  }

  if (status === "CANCELED") {
    return { label: "OP cancelada", className: "border-rose-300/35 bg-rose-300/10 text-rose-200", icon: AlertTriangle };
  }

  if (status === "OPEN") {
    return { label: "OP criada", className: "border-sky-300/35 bg-sky-300/10 text-sky-200", icon: Clock };
  }

  return { label: "OP não iniciada", className: "border-zinc-700 bg-zinc-900/70 text-zinc-400", icon: Clock };
}

function dateStatusInfo(scheduledAt: Date, scheduleStatus: string, workOrderStatus?: string | null): ScheduleStatusInfo {
  const today = new Date();
  const scheduled = new Date(scheduledAt);

  today.setHours(0, 0, 0, 0);
  scheduled.setHours(0, 0, 0, 0);

  const isClosed =
    scheduleStatus === "DONE" ||
    scheduleStatus === "CANCELED" ||
    workOrderStatus === "DONE" ||
    workOrderStatus === "VALIDATED" ||
    workOrderStatus === "CANCELED";

  if (isClosed) return { label: "Fechada", className: "border-emerald-300/35 bg-emerald-300/10 text-emerald-200", icon: CheckCircle2 };
  if (scheduled.getTime() < today.getTime()) return { label: "Fora da data", className: "border-rose-300/35 bg-rose-300/10 text-rose-200", icon: AlertTriangle };
  if (scheduled.getTime() === today.getTime()) return { label: "Dentro da data", className: "border-teal-300/35 bg-teal-300/10 text-teal-200", icon: CheckCircle2 };

  return { label: "Programada", className: "border-zinc-700 bg-zinc-900/70 text-zinc-400", icon: Clock };
}

function isInspection(schedule: { title: string; costCenter: string | null }) {
  return `${schedule.title} ${schedule.costCenter ?? ""}`.toLowerCase().includes("inspe");
}

function isPreventiveOrCorrective(schedule: { title: string; costCenter: string | null }) {
  const value = `${schedule.title} ${schedule.costCenter ?? ""}`.toLowerCase();
  return value.includes("prevent") || value.includes("corret");
}

function titleTone(schedule: { title: string; type: string; costCenter: string | null }) {
  if (schedule.type !== "EXTERNAL") return "text-zinc-100";
  if (isInspection(schedule)) return "text-pink-300";
  if (isPreventiveOrCorrective(schedule)) return "text-amber-300";
  return "text-zinc-100";
}

function scheduleCardTone(schedule: { scheduledAt: Date; status: string; workOrder?: { status: string } | null }) {
  const today = new Date();
  const scheduled = new Date(schedule.scheduledAt);
  today.setHours(0, 0, 0, 0);
  scheduled.setHours(0, 0, 0, 0);

  const workOrderStatus = schedule.workOrder?.status ?? null;
  if (scheduled.getTime() < today.getTime() && !["DONE", "VALIDATED", "CANCELED"].includes(workOrderStatus ?? "") && schedule.status !== "DONE") {
    return "border-rose-300/50 bg-rose-950/20 hover:border-rose-300/70";
  }
  if (workOrderStatus === "IN_PROGRESS" || workOrderStatus === "PAUSED" || workOrderStatus === "SUSPENDED") {
    return "border-yellow-300/50 bg-yellow-950/20 hover:border-yellow-300/70";
  }
  if (workOrderStatus === "DONE" || workOrderStatus === "VALIDATED" || schedule.status === "DONE") {
    return "border-emerald-300/50 bg-emerald-950/20 hover:border-emerald-300/70";
  }
  return "border-zinc-800 bg-black/30 hover:border-teal-300/50";
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

function sameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export default async function MaintenancePage({ searchParams }: MaintenancePageProps) {
  const filters = await searchParams;
  const selectedView = filters.view || "month";
  const selectedDate = filters.date || new Date().toISOString().slice(0, 10);
  const selectedType = filters.type || "ALL";
  const annualCalendar = filters.calendar === "year";
  const dataView = annualCalendar ? "year" : selectedView;
  const selectedEquipmentId = filters.equipmentId || "ALL";

  const { equipment, maintenanceLogs, schedules, range } = await getMaintenanceData({
  view: dataView,
  date: selectedDate,
  type: selectedType,
  equipmentId: selectedEquipmentId,
});
  const groupedSchedules = groupByDate(schedules);
  const weekBoardDays = weekDayNames.map((name, index) => {
    const day = new Date(range.start);
    day.setDate(range.start.getDate() + index);

    return {
      name,
      date: day,
      items: schedules.filter((schedule) => sameCalendarDay(new Date(schedule.scheduledAt), day)),
    };
  });
  const selectedMonthDate = new Date(selectedDate);

  const schedulesByMonth = monthNames.map((month, index) => ({
    month,
    items: schedules.filter((schedule) => schedule.scheduledAt.getMonth() === index),
  }));

  const monthStart = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
  const monthEnd = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0);
  const firstMonday = new Date(monthStart);
  firstMonday.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7));
  const schedulesByWeek = Array.from({ length: 6 }, (_, weekIndex) => {
  const start = new Date(firstMonday);
    start.setDate(firstMonday.getDate() + weekIndex * 7);
  const end = new Date(start);
    end.setDate(start.getDate() + 4);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return {
      title: `Semana ${weekIndex + 1}`,
      start,
      end,
      range: `${formatDate(start)} a ${formatDate(end)}`,
      items: schedules.filter((schedule) => {
        const scheduledAt = new Date(schedule.scheduledAt);

        return (
          scheduledAt.getFullYear() === selectedMonthDate.getFullYear() &&
          scheduledAt.getMonth() === selectedMonthDate.getMonth() &&
          scheduledAt >= start &&
          scheduledAt <= end
        );
      }),
    };
  }).filter((week) => {
    const day = new Date(week.start);

    while (day <= week.end) {
      if (day >= monthStart && day <= monthEnd) return true;
      day.setDate(day.getDate() + 1);
    }

    return false;
  });

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

      <section className="space-y-4">
        <Panel>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <CalendarDays size={22} className="text-cyan-300" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Planeamento</p>
                <h2 id="agendamento-anual" className="text-xl font-semibold text-zinc-50">
                  Agendamento anual
                </h2>
              </div>
            </div>

            <p className="max-w-xl text-sm text-zinc-500">
              Cria recorrências para o ano e consulta tudo no mapa completo abaixo.
            </p>
          </div>

          <form action={createAnnualMaintenanceSchedule} className="mt-4 grid gap-3 lg:grid-cols-6">
            <select name="equipmentId" required className={inputClass}>
              <option value="">Selecionar equipamento</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <input name="title" required className={`${inputClass} lg:col-span-2`} placeholder="Manutenção a agendar" />

            <select name="type" className={inputClass}>
              <option value="INTERNAL">Interna</option>
              <option value="EXTERNAL">Externa</option>
            </select>

            <select name="frequency" className={inputClass}>
              <option value="DAILY">Diária</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensal</option>
              <option value="QUARTERLY">Trimestral</option>
              <option value="FOUR_MONTHLY">Quadrimestral</option>
              <option value="SEMIANNUAL">Semestral</option>
              <option value="ANNUAL">Anual</option>
              <option value="BIENNIAL">Bienal (2 anos)</option>
              <option value="FIVE_YEAR">Quinquenal (5 anos)</option>
            </select>

            <input name="startDate" type="date" required className={inputClass} />
            <input name="supplier" className={inputClass} placeholder="Fornecedor / equipa" />

            <select name="costCenter" className={inputClass} defaultValue="">
              <option value="">Tipo de manutenção</option>
              {maintenanceTypeOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <textarea name="description" className={`${textareaClass} min-h-11 lg:col-span-4`} placeholder="Descrição, critério SGQ ou instrução de trabalho" />

            <button className={`${buttonClass} lg:col-span-2`}>Criar agendamentos do ano</button>
          </form>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Map size={22} className="text-teal-300" />
                  <h2 className="text-xl font-semibold text-zinc-50">
                    {selectedView === "month-weeks" ? "Manutenções do mês" : "Mapa de agendamentos"}
                  </h2>
                </div>

                <p className="mt-2 text-sm text-zinc-500">
                  {formatDate(range.start)} até {formatDate(range.end)}
                </p>
              </div>

              <Link
                href={
                  annualCalendar
                    ? `/manutencao?view=${selectedView}&date=${selectedDate}&type=${selectedType}&equipmentId=${selectedEquipmentId}`
                    : `/manutencao?view=${selectedView}&date=${selectedDate}&type=${selectedType}&equipmentId=${selectedEquipmentId}&calendar=year`
                }
                className="inline-flex h-11 items-center justify-center rounded-lg bg-teal-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200"
              >
                {annualCalendar ? "Voltar à lista" : "Calendário anual"}
              </Link>
            </div>

            <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
  {annualCalendar ? <input type="hidden" name="calendar" value="year" /> : null}

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

  <select name="equipmentId" defaultValue={selectedEquipmentId} className={inputClass}>
    <option value="ALL">Todos equipamentos</option>
    {equipment.map((item) => (
      <option key={item.id} value={item.id}>
        {item.name}
      </option>
    ))}
  </select>

  <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
    <Filter size={17} />
    Filtrar
  </button>
</form>
          </div>

          {annualCalendar ? (
            <div className="mt-5">
              <h3 className="mb-4 text-lg font-semibold uppercase tracking-[0.14em] text-zinc-100">
                Calendário anual
              </h3>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {schedulesByMonth.map(({ month, items }, monthIndex) => {
                  const visibleItems = items.length > 5 ? items.slice(0, 4) : items.slice(0, 5);
                  const hiddenCount = Math.max(items.length - visibleItems.length, 0);
                  const monthDate = new Date(new Date(selectedDate).getFullYear(), monthIndex, 1).toISOString().slice(0, 10);

                  return (
                    <Link
                      key={month}
                      href={`/manutencao?view=month-weeks&date=${monthDate}&type=${selectedType}&equipmentId=${selectedEquipmentId}`}
                      className="min-h-42.5 overflow-hidden rounded-lg border border-teal-300/20 bg-zinc-950/60 transition hover:border-teal-300/60"
                    >
                      <div className="border-b border-teal-300/20 bg-teal-300/10 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
                          {month}
                        </p>
                      </div>

                      <div className="space-y-2 p-3">
                        {items.length === 0 ? (
                          <p className="text-xs text-zinc-600">Sem agendamentos</p>
                        ) : (
                          <>
                            {visibleItems.map((schedule) => (
                              <div
                                key={schedule.id}
                                className={`rounded-md border px-2 py-1.5 ${scheduleCardTone(schedule)}`}
                              >
                                <p className="text-[11px] font-semibold text-teal-300">
                                  {formatDate(schedule.scheduledAt)}
                                </p>
                                <p className={`break-words text-xs font-semibold leading-snug ${titleTone(schedule)}`}>
                                  {schedule.title}
                                </p>
                                <p className="break-words text-[11px] leading-snug text-zinc-500">
                                  {schedule.equipment.name}
                                </p>
                              </div>
                            ))}

                            {hiddenCount > 0 && (
                              <div className="rounded-md border border-teal-300/30 bg-teal-300/10 px-2 py-2 text-center text-xs font-semibold text-teal-200">
                                + {hiddenCount} manutenções
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : selectedView === "month-weeks" ? (
            <div className="mt-5">
              <h3 className="mb-4 text-lg font-semibold uppercase tracking-[0.14em] text-zinc-100">
                Manutenções por semana
              </h3>

              <div className="grid grid-cols-5 gap-3">
                {schedulesByWeek.map((week) => {
                  const visibleItems = week.items.length > 5 ? week.items.slice(0, 4) : week.items.slice(0, 5);
                  const hiddenCount = Math.max(week.items.length - visibleItems.length, 0);

                  return (
                    <div
                      key={week.title}
                      className="min-h-112 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60"
                    >
                      <div className="flex min-h-16 items-center justify-center border-b border-teal-300/20 bg-teal-300/10 px-2 py-2">
                        <div className="text-center">
                          <h4 className="text-sm font-semibold text-zinc-50">
                            {week.title}
                          </h4>
                          <p className="mt-1 text-[10px] leading-snug text-zinc-500">{week.range}</p>
                        </div>
                      </div>

                      <div className="space-y-2 p-2">
                        {week.items.length === 0 ? (
                          <p className="text-sm text-zinc-600">Sem tarefas</p>
                        ) : (
                          <>
                            {visibleItems.map((schedule) => (
                              <a
                                key={schedule.id}
                                href={`/manutencao/${schedule.id}`}
                                  className={`block rounded-lg border p-2 transition ${scheduleCardTone(schedule)}`}
                              >
                                <p className="text-xs font-semibold text-teal-300">
                                  {formatDate(schedule.scheduledAt)}
                                </p>
                                  <p className={`mt-1 break-words text-xs font-semibold leading-snug ${titleTone(schedule)}`}>
                                  {schedule.title}
                                </p>
                                  <p className="mt-1 break-words text-[11px] leading-snug text-zinc-500">
                                  {schedule.equipment.name} · {typeLabel(schedule.type)}
                                </p>
                              </a>
                            ))}

                          {hiddenCount > 0 && (
                            <Link
                              href={`/manutencao?view=week&date=${dateInputValue(week.start)}&type=${selectedType}&equipmentId=${selectedEquipmentId}`}
                              className="block rounded-lg border border-teal-300/30 bg-teal-300/10 p-3 text-center text-sm font-semibold leading-snug text-teal-200 transition hover:border-teal-200"
                            >
                              + {hiddenCount} manutenções
                            </Link>
                          )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : selectedView === "week" ? (
            <div className="mt-5">
              <div className="mb-4 flex flex-col gap-1">
                <h3 className="text-lg font-semibold uppercase tracking-[0.14em] text-zinc-100">
                  Calendário semanal
                </h3>
                <p className="text-sm text-zinc-500">
                  {formatDate(weekBoardDays[0].date)} até {formatDate(weekBoardDays[4].date)}
                </p>
              </div>

              <div className="grid overflow-hidden rounded-xl border border-teal-300/25 bg-zinc-950/60 md:grid-cols-5">
                {weekBoardDays.map((day) => (
                  <div key={day.name} className="min-h-120 border-b border-teal-300/20 md:border-b-0 md:border-r md:last:border-r-0">
                    <Link
                      href={`/manutencao?view=day&date=${dateInputValue(day.date)}&type=${selectedType}&equipmentId=${selectedEquipmentId}`}
                      className="block border-b border-teal-300/25 bg-teal-200/70 px-3 py-3 text-center transition hover:bg-teal-100"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-950">{day.name}</p>
                      <p className="mt-1 text-[11px] font-semibold text-teal-900">{formatDate(day.date)}</p>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-950/70">
                        Ver dia
                      </p>
                    </Link>

                    <div className="min-h-104 space-y-2 bg-teal-50/10 p-3">
                      {day.items.length === 0 ? (
                        <p className="text-sm text-zinc-600">Sem manutenções</p>
                      ) : (
                        day.items.map((schedule) => (
                          <Link
                            key={schedule.id}
                            href={`/manutencao/${schedule.id}`}
                            className={`block rounded-lg border p-3 transition ${scheduleCardTone(schedule)}`}
                          >
                            <p className="text-xs font-semibold text-teal-300">{formatDate(schedule.scheduledAt)}</p>
                            <p className={`mt-1 font-semibold ${titleTone(schedule)}`}>{schedule.title}</p>
                            <p className="mt-1 text-xs text-zinc-500">{schedule.equipment.name}</p>
                            <p className="mt-2 inline-flex rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
                              {typeLabel(schedule.type)}
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {schedules.length === 0 ? (
                <EmptyState
                  title="Sem agendamentos neste período"
                  description="Cria um agendamento anual ou altera o filtro para veres outros períodos."
                />
              ) : (
                Object.entries(groupedSchedules).map(([date, items]) => (
                  <div key={date} className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-zinc-100">{date}</h3>
                      <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
                        {items.length} agendamento(s)
                      </span>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-2">
                      {items.map((schedule) => {
                        const workOrderStatus = schedule.workOrder?.status ?? null;
                        const opInfo = workOrderStatusInfo(workOrderStatus);
                        const dateInfo = dateStatusInfo(schedule.scheduledAt, schedule.status, workOrderStatus);
                        const OpIcon = opInfo.icon;
                        const DateIcon = dateInfo.icon;

                        return (
                          <details
                            key={schedule.id}
                            className={`group rounded-lg border p-3 open:border-teal-300/35 ${scheduleCardTone(schedule)}`}
                          >
                            <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className={`font-medium ${titleTone(schedule)}`}>{schedule.title}</h4>

                                  {schedule.workOrder ? (
                                    <span className="rounded-md border border-teal-300/30 bg-teal-300/10 px-2 py-1 text-xs font-semibold text-teal-200">
                                      {schedule.workOrder.number}
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-1 text-sm text-zinc-500">{schedule.equipment.name}</p>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${dateInfo.className}`}>
                                    <DateIcon size={13} />
                                    {dateInfo.label}
                                  </span>

                                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${opInfo.className}`}>
                                    <OpIcon size={13} />
                                    {opInfo.label}
                                  </span>
                                </div>
                              </div>

                              <span className="flex shrink-0 flex-col items-end gap-2">
                                <span
                                  className={
                                    schedule.type === "EXTERNAL"
                                      ? "rounded-md bg-amber-300/10 px-2 py-1 text-xs text-amber-200"
                                      : "rounded-md bg-teal-300/10 px-2 py-1 text-xs text-teal-200"
                                  }
                                >
                                  {typeLabel(schedule.type)}
                                </span>

                                <span className="text-xs text-teal-300 group-open:hidden">Abrir</span>
                              </span>
                            </summary>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                              <span className="rounded-md border border-zinc-800 px-2 py-1">
                                Agendamento: {scheduleStatusLabel(schedule.status)}
                              </span>

                              <span className="rounded-md border border-zinc-800 px-2 py-1">
                                Frequência: {schedule.frequency}
                              </span>

                              {schedule.costCenter ? (
                                <span className="rounded-md border border-zinc-800 px-2 py-1">CC {schedule.costCenter}</span>
                              ) : null}

                              {schedule.workOrder ? (
                                <span className="rounded-md border border-zinc-800 px-2 py-1">
                                  Estado OP: {workOrderStatusLabel(schedule.workOrder.status)}
                                </span>
                              ) : (
                                <span className="rounded-md border border-zinc-800 px-2 py-1">Sem OP criada</span>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <a
                                href={`/manutencao/${schedule.id}`}
                                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50"
                              >
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
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
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

                              <textarea
                                name="description"
                                className={`${textareaClass} md:col-span-2`}
                                defaultValue={schedule.description ?? ""}
                                placeholder="Descricao"
                              />

                              <textarea
                                name="notes"
                                className={`${textareaClass} md:col-span-2`}
                                defaultValue={schedule.notes ?? ""}
                                placeholder="Notas"
                              />

                              <button className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100">
                                Editar agendamento
                              </button>
                            </form>

                            <form action={deleteMaintenanceSchedule} className="mt-2">
                              <input type="hidden" name="id" value={schedule.id} />
                              <button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-200">
                                <Trash2 size={14} />
                                Eliminar agendamento
                              </button>
                            </form>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Registo executado</h2>

          <form action={createMaintenanceLog} className="mt-4 space-y-3">
            <select name="equipmentId" required className={inputClass}>
              <option value="">Selecionar equipamento</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
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
              <EmptyState
                title="Sem manutenções registadas"
                description="Quando adicionares intervenções, o histórico por equipamento aparece aqui."
              />
            ) : (
              maintenanceLogs.map((log) => (
                <details key={log.id} className="group rounded-lg border border-zinc-800 bg-zinc-950/65 p-4 open:border-cyan-300/35">
                  <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{log.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {log.equipment.name} · {typeLabel(log.type)} · {log.supplier ?? "sem fornecedor"}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-cyan-300">{formatCurrency(log.cost)}</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatDate(log.date)}</p>
                      <p className="mt-1 text-xs text-teal-300 group-open:hidden">Abrir registo</p>
                    </div>
                  </summary>

                  <form action={updateMaintenanceLog} className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    <input type="hidden" name="id" value={log.id} />

                    <select name="equipmentId" className={inputClass} defaultValue={log.equipmentId}>
                      {equipment.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
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

                    <textarea
                      name="description"
                      className={`${textareaClass} md:col-span-2 xl:col-span-3`}
                      defaultValue={log.description ?? ""}
                      placeholder="Descricao"
                    />

                    <textarea
                      name="notes"
                      className={`${textareaClass} md:col-span-2 xl:col-span-3`}
                      defaultValue={log.notes ?? ""}
                      placeholder="Notas"
                    />

                    <button className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100">
                      Editar servico
                    </button>
                  </form>

                  <form action={deleteMaintenanceLog} className="mt-2">
                    <input type="hidden" name="id" value={log.id} />
                    <button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-200">
                      <Trash2 size={14} />
                      Eliminar servico
                    </button>
                  </form>
                </details>
              ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
