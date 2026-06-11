import { BarChart3, Building2, Boxes, Euro, Factory } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/app/components/app-shell";
import { EmptyState, PageHeader, Panel, inputClass, buttonClass } from "@/app/components/ui";
import { getAnalyticsData } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type AnalisesPageProps = {
  searchParams?: Promise<{
    year?: string;
    month?: string;
    supplier?: string;
    costCenter?: string;
    equipmentId?: string;
  }>;
};

type AnalysisRow = {
  id?: string;
  name: string;
  total: number;
  count: number;
  code?: string;
};

function percent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}

function selectedPeriodLabel(year: string, month: string) {
  if (year === "all" && month === "all") return "Todos os anos";

  const months: Record<string, string> = {
    "1": "Janeiro",
    "2": "Fevereiro",
    "3": "Março",
    "4": "Abril",
    "5": "Maio",
    "6": "Junho",
    "7": "Julho",
    "8": "Agosto",
    "9": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro",
  };

  if (year !== "all" && month === "all") return year;
  if (year === "all" && month !== "all") return months[month] ?? "Mês";
  return `${months[month] ?? "Mês"} ${year}`;
}

function AnalysisTable({
  title,
  icon,
  rows,
  showCode = false,
}: {
  title: string;
  icon: ReactNode;
  rows: AnalysisRow[];
  showCode?: boolean;
}) {
  const max = Math.max(...rows.map((row) => row.total), 0);

  return (
    <Panel className="min-w-0">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="text-xl font-semibold text-zinc-50">{title}</h2>
      </div>

      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <EmptyState title="Sem dados" description="Ainda não existem despesas para esta análise." />
        ) : (
          rows.map((row) => (
            <div
              key={`${title}-${row.id ?? row.name}-${row.code ?? ""}`}
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-100">{row.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {showCode && row.code ? `${row.code} · ` : ""}
                    {row.count} registo(s)
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-amber-200">{formatCurrency(row.total)}</p>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900">
                <div className="h-full rounded-full bg-teal-300" style={{ width: `${percent(row.total, max)}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function BarChart({ title, rows }: { title: string; rows: AnalysisRow[] }) {
  const chartRows = rows.slice(0, 12);
  const max = Math.max(...chartRows.map((row) => row.total), 0);

  return (
    <Panel className="min-w-0">
      <div className="flex items-center gap-3">
        <BarChart3 size={22} className="text-teal-300" />
        <h2 className="text-xl font-semibold text-zinc-50">{title}</h2>
      </div>

      <div className="mt-5 space-y-3">
        {chartRows.length === 0 ? (
          <EmptyState title="Sem dados" description="Ainda não existem valores para apresentar no gráfico." />
        ) : (
          chartRows.map((row) => (
            <div
              key={`${title}-${row.id ?? row.name}`}
              className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_110px] sm:items-center"
            >
              <p className="truncate text-sm text-zinc-400">{row.name}</p>

              <div className="h-7 overflow-hidden rounded-md bg-zinc-900">
                <div
                  className="flex h-full items-center justify-end rounded-md bg-emerald-300/80 px-2 text-xs font-semibold text-zinc-950"
                  style={{ width: `${percent(row.total, max)}%` }}
                >
                  {formatCurrency(row.total)}
                </div>
              </div>

              <p className="text-right text-sm font-semibold text-amber-200">{formatCurrency(row.total)}</p>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

export default async function AnalisesPage({ searchParams }: AnalisesPageProps) {
  const params = (await searchParams) ?? {};

  const data = await getAnalyticsData({
    year: params.year,
    month: params.month,
    supplier: params.supplier,
    costCenter: params.costCenter,
    equipmentId: params.equipmentId,
  });

  const periodLabel = selectedPeriodLabel(data.selectedYear, data.selectedMonth);

  return (
    <AppShell activeHref="/analises">
      <PageHeader
        eyebrow="Análises"
        title="Custos e despesas"
        description="Consulta despesas por fornecedor, centro de custo e equipamento para perceber onde está a ser gasto o orçamento."
      />

      <form className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/45 p-4 md:grid-cols-3 xl:grid-cols-6">
        <select name="year" defaultValue={data.selectedYear} className={inputClass}>
          <option value="all">Todos os anos</option>
          {data.years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select name="month" defaultValue={data.selectedMonth} className={inputClass}>
          <option value="all">Todos os meses</option>
          <option value="1">Janeiro</option>
          <option value="2">Fevereiro</option>
          <option value="3">Março</option>
          <option value="4">Abril</option>
          <option value="5">Maio</option>
          <option value="6">Junho</option>
          <option value="7">Julho</option>
          <option value="8">Agosto</option>
          <option value="9">Setembro</option>
          <option value="10">Outubro</option>
          <option value="11">Novembro</option>
          <option value="12">Dezembro</option>
        </select>

        <select name="supplier" defaultValue={data.selectedSupplier} className={inputClass}>
          <option value="all">Todos os fornecedores</option>
          {data.suppliers.map((supplier) => (
            <option key={supplier} value={supplier}>
              {supplier}
            </option>
          ))}
        </select>

        <select name="costCenter" defaultValue={data.selectedCostCenter} className={inputClass}>
          <option value="all">Todos os centros</option>
          {data.costCenters.map((center) => (
            <option key={center} value={center}>
              {center}
            </option>
          ))}
        </select>

        <select name="equipmentId" defaultValue={data.selectedEquipmentId} className={inputClass}>
          <option value="all">Todos os equipamentos</option>
          {data.equipmentOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.code}
            </option>
          ))}
        </select>

        <button className={buttonClass}>Filtrar</button>
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div className="flex items-center gap-3">
            <Euro size={22} className="text-teal-300" />
            <p className="text-sm text-zinc-500">Orçamento · {periodLabel}</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-50">{formatCurrency(data.totalBudget)}</p>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <Euro size={22} className="text-amber-300" />
            <p className="text-sm text-zinc-500">Despesas · {periodLabel}</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-amber-200">{formatCurrency(data.totalExpenses)}</p>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <Euro size={22} className="text-blue-300" />
            <p className="text-sm text-zinc-500">Saldo disponível</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-blue-200">{formatCurrency(data.remainingBudget)}</p>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <BarChart title="Gráfico por fornecedor" rows={data.bySupplier} />
        <BarChart title="Gráfico por centro de custo" rows={data.byCostCenter} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <AnalysisTable
          title="Fornecedores"
          icon={<Building2 size={22} className="text-sky-300" />}
          rows={data.bySupplier}
        />

        <AnalysisTable
          title="Centros de custo"
          icon={<Factory size={22} className="text-orange-300" />}
          rows={data.byCostCenter}
        />

        <AnalysisTable
          title="Equipamentos"
          icon={<Boxes size={22} className="text-lime-300" />}
          rows={data.byEquipment}
          showCode
        />
      </section>
    </AppShell>
  );
}