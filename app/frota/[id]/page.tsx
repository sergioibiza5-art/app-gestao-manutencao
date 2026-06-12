import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calculator, ClipboardCheck, FileText, Gauge, Pencil, Receipt, Trash2, Wrench } from "lucide-react";

import {
  createVehicleKmLog,
  createVehicleService,
  deleteVehicle,
  deleteVehicleKmLog,
  deleteVehicleService,
  updateVehicle,
  updateVehicleKmLog,
  updateVehicleService,
} from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getVehicleDetail } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type VehicleDetailPageProps = {
  params: Promise<{ id: string }>;
};

function dateInputValue(date: Date | string | null | undefined) {
  if (!date) return "";

  const parsed = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function serviceLabel(type: string) {
  if (type === "REVISION") return "Revisao";
  if (type === "INSPECTION") return "Inspecao";
  if (type === "COST") return "Custo";
  return "Manutencao";
}

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

function serviceTone(type: string) {
  if (type === "REVISION") return "border-blue-300/30 bg-blue-300/10 text-blue-200";
  if (type === "INSPECTION") return "border-lime-300/30 bg-lime-300/10 text-lime-200";
  if (type === "COST") return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  return "border-teal-300/30 bg-teal-300/10 text-teal-200";
}

export default async function VehicleDetailPage({ params }: VehicleDetailPageProps) {
  const { id } = await params;
  const vehicle = await getVehicleDetail(id);

  if (!vehicle) {
    notFound();
  }

  const invoiceCost = vehicle.metrics.invoiceCost;
  const totalVehicleCost = vehicle.metrics.totalCost;

  return (
    <AppShell activeHref="/frota">
      <PageHeader
        eyebrow={vehicle.plate}
        title={`${vehicle.brand} ${vehicle.model}`}
        description={`${fuelLabel(vehicle.fuel)} · ${vehicle.year ?? "sem ano"} · ${vehicle.driver ?? "sem condutor"}`}
        action={
          <Link href="/frota" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-blue-300/50">
            <ArrowLeft size={17} />
            Frota
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Panel>
          <p className="text-sm text-zinc-500">Km atuais</p>
          <p className="mt-2 text-3xl font-semibold text-blue-200">{rounded(vehicle.metrics.latestKm)}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Km/dia</p>
          <p className="mt-2 text-3xl font-semibold text-teal-200">{rounded(vehicle.metrics.averageKmDay)}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Km/mes</p>
          <p className="mt-2 text-3xl font-semibold text-teal-200">{rounded(vehicle.metrics.averageKmMonth)}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-zinc-500">Custo total</p>
          <p className="mt-2 text-3xl font-semibold text-amber-200">{formatCurrency(totalVehicleCost)}</p>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center gap-3">
              <Pencil size={22} className="text-blue-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Editar veiculo</h2>
            </div>
            <form action={updateVehicle} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={vehicle.id} />
              <div className="grid grid-cols-2 gap-3">
                <input name="brand" required className={inputClass} defaultValue={vehicle.brand} />
                <input name="model" required className={inputClass} defaultValue={vehicle.model} />
              </div>
              <input name="plate" required className={inputClass} defaultValue={vehicle.plate} />
              <div className="grid grid-cols-2 gap-3">
                <select name="fuel" className={inputClass} defaultValue={vehicle.fuel}>
                  <option value="DIESEL">Gasoleo</option>
                  <option value="GASOLINE">Gasolina</option>
                  <option value="HYBRID">Hibrido</option>
                  <option value="ELECTRIC">Eletrico</option>
                  <option value="LPG">GPL</option>
                  <option value="OTHER">Outro</option>
                </select>
                <input name="year" className={inputClass} defaultValue={vehicle.year ?? ""} />
              </div>
              <input name="driver" className={inputClass} defaultValue={vehicle.driver ?? ""} />
              <textarea name="notes" className={textareaClass} defaultValue={vehicle.notes ?? ""} />
              <button className={buttonClass}>Atualizar</button>
            </form>
            <form action={deleteVehicle} className="mt-2">
              <input type="hidden" name="id" value={vehicle.id} />
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/15">
                <Trash2 size={16} />
                Eliminar veiculo
              </button>
            </form>
          </Panel>

          <Panel>
            <div className="flex items-center gap-3">
              <Calculator size={22} className="text-teal-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Estimativa de revisao</h2>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Km/ano</dt>
                <dd className="font-medium text-zinc-100">{rounded(vehicle.metrics.averageKmYear)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Faltam km</dt>
                <dd className="font-medium text-zinc-100">{vehicle.metrics.kmUntilRevision === null ? "Sem limite" : rounded(vehicle.metrics.kmUntilRevision)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Proxima revisao</dt>
                <dd className="font-medium text-blue-200">{formatDate(vehicle.metrics.estimatedRevisionDate)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Proxima inspecao</dt>
                <dd className="font-medium text-lime-200">{formatDate(vehicle.metrics.nextInspectionDate)}</dd>
              </div>
            </dl>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <div className="flex items-center gap-3">
              <Gauge size={22} className="text-blue-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Registar km</h2>
            </div>
            <form action={createVehicleKmLog} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="vehicleId" value={vehicle.id} />
              <input name="date" type="date" className={inputClass} />
              <input name="odometer" required className={inputClass} placeholder="Quilometros" />
              <button className={buttonClass}>Registar km</button>
              <input name="notes" className={`${inputClass} md:col-span-3`} placeholder="Notas do registo" />
            </form>
          </Panel>

          <Panel>
            <div className="flex items-center gap-3">
              <Wrench size={22} className="text-amber-300" />
              <h2 className="text-xl font-semibold text-zinc-50">Registar servico, revisao, custo ou inspecao</h2>
            </div>
            <form action={createVehicleService} className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-[170px_minmax(260px,1.4fr)_190px_150px]">
              <input type="hidden" name="vehicleId" value={vehicle.id} />
              <select name="type" className={inputClass}>
                <option value="MAINTENANCE">Manutencao</option>
                <option value="REVISION">Revisao</option>
                <option value="INSPECTION">Inspecao</option>
                <option value="COST">Custo</option>
              </select>
              <input name="title" required className={inputClass} placeholder="Titulo" />
              <input name="date" type="date" className={inputClass} />
              <input name="odometer" className={inputClass} placeholder="Km no servico" />
              <input name="cost" className={inputClass} placeholder="Custo" />
              <input name="supplier" className={inputClass} placeholder="Fornecedor / oficina" />
              <input name="nextDueKm" className={inputClass} placeholder="Proxima revisao aos km" />
              <div className="space-y-1">
                <input name="nextDueDate" type="date" className={inputClass} />
                <p className="px-1 text-xs leading-5 text-zinc-500">Data manual apenas se ainda nao houver historico de km suficiente.</p>
              </div>
              <textarea name="notes" className={`${textareaClass} md:col-span-2 2xl:col-span-3`} placeholder="Notas" />
              <button className={`${buttonClass} self-start`}>Guardar servico</button>
            </form>
          </Panel>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <Gauge size={22} className="text-blue-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Historico de km</h2>
          </div>
          <div className="mt-4 space-y-2">
            {vehicle.kmLogs.length === 0 ? (
              <EmptyState title="Sem km" description="Regista leituras de quilometros para calcular medias." />
            ) : (
              [...vehicle.kmLogs].reverse().slice(0, 8).map((log) => (
                <div key={log.id} className="rounded-lg border border-zinc-800 p-3">
                  <form action={updateVehicleKmLog} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="id" value={log.id} />
                    <input type="hidden" name="vehicleId" value={vehicle.id} />
                    <input name="date" type="date" className={inputClass} defaultValue={dateInputValue(log.date)} />
                    <input name="odometer" className={inputClass} defaultValue={log.odometer} />
                    <button className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100">Editar</button>
                    <input name="notes" className={`${inputClass} md:col-span-3`} defaultValue={log.notes ?? ""} />
                  </form>
                  <form action={deleteVehicleKmLog} className="mt-2">
                    <input type="hidden" name="id" value={log.id} />
                    <input type="hidden" name="vehicleId" value={vehicle.id} />
                    <button className="text-xs font-semibold text-rose-300 hover:text-rose-200">Eliminar registo de km</button>
                  </form>
                </div>
              ))
            )}
            {vehicle.kmLogs.length > 8 && (
              <p className="rounded-lg border border-zinc-800 bg-zinc-950/45 p-3 text-sm text-zinc-500">
                A mostrar os 8 registos mais recentes de {vehicle.kmLogs.length}. Os restantes ficam guardados para calculo de medias.
              </p>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <ClipboardCheck size={22} className="text-amber-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Servicos, revisoes, custos e inspecoes</h2>
          </div>
          <div className="mt-4 space-y-3">
            {vehicle.services.length === 0 ? (
              <EmptyState title="Sem servicos" description="Regista manutencoes, revisoes, custos e inspecoes deste veiculo." />
            ) : (
              vehicle.services.map((service) => (
                <article key={service.id} className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${serviceTone(service.type)}`}>{serviceLabel(service.type)}</span>
                      <h3 className="mt-2 font-semibold text-zinc-100">{service.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{formatDate(service.date)} · {service.supplier ?? "sem fornecedor"}</p>
                    </div>
                    <p className="font-semibold text-amber-200">{formatCurrency(service.cost)}</p>
                  </div>
                  <form action={updateVehicleService} className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-[170px_minmax(260px,1.4fr)_190px_150px]">
                    <input type="hidden" name="id" value={service.id} />
                    <input type="hidden" name="vehicleId" value={vehicle.id} />
                    <select name="type" className={inputClass} defaultValue={service.type}>
                      <option value="MAINTENANCE">Manutencao</option>
                      <option value="REVISION">Revisao</option>
                      <option value="INSPECTION">Inspecao</option>
                      <option value="COST">Custo</option>
                    </select>
                    <input name="title" className={inputClass} defaultValue={service.title} placeholder="Titulo" />
                    <input name="date" type="date" className={inputClass} defaultValue={dateInputValue(service.date)} />
                    <input name="odometer" className={inputClass} defaultValue={service.odometer ?? ""} placeholder="Km" />
                    <input name="cost" className={inputClass} defaultValue={service.cost ? String(service.cost) : ""} placeholder="Custo" />
                    <input name="supplier" className={inputClass} defaultValue={service.supplier ?? ""} placeholder="Fornecedor" />
                    <input name="nextDueKm" className={inputClass} defaultValue={service.nextDueKm ?? ""} placeholder="Proxima aos km" />
                    <div className="space-y-1">
                      <input name="nextDueDate" type="date" className={inputClass} defaultValue={dateInputValue(service.nextDueDate)} />
                      <p className="px-1 text-xs leading-5 text-zinc-500">Recalculada pelos km se houver historico.</p>
                    </div>
                    <textarea name="notes" className={`${textareaClass} md:col-span-2 2xl:col-span-3`} defaultValue={service.notes ?? ""} />
                    <button className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100">Editar servico</button>
                  </form>
                  <form action={deleteVehicleService} className="mt-2">
                    <input type="hidden" name="id" value={service.id} />
                    <input type="hidden" name="vehicleId" value={vehicle.id} />
                    <button className="text-xs font-semibold text-rose-300 hover:text-rose-200">Eliminar servico</button>
                  </form>
                </article>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section>
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <Receipt size={22} className="text-amber-300" />
              <div>
                <h2 className="text-xl font-semibold text-zinc-50">Faturas associadas</h2>
                <p className="mt-1 text-sm text-zinc-500">Despesas ligadas a esta viatura no modulo financeiro.</p>
              </div>
            </div>
            <p className="text-lg font-semibold text-amber-200">{formatCurrency(invoiceCost)}</p>
          </div>
          <div className="mt-4 space-y-3">
            {vehicle.expenses.length === 0 ? (
              <EmptyState title="Sem faturas" description="Associa uma despesa a esta viatura para acompanhar custos de manutencao, revisao ou pneus." />
            ) : (
              vehicle.expenses.map((expense) => {
                const invoice = expense.documents.find((document) => document.type === "INVOICE" && document.fileUrl);

                return (
                  <Link key={expense.id} href={`/despesas/${expense.id}`} className="block rounded-lg border border-zinc-800 bg-black/20 p-3 transition hover:border-amber-300/50 hover:bg-zinc-950/70">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-100">{expense.title}</h3>
                        <p className="mt-1 text-sm text-zinc-500">{formatDate(expense.date)} - {expense.supplier ?? expense.category}</p>
                        {invoice && (
                          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-300">
                            <FileText size={13} />
                            Fatura associada
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-amber-200">{formatCurrency(expense.amount)}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
