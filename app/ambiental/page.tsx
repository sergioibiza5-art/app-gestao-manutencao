import { AlertTriangle, FileSpreadsheet, Leaf, Search, ThermometerSun } from "lucide-react";

import { importEnvironmentalReport } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel } from "@/app/components/ui";
import { getEnvironmentalData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type EnvironmentalPageProps = {
  searchParams?: Promise<{ days?: string; type?: string }>;
};

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function statusClass(status: string) {
  if (status === "ACTION") return "border-rose-300/40 bg-rose-300/10 text-rose-100";
  if (status === "ALERT") return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
}

function statusLabel(status: string) {
  if (status === "ACTION") return "Acao";
  if (status === "ALERT") return "Alerta";
  return "OK";
}

function unit(type: string) {
  if (type === "TEMPERATURE") return "°C";
  if (type === "HUMIDITY") return "%";
  return "Pa";
}

export default async function EnvironmentalPage({ searchParams }: EnvironmentalPageProps) {
  const params = (await searchParams) ?? {};
  const days = params.days || "7";
  const type = params.type || "ALL";
  const data = await getEnvironmentalData({ days, type });
  const maxBar = Math.max(...data.hourly.map((item) => Math.abs(item.average)), 1);

  return (
    <AppShell activeHref="/ambiental">
      <PageHeader
        eyebrow="Monitorização ambiental"
        title="Tratamento ambiental"
        description="Importa relatórios diários Excel, acompanha histórico e identifica alertas ou ações por temperatura, humidade e pressão."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Panel>
          <p className="text-sm text-zinc-500">Estado geral</p>
          <p className={data.state === "ACAO" ? "mt-2 text-2xl font-semibold text-rose-200" : data.state === "ATENCAO" ? "mt-2 text-2xl font-semibold text-amber-200" : "mt-2 text-2xl font-semibold text-emerald-200"}>
            {data.state}
          </p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Total ações</p>
          <p className="mt-2 text-3xl font-semibold text-rose-200">{data.totalActions}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Total alertas</p>
          <p className="mt-2 text-3xl font-semibold text-amber-200">{data.totalAlerts}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Leituras tratadas</p>
          <p className="mt-2 text-3xl font-semibold text-teal-200">{data.readingsCount}</p>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={22} className="text-lime-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Importar relatório</h2>
            </div>
            <form action={importEnvironmentalReport} encType="multipart/form-data" className="mt-4 space-y-3">
              <input name="file" required type="file" accept=".xlsx,.xls,.csv" className={inputClass} />
              <button className={buttonClass}>Importar Excel</button>
            </form>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Colunas reconhecidas: T1/T2 para temperatura, H1/H2 para humidade e PA/PB para pressão.
            </p>
          </Panel>

          <Panel>
            <div className="flex items-center gap-3">
              <Search size={20} className="text-teal-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Filtros</h2>
            </div>
            <form className="mt-4 space-y-3">
              <select name="days" className={inputClass} defaultValue={days}>
                <option value="1">Últimas 24h</option>
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
              </select>
              <select name="type" className={inputClass} defaultValue={type}>
                <option value="ALL">Todos os tipos</option>
                <option value="TEMPERATURE">Temperatura</option>
                <option value="HUMIDITY">Humidade</option>
                <option value="PRESSURE">Pressão</option>
              </select>
              <button className={buttonClass}>Filtrar</button>
            </form>
          </Panel>

          <Panel>
            <h2 className="text-xl font-semibold text-zinc-50">Últimas importações</h2>
            <div className="mt-4 space-y-2">
              {data.imports.length === 0 ? (
                <EmptyState title="Sem importações" description="Importa o primeiro relatório para iniciar o histórico." />
              ) : (
                data.imports.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-3">
                    <p className="truncate text-sm font-semibold text-zinc-100">{item.fileName}</p>
                    <p className="mt-1 text-xs text-zinc-500">{formatDate(item.importedAt)} · {item.rowsCount} leituras</p>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <section className="grid gap-4 md:grid-cols-3">
            {data.byType.map((item) => (
              <Panel key={item.type}>
                <div className="flex items-center gap-3">
                  <ThermometerSun size={20} className="text-lime-300" />
                  <h2 className="text-lg font-semibold text-zinc-50">{item.label}</h2>
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                    <p className="text-xs text-zinc-500">Mínimo</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-50">{formatNumber(item.min)} {unit(item.type)}</p>
                  </div>
                  {item.type !== "PRESSURE" ? (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                      <p className="text-xs text-zinc-500">Média</p>
                      <p className="mt-1 text-xl font-semibold text-teal-200">{formatNumber(item.average)} {unit(item.type)}</p>
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                    <p className="text-xs text-zinc-500">Máximo</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-50">{formatNumber(item.max)} {unit(item.type)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-2 text-center text-amber-100">{item.alerts} alertas</p>
                    <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-2 text-center text-rose-100">{item.actions} ações</p>
                  </div>
                </div>
              </Panel>
            ))}
          </section>

          <Panel>
            <div className="flex items-center gap-3">
              <Leaf size={22} className="text-lime-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Tendência horária</h2>
            </div>
            <div className="mt-4 space-y-2">
              {data.hourly.length === 0 ? (
                <EmptyState title="Sem dados para gráfico" description="As médias horárias aparecem depois da importação." />
              ) : (
                data.hourly.map((item) => (
                  <div key={item.hour} className="grid grid-cols-[90px_minmax(0,1fr)_70px] items-center gap-3 text-xs">
                    <span className="text-zinc-500">{item.hour}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-zinc-900">
                      <div className="h-full rounded-full bg-teal-300" style={{ width: `${Math.max((Math.abs(item.average) / maxBar) * 100, 4)}%` }} />
                    </div>
                    <span className="text-right font-semibold text-zinc-200">{formatNumber(item.average)}</span>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-3">
              <AlertTriangle size={22} className="text-amber-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Sensores</h2>
            </div>
            <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {data.bySensor.length === 0 ? (
                <EmptyState title="Sem sensores tratados" description="Importa o relatório para ver sensores e estados." />
              ) : (
                data.bySensor.map((sensor) => (
                  <div key={`${sensor.type}-${sensor.sensor}`} className={`rounded-lg border p-3 ${statusClass(sensor.status)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{sensor.sensor}</p>
                        <p className="mt-1 text-xs opacity-75">{sensor.label}</p>
                      </div>
                      <span className="rounded-md border border-current/30 px-2 py-1 text-xs font-semibold">{statusLabel(sensor.status)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <span>Min. {formatNumber(sensor.min)} {unit(sensor.type)}</span>
                      <span>Méd. {formatNumber(sensor.average)} {unit(sensor.type)}</span>
                      <span>Máx. {formatNumber(sensor.max)} {unit(sensor.type)}</span>
                    </div>
                    {sensor.ignorePressure ? (
                      <p className="mt-2 text-xs opacity-75">Pressão média abaixo de 1 Pa: tratado como normal.</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </section>
    </AppShell>
  );
}
