import { BarChart3, Euro } from "lucide-react";

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
};

function percent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(5, Math.round((value / max) * 100));
}

function periodLabel(year: string, month: string) {
  if (year === "all" && month === "all") return "Todos os anos";
  if (year !== "all" && month === "all") return year;
  return `${month}/${year === "all" ? "todos" : year}`;
}

function BarChart({ title, rows }: { title: string; rows: AnalysisRow[] }) {
  const chartRows = rows;
  const max = Math.max(...chartRows.map((row) => row.total), 0);

  return (
    <Panel className="min-w-0">
      <div className="flex items-center gap-3">
        <BarChart3 size={20} className="text-teal-300" />
        <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
      </div>

      <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
        {chartRows.length === 0 ? (
          <EmptyState title="Sem dados" description="Ainda nao existem valores para apresentar." />
        ) : (
          chartRows.map((row) => (
            <div key={`${title}-${row.id ?? row.name}`} className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm text-zinc-400">{row.name}</p>
                <p className="shrink-0 text-sm font-semibold text-amber-200">{formatCurrency(row.total)}</p>
              </div>
              <div className="h-7 overflow-hidden rounded-md bg-zinc-900">
                <div
                  className="flex h-full items-center justify-end rounded-md bg-teal-300 px-2 text-xs font-semibold text-zinc-950"
                  style={{ width: `${percent(row.total, max)}%` }}
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

export default async function AnalisesPage({ searchParams }: AnalisesPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getAnalyticsData(params);
  const selectedPeriod = periodLabel(data.selectedYear, data.selectedMonth);

  return (
    <AppShell activeHref="/analises">
      <PageHeader
        eyebrow="Analises"
        title="Custos e despesas"
        description="Consulta despesas por fornecedor, centro de custo e equipamento em graficos compactos."
      />

      <form className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/45 p-4 md:grid-cols-3 xl:grid-cols-6">
        <select name="year" defaultValue={data.selectedYear} className={inputClass}>
          <option value="all">Todos os anos</option>
          {data.years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        <select name="month" defaultValue={data.selectedMonth} className={inputClass}>
          <option value="all">Todos os meses</option>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <option key={month} value={month}>{month}</option>
          ))}
        </select>
        <select name="supplier" defaultValue={data.selectedSupplier} className={inputClass}>
          <option value="all">Todos os fornecedores</option>
          {data.suppliers.map((supplier) => (
            <option key={supplier} value={supplier}>{supplier}</option>
          ))}
        </select>
        <select name="costCenter" defaultValue={data.selectedCostCenter} className={inputClass}>
          <option value="all">Todos os centros</option>
          {data.costCenters.map((center) => (
            <option key={center} value={center}>{center}</option>
          ))}
        </select>
        <select name="equipmentId" defaultValue={data.selectedEquipmentId} className={inputClass}>
          <option value="all">Todos os equipamentos</option>
          {data.equipmentOptions.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <button className={buttonClass}>Filtrar</button>
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div className="flex items-center gap-3">
            <Euro size={22} className="text-teal-300" />
            <p className="text-sm text-zinc-500">Orcamento - {selectedPeriod}</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-50">{formatCurrency(data.totalBudget)}</p>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3">
            <Euro size={22} className="text-amber-300" />
            <p className="text-sm text-zinc-500">Despesas - {selectedPeriod}</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-amber-200">{formatCurrency(data.totalExpenses)}</p>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3">
            <Euro size={22} className="text-blue-300" />
            <p className="text-sm text-zinc-500">Saldo disponivel</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-blue-200">{formatCurrency(data.remainingBudget)}</p>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <BarChart title="Por fornecedor" rows={data.bySupplier} />
        <BarChart title="Por centro de custo" rows={data.byCostCenter} />
        <BarChart title="Por equipamento" rows={data.byEquipment} />
      </section>
    </AppShell>
  );
}
