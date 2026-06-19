import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
  ExternalLink,
  History,
  Package,
  Receipt,
  Ruler,
} from "lucide-react";

import {
  updateEquipmentBasics,
} from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import {
  buttonClass,
  EmptyState,
  inputClass,
  PageHeader,
  Panel,
  textareaClass,
} from "@/app/components/ui";
import { getEquipmentDetail, getEquipmentOptions, getEquipmentTypes } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type EquipmentDetailPageProps = {
  params: Promise<{ id: string }>;
};

function kindLabel(kind: string) {
  return kind === "INSPECTION" ? "Inspeção" : "Manutenção";
}

function typeLabel(type: string) {
  return type === "EXTERNAL" ? "Externa" : "Interna";
}

function frequencyLabel(frequency: string) {
  const labels: Record<string, string> = {
    DAILY: "Diária",
    WEEKLY: "Semanal",
    MONTHLY: "Mensal",
    QUARTERLY: "Trimestral",
    FOUR_MONTHLY: "Quadrimestral",
    SEMIANNUAL: "Semestral",
    ANNUAL: "Anual",
    BIENNIAL: "Bienal (2 anos)",
    FIVE_YEAR: "Quinquenal (5 anos)",
  };

  return labels[frequency] ?? frequency;
}

function dateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EquipmentDetailPage({ params }: EquipmentDetailPageProps) {
  const { id } = await params;
  const [equipment, equipmentTypes, equipmentOptions] = await Promise.all([
    getEquipmentDetail(id),
    getEquipmentTypes(),
    getEquipmentOptions(),
  ]);

  if (!equipment) {
    notFound();
  }

  const activeTemplate = equipment.equipmentType?.checklistTemplates[0];
  const equipmentExpenseTotal = equipment.expenses.reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0
  );

const ticketCostTotal = equipment.tickets.reduce(
  (sum, ticket) => sum + Number(ticket.totalCost ?? 0),
  0
);

const openTicketsCount = equipment.tickets.filter((ticket) =>
  ["OPEN", "IN_PROGRESS", "PAUSED", "DONE"].includes(ticket.status)
).length;

