import Link from "next/link";
import { ArrowRight, ClipboardList, Ruler, Settings } from "lucide-react";

import { createConsumable, createEquipment } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function FrequencySelect({ name }: { name: string }) {
  return (
    <select name={name} className={inputClass}>
      <option value="MONTHLY">Mensal</option>
      <option value="QUARTERLY">Trimestral</option>
      <option value="FOUR_MONTHLY">Quadrimestral</option>
      <option value="SEMIANNUAL">Semestral</option>
      <option value="ANNUAL">Anual</option>
      <option value="WEEKLY">Semanal</option>
      <option value="DAILY">Diária</option>
    </select>
  );
}

function InterventionPlanFields({
  prefix,
  title,
  description,
}: {
  prefix: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
      <div className="flex items-start gap-3">
        <input id={`${prefix}Enabled`} name={`${prefix}Enabled`} value="true" type="checkbox" className="mt-1 size-4 accent-teal-300" />
        <div className="min-w-0 flex-1">
          <label htmlFor={`${prefix}Enabled`} className="font-medium text-zinc-100">{title}</label>
          <p className="mt-1 text-sm leading-5 text-zinc-500">{description}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[0.45fr_1fr]">
        <FrequencySelect name={`${prefix}Frequency`} />
        <textarea name={`${prefix}Actions`} className={textareaClass} placeholder="Ações a realizar" />
      </div>
    </div>
  );
}

export default async function InventoryPage() {
  const { equipment, consumables, equipmentTypes } = await getModuleData();

  return (
    <AppShell activeHref="/inventario">
      <PageHeader
        eyebrow="Cadastro"
        title="Equipamentos e consumíveis"
        description="Cria a ficha completa do equipamento, define se é equipamento de medição e monitorização, e associa os planos de inspeção e manutenção."
      />

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <Settings size={22} className="text-orange-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Cadastro de equipamento</h2>
          </div>
          <form action={createEquipment} className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input name="name" required className={inputClass} placeholder="Nome do equipamento" />
              <input name="code" className={inputClass} placeholder="Código interno" />
              <input name="purchaseDate" type="date" className={inputClass} />
              <input name="supplier" className={inputClass} placeholder="Fornecedor" />
              <input name="location" className={inputClass} placeholder="Localização" />
              <input name="responsibleDepartment" className={inputClass} placeholder="Dep. responsável" />
              <input name="brand" className={inputClass} placeholder="Fabricante / Marca" />
              <input name="model" className={inputClass} placeholder="Modelo" />
              <input name="serialNumber" className={inputClass} placeholder="N.º de série" />
              <select name="equipmentTypeId" className={inputClass}>
                <option value="">Sem tipo/checklist associado</option>
                {equipmentTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              <select name="isMeasurementMonitoring" className={inputClass}>
                <option value="false">Não é equipamento de medição/monitorização</option>
                <option value="true">É equipamento de medição/monitorização</option>
              </select>
              <input name="category" className={inputClass} placeholder="Categoria" />
              <select name="status" className={inputClass}>
                <option value="ACTIVE">Ativo</option>
                <option value="MAINTENANCE">Em manutenção</option>
                <option value="INACTIVE">Inativo</option>
                <option value="DISCARDED">Abatido</option>
              </select>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <ClipboardList size={19} className="text-teal-300" />
                <h3 className="font-semibold text-zinc-100">Intervenções previstas</h3>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                <InterventionPlanFields prefix="inspectionInternal" title="Inspeção interna" description="Verificação feita pela equipa interna." />
                <InterventionPlanFields prefix="inspectionExternal" title="Inspeção externa" description="Verificação feita por entidade/fornecedor externo." />
                <InterventionPlanFields prefix="maintenanceInternal" title="Manutenção interna" description="Manutenção executada pela equipa interna." />
                <InterventionPlanFields prefix="maintenanceExternal" title="Manutenção externa" description="Manutenção executada por fornecedor externo." />
              </div>
            </div>

            <textarea name="notes" className={textareaClass} placeholder="Notas gerais do equipamento" />
            <button className={buttonClass}>Guardar equipamento</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Novo consumível</h2>
          <form action={createConsumable} className="mt-4 space-y-3">
            <input name="name" required className={inputClass} placeholder="Nome" />
            <div className="grid grid-cols-2 gap-3">
              <input name="category" className={inputClass} placeholder="Categoria" />
              <input name="unit" className={inputClass} placeholder="Unidade" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="currentStock" className={inputClass} placeholder="Stock atual" />
              <input name="minimumStock" className={inputClass} placeholder="Stock mínimo" />
            </div>
            <input name="location" className={inputClass} placeholder="Localização" />
            <input name="supplier" className={inputClass} placeholder="Fornecedor" />
            <textarea name="notes" className={textareaClass} placeholder="Notas" />
            <button className={buttonClass}>Guardar consumível</button>
          </form>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Equipamentos cadastrados</h2>
          <div className="mt-4 space-y-3">
            {equipment.length === 0 ? (
              <EmptyState title="Sem equipamentos" description="Cria os primeiros equipamentos para alimentar as manutenções, calibrações e agendamentos." />
            ) : (
              equipment.map((item) => (
                <Link key={item.id} href={`/inventario/${item.id}`} className="block rounded-lg border border-zinc-800 bg-zinc-950/65 p-4 transition hover:border-teal-300/40">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-zinc-100">{item.name}</h3>
                        {item.isMeasurementMonitoring && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-lime-300/10 px-2 py-1 text-xs text-lime-200">
                            <Ruler size={13} />
                            medição
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {item.code ?? "sem código"} · {item.equipmentType?.name ?? "sem tipo"} · {item.location ?? "sem localização"} · {item.responsibleDepartment ?? "sem departamento"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">Aquisição: {formatDate(item.purchaseDate)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-teal-300">
                      Abrir ficha
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Consumíveis</h2>
          <div className="mt-4 space-y-3">
            {consumables.length === 0 ? (
              <EmptyState title="Sem consumíveis" description="Adiciona consumíveis para controlar stock mínimo e reposições." />
            ) : (
              consumables.map((item) => (
                <article key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{item.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{item.category} · {item.location ?? "sem localização"}</p>
                    </div>
                    <p className="text-sm font-semibold text-orange-300">{String(item.currentStock)} {item.unit}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
