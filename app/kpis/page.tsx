import { Activity, BarChart3, CheckCircle2, Clock3, Gauge, ShieldCheck, TimerReset, Wrench } from "lucide-react";

import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel } from "@/app/components/ui";
import { getKpiData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type KpiPageProps = {
  searchParams?: Promise<{
    year?: string;
    month?: string;
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

      <form className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/45 p-4 md:grid-cols-[180px_180px_auto]">
        <select name="year" defaultValue={data.selectedYear} className={inputClass}>
          {data.years.length === 0 ? <option value={data.selectedYear}>{data.selectedYear}</option> : null}
          {data.years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        <select name="month" defaultValue={data.selectedMonth} className={inputClass}>
          <option value="all">Ano completo</option>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <option key={month} value={month}>{month}</option>
          ))}
        </select>
        <button className={buttonClass}>Filtrar</button>
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
        Periodo analisado: {formatDate(data.period.start)} ate {formatDate(data.period.end)}. MTBF e disponibilidade usam tickets de avaria; prazo usa OPs com agendamento associado.
      </p>
    </AppShell>
  );
}
