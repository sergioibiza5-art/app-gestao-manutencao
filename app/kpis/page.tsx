import { Activity, BarChart3, CheckCircle2, Clock3, Download, Gauge, ShieldCheck, TimerReset, Wrench } from "lucide-react";

import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel } from "@/app/components/ui";
import { getKpiData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type KpiPageProps = {
  searchParams?: Promise<{
    year?: string;
    month?: string;
    period?: string;
    quarter?: string;
    semester?: string;
    startMonth?: string;
    endMonth?: string;
  }>;
};

type CountRow = {
  name: string;
  count: number;
};

function hours(value: number) {
  return `${Number(value || 0).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} h`;
}

function percent(value: number) {
  return `${Number(value || 0).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
}

function yesNo(value: boolean) {
  return value ? "Sim" : "Não";
}

function dateTime(value: Date | string | null | undefined) {
  if (!value) return "Sem data";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function barWidth(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(8, Math.round((value / max) * 100));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "Abertas",
    IN_PROGRESS: "Em curso",
    PAUSED: "Pausadas",
    SUSPENDED: "Suspensas",
    DONE: "Concluidas",
    VALIDATED: "Validadas",
    CANCELED: "Canceladas",
  };

  return labels[status] ?? status;
}

function CountChart({ title, rows }: { title: string; rows: CountRow[] }) {
  const max = Math.max(...rows.map((row) => row.count), 0);

  return (
    <Panel>
      <div className="flex items-center gap-3">
        <BarChart3 size={20} className="text-teal-300" />
        <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
      </div>

      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <EmptyState title="Sem dados" description="Ainda nao existem registos suficientes para este grafico." />
        ) : (
          rows.map((row) => (
            <div key={row.name} className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm text-zinc-400">{statusLabel(row.name)}</p>
                <p className="text-sm font-semibold text-teal-200">{row.count}</p>
              </div>
              <div className="h-7 overflow-hidden rounded-md bg-zinc-900">
                <div
                  className="flex h-full items-center justify-end rounded-md bg-teal-300 px-2 text-xs font-semibold text-zinc-950"
                  style={{ width: `${barWidth(row.count, max)}%` }}
                >
                  {row.count}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

export default async function KpisPage({ searchParams }: KpiPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getKpiData(params);
  const exportParams = new URLSearchParams({
    year: data.selectedYear,
    startMonth: data.selectedStartMonth,
    endMonth: data.selectedEndMonth,
  });

  const cards = [
    {
      label: "MTBF",
      value: hours(data.cards.mtbfHours),
      detail: "Tempo medio entre avarias",
      icon: TimerReset,
      tone: "border-sky-300/35 bg-sky-300/10 text-sky-200",
    },
    {
      label: "Manutencao preventiva",
      value: percent(data.cards.preventivePercentage),
      detail: "Peso das OPs preventivas",
      icon: ShieldCheck,
      tone: "border-emerald-300/35 bg-emerald-300/10 text-emerald-200",
    },
    {
      label: "OPs no prazo",
      value: percent(data.cards.onTimePercentage),
      detail: "Concluidas ate ao dia agendado",
      icon: CheckCircle2,
      tone: "border-teal-300/35 bg-teal-300/10 text-teal-200",
    },
    {
      label: "MTTR",
      value: hours(data.cards.mttrHours),
      detail: "Tempo medio de reparacao",
      icon: Clock3,
      tone: "border-amber-300/35 bg-amber-300/10 text-amber-200",
    },
    {
      label: "Disponibilidade",
      value: percent(data.cards.availability),
      detail: "Equipamentos disponiveis no periodo",
      icon: Gauge,
      tone: "border-lime-300/35 bg-lime-300/10 text-lime-200",
    },
  ];

  return (
    <AppShell activeHref="/kpis">
      <PageHeader
        eyebrow="Indicadores"
        title="KPI's de manutencao"
        description="Acompanha fiabilidade, tempos de reparacao, preventivas, cumprimento de prazo e disponibilidade dos equipamentos."
      />

      <form className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/45 p-4 md:grid-cols-[140px_170px_170px_auto_auto]">
        <select name="year" defaultValue={data.selectedYear} className={inputClass}>
          {data.years.length === 0 ? <option value={data.selectedYear}>{data.selectedYear}</option> : null}
          {data.years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        <select name="startMonth" defaultValue={data.selectedStartMonth} className={inputClass}>
          <option value="1">Mês inicial</option>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <option key={month} value={month}>Início: {month.toString().padStart(2, "0")}</option>
          ))}
        </select>
        <select name="endMonth" defaultValue={data.selectedEndMonth} className={inputClass}>
          <option value="12">Mês final</option>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <option key={month} value={month}>Fim: {month.toString().padStart(2, "0")}</option>
          ))}
        </select>
        <button className={buttonClass}>Filtrar</button>
        <a href={`/api/kpis/pdf?${exportParams.toString()}`} className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-teal-300/35 bg-teal-300/10 px-4 text-sm font-semibold text-teal-100 transition hover:border-teal-200/70">
          <Download size={16} />
          Exportar PDF
        </a>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Panel key={card.label}>
              <span className={`grid size-12 place-items-center rounded-lg border ${card.tone}`}>
                <Icon size={24} />
              </span>
              <p className="mt-4 text-sm text-zinc-500">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-50">{card.value}</p>
              <p className="mt-2 text-sm text-zinc-500">{card.detail}</p>
            </Panel>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Panel>
          <div className="flex items-center gap-3">
            <Wrench size={20} className="text-cyan-300" />
            <p className="text-sm text-zinc-500">Ordens de trabalho</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-50">{data.totals.workOrders}</p>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-300" />
            <p className="text-sm text-zinc-500">OPs concluidas</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-emerald-200">{data.totals.completedWorkOrders}</p>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-rose-300" />
            <p className="text-sm text-zinc-500">Avarias</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-rose-200">{data.totals.failures}</p>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3">
            <Clock3 size={20} className="text-amber-300" />
            <p className="text-sm text-zinc-500">Paragem total</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-amber-200">{hours(data.totals.downtimeHours)}</p>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <CountChart title="OPs por estado" rows={data.workOrdersByStatus} />

        <Panel>
          <div className="flex items-center gap-3">
            <BarChart3 size={20} className="text-rose-300" />
            <h2 className="text-lg font-semibold text-zinc-50">Avarias por equipamento</h2>
          </div>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {data.failuresByEquipment.length === 0 ? (
              <EmptyState title="Sem avarias" description="Nao existem tickets de avaria no periodo selecionado." />
            ) : (
              data.failuresByEquipment.slice(0, 12).map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-zinc-100">{item.name}</p>
                    <p className="text-sm font-semibold text-rose-200">{item.count}</p>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">Paragem: {hours(item.downtimeHours)}</p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-amber-300" />
            <h2 className="text-lg font-semibold text-zinc-50">Problemas recorrentes</h2>
          </div>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {data.recurringProblems.length === 0 ? (
              <EmptyState title="Sem recorrencias" description="Ainda nao existem tickets suficientes para identificar repeticoes." />
            ) : (
              data.recurringProblems.slice(0, 12).map((item) => (
                <div key={`${item.equipment}-${item.name}`} className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-100">{item.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{item.equipment}</p>
                    </div>
                    <p className="text-sm font-semibold text-amber-200">{item.count}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <p className="text-xs text-zinc-600">
        Periodo analisado: {data.periodLabel} ({formatDate(data.period.start)} ate {formatDate(data.period.end)}). MTBF e disponibilidade usam tickets de avaria; prazo usa OPs com agendamento associado.
      </p>

      <section className="space-y-4">
        <Panel>
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-sky-300" />
            <h2 className="text-lg font-semibold text-zinc-50">Dados concretos usados nos KPIs</h2>
          </div>

          <div className="mt-4 grid gap-3 text-sm lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
              <p className="font-semibold text-zinc-100">MTBF</p>
              <p className="mt-1 text-zinc-500">{data.sources.formulas.mtbf}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Equipamentos considerados: {data.totals.equipmentCount}. Avarias consideradas: {data.totals.failures}. Paragem total: {hours(data.totals.downtimeHours)}.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
              <p className="font-semibold text-zinc-100">Preventiva, prazo, MTTR e disponibilidade</p>
              <p className="mt-1 text-zinc-500">Preventiva: {data.sources.formulas.preventive}</p>
              <p className="mt-1 text-zinc-500">Prazo: {data.sources.formulas.onTime}</p>
              <p className="mt-1 text-zinc-500">MTTR: {data.sources.formulas.mttr}</p>
              <p className="mt-1 text-zinc-500">Disponibilidade: {data.sources.formulas.availability}</p>
            </div>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold text-zinc-50">Tickets usados em MTBF, MTTR e disponibilidade</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-3 py-3">Ticket</th>
                  <th className="px-3 py-3">Equipamento</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Aberto</th>
                  <th className="px-3 py-3">Concluido/validado</th>
                  <th className="px-3 py-3">Maquina parada</th>
                  <th className="px-3 py-3">Paragem</th>
                  <th className="px-3 py-3">Reparacao</th>
                  <th className="px-3 py-3">MTBF</th>
                  <th className="px-3 py-3">MTTR</th>
                  <th className="px-3 py-3">Disponib.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {data.sources.tickets.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-6 text-center text-zinc-500">
                      Sem tickets de avaria no periodo.
                    </td>
                  </tr>
                ) : (
                  data.sources.tickets.map((ticket) => (
                    <tr key={ticket.id} className="align-top text-zinc-300">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-zinc-100">{ticket.number}</p>
                        <p className="mt-1 max-w-52 text-xs text-zinc-500">{ticket.title}</p>
                      </td>
                      <td className="px-3 py-3">{ticket.equipment}</td>
                      <td className="px-3 py-3">{statusLabel(ticket.status)}</td>
                      <td className="px-3 py-3">{dateTime(ticket.openedAt)}</td>
                      <td className="px-3 py-3">{dateTime(ticket.completedAt ?? ticket.validatedAt)}</td>
                      <td className="px-3 py-3">{yesNo(ticket.machineStopped)}</td>
                      <td className="px-3 py-3">{hours(ticket.downtimeHours)}</td>
                      <td className="px-3 py-3">{hours(ticket.repairHours)}</td>
                      <td className="px-3 py-3">{yesNo(ticket.countsForMtbf)}</td>
                      <td className="px-3 py-3">{yesNo(ticket.countsForMttr)}</td>
                      <td className="px-3 py-3">{yesNo(ticket.countsForAvailability)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold text-zinc-50">OPs usadas em preventiva e cumprimento de prazo</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-3 py-3">OP</th>
                  <th className="px-3 py-3">Equipamento</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Aberta</th>
                  <th className="px-3 py-3">Agendada</th>
                  <th className="px-3 py-3">Fechada</th>
                  <th className="px-3 py-3">Origem tipo</th>
                  <th className="px-3 py-3">Preventiva</th>
                  <th className="px-3 py-3">Conta prazo</th>
                  <th className="px-3 py-3">No prazo</th>
                  <th className="px-3 py-3">Tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {data.sources.workOrders.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-6 text-center text-zinc-500">
                      Sem OPs abertas no periodo.
                    </td>
                  </tr>
                ) : (
                  data.sources.workOrders.map((workOrder) => (
                    <tr key={workOrder.id} className="align-top text-zinc-300">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-zinc-100">{workOrder.number}</p>
                        <p className="mt-1 max-w-52 text-xs text-zinc-500">{workOrder.title}</p>
                      </td>
                      <td className="px-3 py-3">{workOrder.equipment}</td>
                      <td className="px-3 py-3">{statusLabel(workOrder.status)}</td>
                      <td className="px-3 py-3">{dateTime(workOrder.openedAt)}</td>
                      <td className="px-3 py-3">{dateTime(workOrder.scheduledAt)}</td>
                      <td className="px-3 py-3">{dateTime(workOrder.closedAt)}</td>
                      <td className="px-3 py-3">{workOrder.typeSource || "Sem tipo"}</td>
                      <td className="px-3 py-3">{yesNo(workOrder.isPreventive)}</td>
                      <td className="px-3 py-3">{yesNo(workOrder.countsForOnTime)}</td>
                      <td className="px-3 py-3">{workOrder.countsForOnTime ? yesNo(workOrder.isOnTime) : "-"}</td>
                      <td className="px-3 py-3">{hours(workOrder.workHours)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
