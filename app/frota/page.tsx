import Link from "next/link";
import { ArrowRight, Car, Gauge, Plus } from "lucide-react";

import { createVehicle } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import {
  buttonClass,
  EmptyState,
  inputClass,
  PageHeader,
  Panel,
  textareaClass,
} from "@/app/components/ui";
import { getFleetData } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function fuelLabel(fuel: string) {
  const labels: Record<string, string> = {
    GASOLINE: "Gasolina",
    DIESEL: "Gasóleo",
    HYBRID: "Híbrido",
    ELECTRIC: "Elétrico",
    LPG: "GPL",
    OTHER: "Outro",
  };

  return labels[fuel] ?? fuel;
}

function rounded(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
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
        title="Gestão de veículos"
        description="Lista compacta para consulta diária. Abre uma viatura para gerir km, revisões, custos e inspeções."
        action={
          <a href="#novo-veiculo" className={buttonClass}>
            <Plus size={18} />
            Novo veículo
          </a>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Panel>
          <p className="text-sm text-zinc-500">Veículos</p>
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

      <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Panel className="min-w-0">
          <div className="flex items-center gap-3">
            <Car size={22} className="shrink-0 text-blue-300" />
            <h2 id="novo-veiculo" className="text-xl font-semibold text-zinc-50">
              Cadastrar veículo
            </h2>
          </div>

          <form action={createVehicle} className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input name="brand" required className={`${inputClass} w-full min-w-0`} placeholder="Marca" />
              <input name="model" required className={`${inputClass} w-full min-w-0`} placeholder="Modelo" />
            </div>

            <input name="plate" required className={`${inputClass} w-full min-w-0`} placeholder="Matrícula" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select name="fuel" className={`${inputClass} w-full min-w-0`}>
                <option value="DIESEL">Gasóleo</option>
                <option value="GASOLINE">Gasolina</option>
                <option value="HYBRID">Híbrido</option>
                <option value="ELECTRIC">Elétrico</option>
                <option value="LPG">GPL</option>
                <option value="OTHER">Outro</option>
              </select>

              <input name="year" className={`${inputClass} w-full min-w-0`} placeholder="Ano" />
            </div>

            <input name="driver" className={`${inputClass} w-full min-w-0`} placeholder="Pessoa que conduz" />
            <textarea name="notes" className={`${textareaClass} w-full min-w-0`} placeholder="Notas" />

            <button className={`${buttonClass} w-full justify-center`}>Guardar veículo</button>
          </form>
        </Panel>

        <Panel className="min-w-0">
          <div className="flex items-center gap-3">
            <Gauge size={22} className="shrink-0 text-teal-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Veículos cadastrados</h2>
          </div>

          <div className="mt-4 space-y-2">
            {vehicles.length === 0 ? (
              <EmptyState
                title="Sem veículos cadastrados"
                description="Cria a primeira viatura para começar a controlar km, revisões, custos e inspeções."
              />
            ) : (
              vehicles.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  href={`/frota/${vehicle.id}`}
                  className="grid min-w-0 gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 transition hover:border-blue-300/50 hover:bg-zinc-900/70 2xl:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(105px,0.45fr))_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                      {vehicle.plate}
                    </p>

                    <h3 className="mt-1 truncate text-lg font-semibold leading-snug text-zinc-50">
                      {vehicle.brand} {vehicle.model}
                    </h3>

                    <p className="mt-1 truncate text-sm leading-5 text-zinc-500">
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
                    <p className="text-xs text-zinc-500">Próx. revisão</p>
                    <p className="mt-1 font-semibold text-blue-200">
                      {formatDate(vehicle.metrics.estimatedRevisionDate)}
                    </p>
                  </div>

                  <span className="hidden items-center justify-end text-zinc-500 2xl:flex">
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