import Link from "next/link";
import { CalendarDays, Car, Gauge, Plus } from "lucide-react";

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

type FleetPageProps = {
  searchParams?: Promise<{ erro?: string }>;
};

export default async function FleetPage({ searchParams }: FleetPageProps) {
  const params = (await searchParams) ?? {};
  const { vehicles } = await getFleetData();

  const totalVehicles = vehicles.length;
  const totalCost = vehicles.reduce((sum, vehicle) => sum + vehicle.metrics.totalCost, 0);
  const totalLatestKm = vehicles.reduce((sum, vehicle) => sum + vehicle.metrics.latestKm, 0);
  const fleetSchedule = vehicles
    .flatMap((vehicle) => [
      vehicle.metrics.estimatedRevisionDate || vehicle.metrics.kmUntilRevision !== null
        ? {
            id: `${vehicle.id}-revision`,
            vehicleId: vehicle.id,
            type: "Revisão",
            vehicle: `${vehicle.brand} ${vehicle.model}`,
            plate: vehicle.plate,
            driver: vehicle.driver,
            dueDate: vehicle.metrics.estimatedRevisionDate,
            kmRemaining: vehicle.metrics.kmUntilRevision,
          }
        : null,
      vehicle.metrics.nextInspectionDate || vehicle.metrics.kmUntilInspection !== null
        ? {
            id: `${vehicle.id}-inspection`,
            vehicleId: vehicle.id,
            type: "Inspeção",
            vehicle: `${vehicle.brand} ${vehicle.model}`,
            plate: vehicle.plate,
            driver: vehicle.driver,
            dueDate: vehicle.metrics.nextInspectionDate,
            kmRemaining: vehicle.metrics.kmUntilInspection,
          }
        : null,
    ])
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));
  const newVehicleAction = (
    <DetailsOpenButton targetId="novo-veiculo" className={buttonClass}>
      <Plus size={18} />
      Novo veículo
    </DetailsOpenButton>
  );

  const newVehiclePopup = (
    <DetailsPopup id="novo-veiculo" title="novo veículo" maxWidth="max-w-2xl">
      <Panel className="min-w-0">
        <div className="flex items-center gap-3">
          <Car size={22} className="shrink-0 text-blue-300" />
          <h2 className="text-xl font-semibold text-zinc-50">Cadastrar veículo</h2>
        </div>

        <form action={createVehicle} className="mt-4 space-y-3">
          <input name="brand" required className={`${inputClass} w-full min-w-0`} placeholder="Marca" />
          <input name="model" required className={`${inputClass} w-full min-w-0`} placeholder="Modelo" />
          <input name="code" className={`${inputClass} w-full min-w-0`} placeholder="Codigo interno" />
          <input name="plate" required className={`${inputClass} w-full min-w-0`} placeholder="Matrí­cula" />

          <div className="grid grid-cols-2 gap-3">
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

      {params.erro && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100">
          {params.erro}
        </div>
      )}

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

      <Panel>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays size={22} className="shrink-0 text-blue-300" />
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Agendado na frota</h2>
              <p className="mt-1 text-sm text-zinc-500">Próximas revisões e inspeções previstas para todas as viaturas.</p>
            </div>
          </div>
          <span className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm font-semibold text-zinc-300">
            {fleetSchedule.length} evento(s)
          </span>
        </div>

        {fleetSchedule.length === 0 ? (
          <EmptyState title="Sem agendamentos" description="Quando existirem revisões ou inspeções previstas, aparecem aqui." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fleetSchedule.map((item) => (
              <Link
                key={item.id}
                href={`/frota/${item.vehicleId}`}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 transition hover:border-blue-300/50 hover:bg-zinc-900/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={item.type === "Inspeção" ? "text-sm font-semibold text-lime-200" : "text-sm font-semibold text-blue-200"}>
                      {item.type}
                    </p>
                    <h3 className="mt-2 font-semibold text-zinc-100">{item.vehicle}</h3>
                    <p className="mt-1 text-sm text-zinc-500">{item.plate}</p>
                  </div>
                  <span className="rounded-md border border-zinc-800 bg-black/30 px-2 py-1 text-xs text-zinc-300">
                    {formatDate(item.dueDate)}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  {item.driver && <span className="rounded-md bg-zinc-900 px-2 py-1 text-zinc-400">{item.driver}</span>}
                  {item.kmRemaining !== null && (
                    <span className={item.kmRemaining <= 1000 ? "rounded-md border border-amber-300/35 bg-amber-300/10 px-2 py-1 font-semibold text-amber-100" : "rounded-md bg-zinc-900 px-2 py-1 text-zinc-400"}>
                      {item.kmRemaining <= 0 ? "Km ultrapassados" : `${item.kmRemaining.toLocaleString("pt-PT")} km restantes`}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

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
                <div className="hidden min-w-320 grid-cols-[105px_115px_minmax(210px,1.3fr)_minmax(150px,1fr)_105px_95px_125px_155px_60px] gap-0 border-b border-zinc-800 bg-black/30 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 xl:grid">
                  <div>Código</div>
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
                      className="block min-w-320 transition hover:bg-zinc-900/70 xl:grid xl:grid-cols-[105px_115px_minmax(210px,1.3fr)_minmax(150px,1fr)_105px_95px_125px_155px_60px] xl:items-center xl:px-4 xl:py-3"
                    >
                      <div className="grid gap-3 p-4 xl:contents">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 xl:text-sm xl:tracking-normal">
                            {vehicle.code ?? "—"}
                          </p>
                        </div>

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
