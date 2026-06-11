import { BarChart3, Building2, Boxes, Euro, Factory } from "lucide-react";

import { AppShell } from "@/app/components/app-shell";
import { EmptyState, PageHeader, Panel } from "@/app/components/ui";
import { getAnalyticsData } from "@/lib/data";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type AnalysisRow = {
  name: string;
  total: number;
  count: number;
  code?: string;
};

function percent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}

function AnalysisTable({
  title,
  icon,
  rows,
  showCode = false,
}: {
  title: string;
  icon: React.ReactNode;
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
            <div key={`${title}-${row.name}-${row.code ?? ""}`} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
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
                <div
                  className="h-full rounded-full bg-teal-300"
                  style={{ width: `${percent(row.total, max)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function BarChart({
  title,
  rows,
}: {
  title: string;
  rows: AnalysisRow[];
}) {
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
            <div key={`${title}-${row.name}`} className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_110px] sm:items-center">
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

export default async function AnalisesPage() {
  const data = await getAnalyticsData();

  return (
    <AppShell activeHref="/analises">
      <PageHeader
        eyebrow="Análises"
        title="Custos e despesas"
        description="Consulta despesas por fornecedor, centro de custo e equipamento para perceber onde está a ser gasto o orçamento."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div className="flex items-center gap-3">
            <Euro size={22} className="text-teal-300" />
            <p className="text-sm text-zinc-500">Orçamento {data.year}</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-50">{formatCurrency(data.totalBudget)}</p>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <Euro size={22} className="text-amber-300" />
            <p className="text-sm text-zinc-500">Despesas {data.year}</p>
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