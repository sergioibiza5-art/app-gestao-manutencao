import Link from "next/link";
import { ArrowRight, Car, Gauge, Plus } from "lucide-react";

import { createVehicle } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getFleetData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function fuelLabel(fuel: string) {
  const labels: Record<string, string> = {
    GASOLINE: "Gasolina",
    DIESEL: "Gasoleo",
    HYBRID: "Hibrido",
    ELECTRIC: "Eletrico",
    LPG: "GPL",
    OTHER: "Outro",
  };
  return labels[fuel] ?? fuel;
}

function rounded(value: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

export default async function FleetPage() {
  const { vehicles } = await getFleetData();
  const totalVehicles = vehicles.length;
  const totalCost = vehicles.reduce((sum, vehicle) => sum + vehicle.metrics.totalCost, 0);
  const totalLatestKm = vehicles.reduce((sum, vehicle) => sum + vehicle.metrics.latestKm, 0);

  return (
    <AppShell activeHref="/frota">
      <PageHeader
        eyebrow="Frota"
        title="Gestao de veiculos"
        description="Lista compacta para consulta diaria. Abre uma viatura para gerir km, revisoes, custos e inspecoes."
        action={
          <a href="#novo-veiculo" className={buttonClass}>
            <Plus size={18} />
            Novo veiculo
          </a>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Panel>
          <p className="text-sm text-zinc-500">Veiculos</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-50">{totalVehicles}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Km registados</p>
          <p className="mt-2 text-3xl font-semibold text-blue-200">{rounded(totalLatestKm)}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Custos acumulados</p>
          <p className="mt-2 text-3xl font-semibold text-amber-200">{formatCurrency(totalCost)}</p>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.65fr_1.35fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <Car size={22} className="text-blue-300" />
            <h2 id="novo-veiculo" className="text-xl font-semibold text-zinc-50">Cadastrar veiculo</h2>
          </div>
          <form action={createVehicle} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input name="brand" required className={inputClass} placeholder="Marca" />
              <input name="model" required className={inputClass} placeholder="Modelo" />
            </div>
            <input name="plate" required className={inputClass} placeholder="Matricula" />
            <div className="grid grid-cols-2 gap-3">
              <select name="fuel" className={inputClass}>
                <option value="DIESEL">Gasoleo</option>
                <option value="GASOLINE">Gasolina</option>
                <option value="HYBRID">Hibrido</option>
                <option value="ELECTRIC">Eletrico</option>
                <option value="LPG">GPL</option>
                <option value="OTHER">Outro</option>
              </select>
              <input name="year" className={inputClass} placeholder="Ano" />
            </div>
            <input name="driver" className={inputClass} placeholder="Pessoa que conduz" />
            <textarea name="notes" className={textareaClass} placeholder="Notas" />
            <button className={buttonClass}>Guardar veiculo</button>
          </form>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <Gauge size={22} className="text-teal-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Veiculos cadastrados</h2>
          </div>
          <div className="mt-4 space-y-2">
            {vehicles.length === 0 ? (
              <EmptyState title="Sem veiculos cadastrados" description="Cria a primeira viatura para comecar a controlar km, revisoes, custos e inspecoes." />
            ) : (
              vehicles.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  href={`/frota/${vehicle.id}`}
                  className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 transition hover:border-blue-300/50 hover:bg-zinc-900/70 lg:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(95px,0.35fr))_auto]"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{vehicle.plate}</p>
                    <h3 className="mt-1 truncate text-lg font-semibold text-zinc-50">{vehicle.brand} {vehicle.model}</h3>
                    <p className="mt-1 truncate text-sm text-zinc-500">
                      {fuelLabel(vehicle.fuel)} · {vehicle.year ?? "sem ano"} · {vehicle.driver ?? "sem condutor"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Km atuais</p>
                    <p className="mt-1 font-semibold text-blue-200">{rounded(vehicle.metrics.latestKm)}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Km/dia</p>
                    <p className="mt-1 font-semibold text-teal-200">{rounded(vehicle.metrics.averageKmDay)}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Custo total</p>
                    <p className="mt-1 font-semibold text-amber-200">{formatCurrency(vehicle.metrics.totalCost)}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs text-zinc-500">Prox. revisao</p>
                    <p className="mt-1 font-semibold text-blue-200">{formatDate(vehicle.metrics.estimatedRevisionDate)}</p>
                  </div>
                  <span className="flex items-center justify-end text-zinc-500">
                    <ArrowRight size={18} />
                  </span>
                </Link>
              ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