const activeWorkOrdersCount = equipment.workOrders.filter((workOrder) =>
  ["IN_PROGRESS", "PAUSED"].includes(workOrder.status)
).length;

  const historyItems = [
    ...equipment.interventionLogs.map((item) => ({
      id: item.id,
      date: item.performedAt,
      title: item.title,
      type: `${kindLabel(item.kind)} ${typeLabel(item.type).toLowerCase()}`,
      by: item.performedBy ?? "Sem responsável",
      description: item.actionsDone,
      result: item.result,
      cost: null,
    })),
    ...equipment.maintenanceLogs.map((item) => ({
      id: item.id,
      date: item.date,
      title: item.title,
      type: `Manutenção ${typeLabel(item.type).toLowerCase()}`,
      by: item.performedBy ?? item.user?.name ?? item.supplier ?? "Sem responsável",
      description: item.description ?? item.notes ?? "Sem descrição",
      result: item.nextDate ? `Próxima: ${formatDate(item.nextDate)}` : null,
      cost: item.cost,
    })),
    ...equipment.calibrationLogs.map((item) => ({
      id: item.id,
      date: item.calibrationDate,
      title: item.title,
      type: "Calibração",
      by: item.certificateNo ?? "Sem certificado",
      description: item.result ?? item.notes ?? "Sem resultado",
      result: item.approved ? "Aprovado" : "Reprovado",
      cost: null,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <AppShell activeHref="/equipamentos">
      <PageHeader
        eyebrow="Ficha de equipamento"
        title={equipment.name}
        description="Consulta o cadastro, as checklists internas e o histórico das intervenções efetuadas."
        action={
          <div className="flex flex-wrap gap-2">
            {activeTemplate && (
              <Link
                href={`/equipamentos/${equipment.id}/checklist-interna`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200"
              >
                <ClipboardCheck size={17} />
                Checklist interna
              </Link>
            )}

            <Link
              href="/equipamentos"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50"
            >
              <ArrowLeft size={17} />
              Equipamentos
            </Link>
          </div>
        }
      />

<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  <Panel>
    <p className="text-sm text-zinc-500">Despesas</p>
    <p className="mt-2 text-3xl font-semibold text-amber-200">
      {formatCurrency(equipmentExpenseTotal)}
    </p>
  </Panel>

  <Panel>
    <p className="text-sm text-zinc-500">Tickets</p>
    <p className="mt-2 text-3xl font-semibold text-cyan-200">
      {formatCurrency(ticketCostTotal)}
    </p>
  </Panel>

  <Panel>
    <p className="text-sm text-zinc-500">Tickets abertos</p>
    <p className="mt-2 text-3xl font-semibold text-orange-300">
      {openTicketsCount}
    </p>
  </Panel>

  <Panel>
    <p className="text-sm text-zinc-500">Manutenções iniciadas</p>
    <p className="mt-2 text-3xl font-semibold text-teal-300">
      {activeWorkOrdersCount}
    </p>
  </Panel>
</section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <Ruler
              size={22}
              className={equipment.isMeasurementMonitoring ? "text-lime-300" : "text-zinc-500"}
            />
            <h2 className="text-xl font-semibold text-zinc-50">Cadastro</h2>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Código interno", equipment.code ?? "Sem código"],
              ["Tipo de equipamento", equipment.equipmentType?.name ?? "Sem tipo"],
              ["Data de aquisição", formatDate(equipment.purchaseDate)],
              ["Fornecedor", equipment.supplier ?? "Sem fornecedor"],
              ["Localização", equipment.location ?? "Sem localização"],
              ["Dep. responsável", equipment.responsibleDepartment ?? "Sem departamento"],
              ["Fabricante / Marca", equipment.brand ?? "Sem marca"],
              ["Modelo", equipment.model ?? "Sem modelo"],
              ["N.º de série", equipment.serialNumber ?? "Sem n.º série"],
              ["Medição e monitorização", equipment.isMeasurementMonitoring ? "Sim" : "Não"],
              ["Estado", equipment.status],
              ["Faz parte de", equipment.parentEquipment?.name ?? "Sem equipamento-pai"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-100">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel>
  <div className="flex items-center gap-3">
    <ClipboardCheck size={22} className="text-teal-300" />
    <h2 className="text-xl font-semibold text-zinc-50">Planos de intervenção</h2>
  </div>

  <div className="mt-4 space-y-4">
    {equipment.maintenanceSchedules.length > 0 && (
  <div className="grid gap-3 md:grid-cols-2">
    {equipment.maintenanceSchedules.map((schedule) => (
          <article key={schedule.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <h3 className="font-semibold text-zinc-100">
        {schedule.title}
      </h3>
      <p className="mt-1 text-sm text-teal-300">
        Periodicidade: {frequencyLabel(schedule.frequency)}
      </p>
    </div>

    <span
      className={
        schedule.workOrder
          ? "rounded-md bg-teal-300/10 px-2 py-1 text-xs text-teal-200"
          : "rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400"
      }
    >
      {schedule.workOrder ? "OP criada" : "Agendado"}
    </span>
  </div>

  <p className="mt-3 text-sm leading-6 text-zinc-400">
    {schedule.description ?? "Sem descrição"}
  </p>

  <p className="mt-2 text-xs text-zinc-500">
    Próxima data: {formatDate(schedule.scheduledAt)}
  </p>
</article>
        ))}
      </div>
    )}

    {activeTemplate && activeTemplate.items.length > 0 && (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Checklist associada
        </p>

        <div className="space-y-2">
          {activeTemplate.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-zinc-800 bg-black/20 p-3">
              <p className="text-sm font-semibold text-zinc-100">
                {item.order}. {item.check}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {item.expectedCondition}
                {item.photoRequired ? " · Foto obrigatória" : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    )}

    {equipment.maintenanceSchedules.length === 0 &&
 (!activeTemplate || activeTemplate.items.length === 0) && (
      <EmptyState
        title="Sem planos definidos"
        description="Este equipamento ainda não tem planos nem checklist associada."
      />
    )}
  </div>
</Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <div className="flex items-center gap-3">
            <Package size={22} className="text-orange-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Equipamentos associados</h2>
          </div>
          <div className="mt-4 space-y-3">
            {equipment.childEquipment.length === 0 ? (
              <EmptyState title="Sem equipamentos associados" description="Associa compressores, tanques, secadores ou subconjuntos pelo campo equipamento-pai." />
            ) : (
              equipment.childEquipment.map((child) => (
                <Link key={child.id} href={`/equipamentos/${child.id}`} className="block rounded-lg border border-zinc-800 bg-zinc-950/65 p-4 transition hover:border-orange-300/50">
                  <h3 className="font-semibold text-zinc-100">{child.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{child.code ?? "Sem codigo"}</p>
                </Link>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <Ruler size={22} className="text-lime-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Equipamentos de calibracao associados</h2>
          </div>
          <div className="mt-4 space-y-3">
            {equipment.childEquipment.filter((child) => child.isMeasurementMonitoring).length === 0 ? (
              <EmptyState title="Sem equipamentos de calibracao associados" description="Quando um equipamento de medicao fizer parte deste conjunto, aparece aqui." />
            ) : (
              equipment.childEquipment.filter((child) => child.isMeasurementMonitoring).map((child) => (
                <Link key={child.id} href={`/equipamentos/${child.id}`} className="block rounded-lg border border-zinc-800 bg-zinc-950/65 p-4 transition hover:border-lime-300/50">
                  <h3 className="font-semibold text-zinc-100">{child.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{child.code ?? "Sem codigo"}</p>
                </Link>
              ))
            )}
          </div>
        </Panel>
      </section>

      <Panel>
        <div className="flex items-center gap-3">
          <ClipboardCheck size={22} className="text-teal-300" />
          <h2 className="text-xl font-semibold text-zinc-50">Atualizar cadastro</h2>
        </div>

        <form action={updateEquipmentBasics} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="equipmentId" value={equipment.id} />
          <input name="name" required className={inputClass} defaultValue={equipment.name} placeholder="Nome do equipamento" />
          <input name="code" className={inputClass} defaultValue={equipment.code ?? ""} placeholder="Código interno" />
          <input name="purchaseDate" type="date" className={inputClass} defaultValue={dateInputValue(equipment.purchaseDate)} />
          <input name="supplier" className={inputClass} defaultValue={equipment.supplier ?? ""} placeholder="Fornecedor" />
          <input name="location" className={inputClass} defaultValue={equipment.location ?? ""} placeholder="Localização" />
          <input name="responsibleDepartment" className={inputClass} defaultValue={equipment.responsibleDepartment ?? ""} placeholder="Dep. responsável" />
          <input name="brand" className={inputClass} defaultValue={equipment.brand ?? ""} placeholder="Fabricante / Marca" />
          <input name="model" className={inputClass} defaultValue={equipment.model ?? ""} placeholder="Modelo" />
          <input name="serialNumber" className={inputClass} defaultValue={equipment.serialNumber ?? ""} placeholder="N.º de série" />

          <select name="equipmentTypeId" className={inputClass} defaultValue={equipment.equipmentTypeId ?? ""}>
            <option value="">Sem tipo/checklist associado</option>
            {equipmentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>

          <select name="parentEquipmentId" className={inputClass} defaultValue={equipment.parentEquipmentId ?? ""}>
            <option value="">Sem equipamento-pai</option>
            {equipmentOptions
              .filter((item) => item.id !== equipment.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.code ? ` - ${item.code}` : ""}
                </option>
              ))}
          </select>

          <select name="isMeasurementMonitoring" className={inputClass} defaultValue={equipment.isMeasurementMonitoring ? "true" : "false"}>
            <option value="false">Não é equipamento de medição/monitorização</option>
            <option value="true">É equipamento de medição/monitorização</option>
          </select>

          <input name="category" className={inputClass} defaultValue={equipment.category} placeholder="Categoria" />

          <select name="status" className={inputClass} defaultValue={equipment.status}>
            <option value="ACTIVE">Ativo</option>
            <option value="MAINTENANCE">Em manutenção</option>
            <option value="INACTIVE">Inativo</option>
            <option value="DISCARDED">Abatido</option>
          </select>

          <input name="warrantyUntil" type="date" className={inputClass} defaultValue={dateInputValue(equipment.warrantyUntil)} />

          <textarea
            name="notes"
            className={`${textareaClass} md:col-span-2 xl:col-span-3`}
            defaultValue={equipment.notes ?? ""}
            placeholder="Notas gerais do equipamento"
          />

          <div className="md:col-span-2 xl:col-span-3">
            <button className={buttonClass}>Guardar alterações</button>
          </div>
        </form>
      </Panel>

      <Panel>
        <div className="flex items-center gap-3">
          <Receipt size={22} className="text-amber-300" />
          <h2 className="text-xl font-semibold text-zinc-50">Despesas associadas</h2>
        </div>

        <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
          <p className="text-sm text-amber-100/70">Total registado neste equipamento</p>
          <p className="mt-1 text-3xl font-semibold text-amber-200">{formatCurrency(equipmentExpenseTotal)}</p>
        </div>

        <div className="mt-4 space-y-3">
          {equipment.expenses.length === 0 ? (
            <EmptyState
              title="Sem despesas associadas"
              description="Quando associares despesas a este equipamento, elas aparecem aqui com a respetiva fatura."
            />
          ) : (
            equipment.expenses.map((expense) => {
              const invoice = expense.documents.find((document) => document.type === "INVOICE" && document.fileUrl);

              return (
                <Link
                  key={expense.id}
                  href={`/despesas/${expense.id}`}
                  className="block rounded-lg border border-zinc-800 bg-zinc-950/65 p-4 transition hover:border-amber-300/50"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{expense.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{expense.supplier ?? expense.category}</p>
                      {invoice && <p className="mt-1 text-xs font-medium text-sky-300">Fatura associada</p>}
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-amber-300">{formatCurrency(expense.amount)}</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatDate(expense.date)}</p>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-3">
          <Ruler size={22} className="text-lime-300" />
          <h2 className="text-xl font-semibold text-zinc-50">Calibracoes e certificados</h2>
        </div>

        <div className="mt-4 space-y-3">
          {equipment.calibrationLogs.length === 0 ? (
            <EmptyState title="Sem calibracoes registadas" description="Quando este equipamento tiver certificados de calibracao, ficam visiveis aqui." />
          ) : (
            equipment.calibrationLogs.map((log) => {
              const certificate = log.documents.find((document) => document.type === "CERTIFICATE" && document.fileUrl);
              return (
                <article key={log.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{log.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{log.certificateNo ?? "Sem certificado"} - {log.result ?? "Sem resultado"}</p>
                      {certificate && (
                        <a href={certificate.fileUrl ?? "#"} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-sky-300">
                          Abrir certificado
                        </a>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className={log.approved ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-rose-300"}>
                        {log.approved ? "Aprovado" : "Reprovado"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">Prox.: {formatDate(log.nextDueDate)}</p>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-3">
          <Package size={22} className="text-amber-300" />
          <h2 className="text-xl font-semibold text-zinc-50">Peças e consumíveis associados</h2>
        </div>

        <div className="mt-4 space-y-3">
          {equipment.consumables.length === 0 ? (
            <EmptyState
              title="Sem stock associado"
              description="Quando associares peças ou consumíveis a este equipamento, eles aparecem aqui."
            />
          ) : (
            equipment.consumables.map((item) => (
              <article key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-zinc-100">{item.name}</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {item.category} - {item.location ?? "sem localização"}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="font-semibold text-amber-300">
                      {String(item.currentStock)} {item.unit}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Mínimo: {String(item.minimumStock)} {item.unit}
                    </p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-3">
          <ClipboardCheck size={22} className="text-sky-300" />
          <h2 className="text-xl font-semibold text-zinc-50">Checklists internas preenchidas</h2>
        </div>

        <div className="mt-4 space-y-3">
          {equipment.internalMaintenanceRecords.length === 0 ? (
            <EmptyState
              title="Sem checklists preenchidas"
              description="Quando executares a manutenção interna por checklist, os registos aparecem aqui com respostas e fotos."
            />
          ) : (
            equipment.internalMaintenanceRecords.map((record) => (
              <article key={record.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                      {record.template.title}
                    </p>
                    <h3 className="mt-1 font-semibold text-zinc-100">{record.documentNo ?? "Sem documento"}</h3>
                    <p className="mt-2 text-sm text-zinc-500">
                      Responsável: {record.responsible ?? "Sem responsável"}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-sm font-medium text-sky-300">{formatDate(record.performedAt)}</p>
                    <p className="mt-1 text-xs text-zinc-500">{record.responses.length} resposta(s)</p>

                    <Link
                      href={`/equipamentos/${equipment.id}/checklist-interna/${record.id}`}
                      className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-100 transition hover:border-sky-300/60"
                    >
                      <ExternalLink size={14} />
                      Abrir documento
                    </Link>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {record.responses.slice(0, 8).map((response) => (
                    <div key={response.id} className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-400">
                      <span className="font-medium text-zinc-200">{response.status}</span> · {response.item.check}
                      {response.photos.length > 0 && (
                        <span className="ml-2 text-sky-300">{response.photos.length} foto(s)</span>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </Panel>

      <section>
        <Panel>
          <div className="flex items-center gap-3">
            <History size={22} className="text-amber-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Histórico de intervenções</h2>
          </div>

          <div className="mt-4 space-y-3">
            {historyItems.length === 0 ? (
              <EmptyState
                title="Sem histórico"
                description="Quando forem feitas inspeções, manutenções ou calibrações, ficam registadas aqui."
              />
            ) : (
              historyItems.map((item) => (
                <article key={`${item.type}-${item.id}`} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{item.type}</p>
                      <h3 className="mt-1 font-semibold text-zinc-100">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
                      <p className="mt-2 text-sm text-zinc-500">Por: {item.by}</p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-sm font-medium text-teal-300">{formatDate(item.date)}</p>
                      {item.cost !== null && <p className="mt-1 text-sm text-cyan-300">{formatCurrency(item.cost)}</p>}
                      {item.result && <p className="mt-1 text-xs text-zinc-500">{item.result}</p>}
                    </div>
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