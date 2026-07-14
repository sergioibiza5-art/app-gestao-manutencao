import Link from "next/link";
import { Car, Gauge, Plus } from "lucide-react";

import { createVehicle } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { DetailsPopup } from "@/app/components/details-modal";
import { DetailsOpenButton } from "@/app/components/details-open-button";
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
  const newVehicleAction = (
    <DetailsOpenButton targetId="novo-veiculo" className={buttonClass}>
      <Plus size={18} />
      Novo ve?culo
    </DetailsOpenButton>
  );

  const newVehiclePopup = (
    <DetailsPopup id="novo-veiculo" title="novo ve?culo" maxWidth="max-w-2xl">
      <Panel className="min-w-0">
        <div className="flex items-center gap-3">
          <Car size={22} className="shrink-0 text-blue-300" />
          <h2 className="text-xl font-semibold text-zinc-50">Cadastrar veículo</h2>
        </div>

        <form action={createVehicle} className="mt-4 space-y-3">
          <input name="brand" required className={`${inputClass} w-full min-w-0`} placeholder="Marca" />
          <input name="model" required className={`${inputClass} w-full min-w-0`} placeholder="Modelo" />
          <input name="plate" required className={`${inputClass} w-full min-w-0`} placeholder="MatrÃ­cula" />

          <div className="grid grid-cols-2 gap-3">
            <select name="fuel" className={`${inputClass} w-full min-w-0`}>
              <option value="DIESEL">GasÃ³leo</option>
              <option value="GASOLINE">Gasolina</option>
              <option value="HYBRID">HÃ­brido</option>
              <option value="ELECTRIC">ElÃ©trico</option>
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
    </DetailsPopup>
  );

  return (
    <AppShell activeHref="/frota">
      <PageHeader
        eyebrow="Frota"
        title="Gestão de veículos"
        description="Lista compacta para consulta diária. Abre uma viatura para gerir km, revisões, custos e inspeções."
        action={newVehicleAction}
      />
      {newVehiclePopup}

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

      <section>
        <Panel className="min-w-0">
          <div className="flex items-center gap-3">
            <Gauge size={22} className="shrink-0 text-teal-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Veículos cadastrados</h2>
          </div>

          <div className="mt-4">
            {vehicles.length === 0 ? (
              <EmptyState
                title="Sem veículos cadastrados"
                description="Cria a primeira viatura para começar a controlar km, revisões, custos e inspeções."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/40">
                <div className="hidden min-w-[1120px] grid-cols-[115px_minmax(210px,1.3fr)_minmax(150px,1fr)_105px_95px_125px_155px_60px] gap-0 border-b border-zinc-800 bg-black/30 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 xl:grid">
                  <div>Matrícula</div>
                  <div>Veículo</div>
                  <div>Condutor</div>
                  <div className="text-right">Km</div>
                  <div className="text-right">Km/dia</div>
                  <div className="text-right">Custo</div>
                  <div>Próx. revisão</div>
                  <div></div>
                </div>

                <div className="divide-y divide-zinc-800">
                  {vehicles.map((vehicle) => (
                    <Link
                      key={vehicle.id}
                      href={`/frota/${vehicle.id}`}
                      className="block min-w-[1120px] transition hover:bg-zinc-900/70 xl:grid xl:grid-cols-[115px_minmax(210px,1.3fr)_minmax(150px,1fr)_105px_95px_125px_155px_60px] xl:items-center xl:px-4 xl:py-3"
                    >
                      <div className="grid gap-3 p-4 xl:contents">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 xl:text-sm xl:tracking-normal">
                            {vehicle.plate}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-zinc-50">
                            {vehicle.brand} {vehicle.model}
                          </p>
                          <p className="mt-1 text-sm text-zinc-500 xl:hidden">
                            {fuelLabel(vehicle.fuel)} - {vehicle.year ?? "sem ano"}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs text-zinc-500 xl:hidden">Condutor</p>
                          <p className="truncate text-sm text-zinc-400">
                            {vehicle.driver ?? "Sem condutor"}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 xl:contents">
                          <div className="rounded-lg border border-zinc-800 bg-black/20 p-3 xl:border-0 xl:bg-transparent xl:p-0 xl:text-right">
                            <p className="text-xs text-zinc-500 xl:hidden">Km atuais</p>
                            <p className="font-semibold text-blue-200">{rounded(vehicle.metrics.latestKm)}</p>
                          </div>

                          <div className="rounded-lg border border-zinc-800 bg-black/20 p-3 xl:border-0 xl:bg-transparent xl:p-0 xl:text-right">
                            <p className="text-xs text-zinc-500 xl:hidden">Km/dia</p>
                            <p className="font-semibold text-teal-200">{rounded(vehicle.metrics.averageKmDay)}</p>
                          </div>

                          <div className="rounded-lg border border-zinc-800 bg-black/20 p-3 xl:border-0 xl:bg-transparent xl:p-0 xl:text-right">
                            <p className="text-xs text-zinc-500 xl:hidden">Custo total</p>
                            <p className="font-semibold text-amber-200">{formatCurrency(vehicle.metrics.totalCost)}</p>
                          </div>

                          <div className="rounded-lg border border-zinc-800 bg-black/20 p-3 xl:border-0 xl:bg-transparent xl:p-0">
                            <p className="text-xs text-zinc-500 xl:hidden">Próx. revisão</p>
                            <p className="font-semibold text-blue-200">
                              {formatDate(vehicle.metrics.estimatedRevisionDate)}
                            </p>
                          </div>
                        </div>

                        <div className="hidden justify-end text-zinc-500 xl:flex">
                          Abrir
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
