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
  applyDl50TemplateToEquipment,
  applyDl50TemplateToEquipments,
  archiveDl50Assessment,
  attachDl50AssessmentToDocuments,
  createDl50Assessment,
  createDl50AssessmentTemplate,
  updateDl50Assessment,
  updateDl50AssessmentTemplate,
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

const dl50Questions = [
  ["ceMark", "Marcação CE"],
  ["manufacturerManual", "Manual do fabricante disponível"],
  ["suitableForUse", "Equipamento adequado à utilização prevista"],
  ["maintenancePlan", "Plano de manutenção preventiva existente"],
  ["safetyDependsOnInstallation", "Segurança depende da instalação"],
  ["subjectToRiskDeterioration", "Equipamento sujeito a deteriorações que possam causar riscos"],
  ["needsPeriodicVerification", "Necessita de verificações periódicas específicas"],
  ["hasDangerZone", "Possui zonas perigosas acessíveis"],
  ["hasMovingPartsRisk", "Possui elementos móveis com risco mecânico"],
  ["hasIdentifiedControls", "Possui comandos identificados"],
  ["voluntaryStart", "Arranque apenas por ação voluntária"],
  ["emergencyStopRequired", "Paragem de emergência necessária"],
  ["projectionRisk", "Risco de projeções"],
  ["emissionRisk", "Risco de emanações, poeiras, vapores ou líquidos"],
  ["electricalRisk", "Risco elétrico"],
  ["fireRisk", "Risco de incêndio"],
  ["explosionRisk", "Risco de explosão"],
  ["energyIsolation", "Fontes de energia isoláveis"],
  ["safetySignage", "Sinalização de segurança aplicável"],
  ["operatorsInformed", "Operadores informados/formados"],
  ["usedAccordingToManufacturer", "Utilização conforme instruções do fabricante"],
] as const;

const dl50QuestionSections = [
  {
    title: "1. Documentacao e enquadramento",
    description: "Evidencias de conformidade, informacao do fabricante e avaliacao de riscos.",
    items: [
      ["ceMark", "Marcacao CE"],
      ["manufacturerManual", "Manual do fabricante disponivel"],
      ["conformityDeclaration", "Declaracao de conformidade disponivel"],
      ["riskAssessment", "Avaliacao de riscos documentada"],
      ["suitableForUse", "Equipamento adequado a utilizacao prevista"],
      ["usedAccordingToManufacturer", "Utilizacao conforme instrucoes do fabricante"],
    ],
  },
  {
    title: "2. Utilizacao, instalacao e verificacoes",
    description: "Plano preventivo, registos, verificacoes especificas e condicoes de instalacao.",
    items: [
      ["maintenancePlan", "Plano de manutencao preventiva existente"],
      ["maintenanceRecords", "Registos de manutencao/verificacao mantidos"],
      ["instructionsAvailableAtWorkplace", "Instrucoes disponiveis no local de trabalho"],
      ["safetyDependsOnInstallation", "Seguranca depende da instalacao"],
      ["installationVerification", "Instalacao verificada antes da utilizacao"],
      ["inspectionAfterAssembly", "Verificacao apos montagem ou reinstalacao"],
      ["subjectToRiskDeterioration", "Sujeito a deterioracoes que possam causar riscos"],
      ["needsPeriodicVerification", "Necessita de verificacoes periodicas especificas"],
      ["periodicInspectionPlan", "Plano de verificacoes periodicas definido"],
      ["inspectionAfterExceptionalEvents", "Verificacao apos eventos excecionais"],
    ],
  },
  {
    title: "3. Estrutura, acesso e posto de trabalho",
    description: "Condicoes fisicas, estabilidade, acessos, iluminacao e ergonomia.",
    items: [
      ["stableAndResistant", "Equipamento estavel e resistente"],
      ["safeAccess", "Acessos e zonas de trabalho seguros"],
      ["adequateLighting", "Iluminacao adequada para utilizacao/manutencao"],
      ["ergonomicConditions", "Condicoes ergonomicas adequadas"],
    ],
  },
  {
    title: "4. Protecoes e riscos mecanicos",
    description: "Zonas perigosas, partes moveis, protecoes e risco de projecoes.",
    items: [
      ["hasDangerZone", "Possui zonas perigosas acessiveis"],
      ["hasMovingPartsRisk", "Possui elementos moveis com risco mecanico"],
      ["guardsAndProtectiveDevices", "Resguardos/protecao adequados e funcionais"],
      ["projectionRisk", "Risco de projecoes"],
    ],
  },
  {
    title: "5. Comandos, paragem e energia",
    description: "Comandos identificados, arranque voluntario, paragem segura e isolamento de energia.",
    items: [
      ["hasIdentifiedControls", "Possui comandos identificados"],
      ["controlSystemSafe", "Sistema de comando seguro e coerente"],
      ["voluntaryStart", "Arranque apenas por acao voluntaria"],
      ["safeStop", "Paragem segura"],
      ["emergencyStopRequired", "Paragem de emergencia necessaria"],
      ["emergencyStopAccessible", "Paragem de emergencia acessivel e funcional"],
      ["energyFailureSafe", "Falha/restabelecimento de energia nao cria perigo"],
      ["energyIsolation", "Fontes de energia isolaveis"],
      ["residualEnergyControlled", "Energia residual controlada/descargavel"],
    ],
  },
  {
    title: "6. Riscos especificos",
    description: "Riscos eletricos, incendio, explosao, emissoes, superficies e vibracoes.",
    items: [
      ["emissionRisk", "Risco de emanacoes, poeiras, vapores ou liquidos"],
      ["electricalRisk", "Risco eletrico"],
      ["fireRisk", "Risco de incendio"],
      ["explosionRisk", "Risco de explosao"],
      ["hotColdSurfaceRisk", "Risco por superficies quentes ou frias"],
      ["noiseVibrationControlled", "Ruido/vibracao avaliados e controlados"],
    ],
  },
  {
    title: "7. Sinalizacao, informacao e EPI",
    description: "Sinalizacao, avisos, formacao dos operadores e equipamentos de protecao.",
    items: [
      ["safetySignage", "Sinalizacao de seguranca aplicavel"],
      ["signageAndLabelsLegible", "Sinalizacao/rotulagem legivel"],
      ["warningDevices", "Dispositivos de aviso adequados"],
      ["operatorsInformed", "Operadores informados/formados"],
      ["ppeDefined", "EPI necessario definido e comunicado"],
    ],
  },
] as const;

const dl50Articles = [
  ["article3Notes", "Artigo 3.º"],
  ["article4Notes", "Artigo 4.º"],
  ["article6Notes", "Artigo 6.º"],
  ["article7Notes", "Artigo 7.º"],
  ["article8Notes", "Artigo 8.º"],
  ["article9Notes", "Artigo 9.º"],
  ["article10Notes", "Artigo 10.º"],
  ["article11Notes", "Artigo 11.º"],
  ["article12Notes", "Artigo 12.º"],
  ["article13Notes", "Artigo 13.º"],
  ["article14Notes", "Artigo 14.º"],
  ["article15Notes", "Artigo 15.º"],
  ["article16Notes", "Artigo 16.º"],
  ["article17Notes", "Artigo 17.º"],
  ["article18Notes", "Artigo 18.º"],
  ["article19Notes", "Artigo 19.º"],
  ["article20Notes", "Artigo 20.º"],
  ["article21Notes", "Artigo 21.º"],
  ["article22Notes", "Artigo 22.º"],
  ["article30Notes", "Artigo 30.º"],
  ["article31Notes", "Artigo 31.º"],
] as const;

const documentTypeLabels: Record<string, string> = {
  INVOICE: "Fatura",
  WARRANTY: "Garantia",
  MANUAL: "Manual",
  CERTIFICATE: "Certificado",
  CONTRACT: "Contrato",
  DL50_ASSESSMENT: "Avaliação DL 50/2005",
  OTHER: "Outro",
};

function Dl50AnswerSelect({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <select name={name} className={inputClass} defaultValue={defaultValue ?? ""}>
      <option value="">Por avaliar</option>
      <option value="YES">Sim</option>
      <option value="NO">Não</option>
      <option value="NA">Não aplicável</option>
    </select>
  );
}

function Dl50Fields({ source }: { source?: Record<string, unknown> | null }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dl50Questions.map(([name, label]) => (
          <label key={name} className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
            <span className="block min-h-10 text-sm font-medium leading-5 text-zinc-200">{label}</span>
            <span className="mt-3 block">
              <Dl50AnswerSelect name={name} defaultValue={typeof source?.[name] === "string" ? String(source?.[name]) : null} />
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {dl50Articles.map(([name, label]) => (
          <label key={name} className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">{label}</span>
            <textarea
              name={name}
              className="min-h-20 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-teal-300/60"
              defaultValue={typeof source?.[name] === "string" ? String(source?.[name]) : ""}
              placeholder={`Observações do ${label}`}
            />
          </label>
        ))}
      </div>
    </>
  );
}

void Dl50Fields;

function Dl50FieldsSectioned({ source }: { source?: Record<string, unknown> | null }) {
  return (
    <>
      <div className="space-y-4">
        {dl50QuestionSections.map((section) => (
          <section key={section.title} className="rounded-lg border border-zinc-800 bg-zinc-950/45 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-200">{section.title}</h4>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{section.description}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {section.items.map(([name, label]) => (
                <label key={name} className="rounded-lg border border-zinc-800 bg-black/25 p-3">
                  <span className="block min-h-10 text-sm font-medium leading-5 text-zinc-200">{label}</span>
                  <span className="mt-3 block">
                    <Dl50AnswerSelect name={name} defaultValue={typeof source?.[name] === "string" ? String(source?.[name]) : null} />
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/45 p-4">
        <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-200">Observacoes por artigo</h4>
        <p className="mt-1 text-xs leading-5 text-zinc-500">Regista evidencias, exclusoes, medidas ou justificacoes por artigo aplicavel do DL 50/2005.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {dl50Articles.map(([name, label]) => (
            <label key={name} className="space-y-2">
              <span className="text-sm font-medium text-zinc-300">{label}</span>
              <textarea
                name={name}
                className="min-h-20 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-teal-300/60"
                defaultValue={typeof source?.[name] === "string" ? String(source?.[name]) : ""}
                placeholder={`Observacoes do ${label}`}
              />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function dl50StatusLabel(status?: string | null) {
  if (status === "CONFORM") return "DL50 Conforme";
  if (status === "NEEDS_ACTION") return "DL50 Requer ações";
  if (status === "ARCHIVED") return "DL50 Arquivado";
  if (status === "DRAFT") return "DL50 Em rascunho";
  return "DL50 Não avaliado";
}

function dl50StatusClass(status?: string | null) {
  if (status === "CONFORM") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-200";
  if (status === "NEEDS_ACTION") return "border-amber-300/40 bg-amber-300/10 text-amber-200";
  if (status === "ARCHIVED") return "border-zinc-700 bg-zinc-900 text-zinc-400";
  return "border-sky-300/40 bg-sky-300/10 text-sky-200";
}

function equipmentCodePrefix(code?: string | null) {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) return "";
  const match = normalized.match(/^(.+?)[\s_-]*\d+$/);
  return match?.[1] ? match[1] : normalized;
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
  ["OPEN", "IN_PROGRESS", "PAUSED", "SUSPENDED", "DONE"].includes(ticket.status)
).length;

const activeWorkOrdersCount = equipment.workOrders.filter((workOrder) =>
  ["IN_PROGRESS", "PAUSED", "SUSPENDED"].includes(workOrder.status)
).length;
const latestDl50Assessment = equipment.dl50Assessments.find((assessment) => assessment.status !== "ARCHIVED");
const dl50Templates = equipment.equipmentType?.dl50Templates ?? [];
const currentCodePrefix = equipmentCodePrefix(equipment.code);
const bulkDl50Equipment = equipmentOptions
  .filter((item) => {
    const itemPrefix = equipmentCodePrefix(item.code);
    if (currentCodePrefix && itemPrefix) {
      return itemPrefix === currentCodePrefix;
    }
    return equipment.equipmentTypeId ? item.equipmentTypeId === equipment.equipmentTypeId : item.id === equipment.id;
  })
  .sort((a, b) => (a.code ?? a.name).localeCompare(b.code ?? b.name, "pt-PT", { numeric: true }));

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

<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

  <Panel>
    <p className="text-sm text-zinc-500">Avaliação DL50</p>
    <p className={`mt-3 inline-flex rounded-lg border px-3 py-2 text-sm font-semibold ${dl50StatusClass(latestDl50Assessment?.status)}`}>
      {dl50StatusLabel(latestDl50Assessment?.status)}
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
              ["Requisitos regulamentares", equipment.regulatoryRequirements ? "Sim" : "Não"],
              ["Se sim, quais", equipment.regulatoryDetails ?? "Sem requisitos definidos"],
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

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <ClipboardCheck size={22} className="text-teal-300" />
              <div>
                <h2 className="text-xl font-semibold text-zinc-50">Avaliação DL 50/2005</h2>
                <p className="mt-1 text-sm text-zinc-500">Questionário de conformidade, conclusão automática e evidência documental por versão.</p>
              </div>
            </div>
            <span className={`inline-flex rounded-lg border px-3 py-2 text-sm font-semibold ${dl50StatusClass(latestDl50Assessment?.status)}`}>
              {dl50StatusLabel(latestDl50Assessment?.status)}
            </span>
          </div>

          <details className="mt-5 rounded-lg border border-teal-300/25 bg-teal-300/5 p-4" open={equipment.dl50Assessments.length === 0}>
            <summary className="cursor-pointer text-sm font-semibold text-teal-200">
              Gerar Avaliação de Conformidade DL 50/2005
            </summary>
            <form action={createDl50Assessment} className="mt-4">
              <input type="hidden" name="equipmentId" value={equipment.id} />
              <Dl50FieldsSectioned />
              <div className="mt-4 flex flex-wrap gap-2">
                <button className={buttonClass}>Guardar avaliação v{(latestDl50Assessment?.version ?? 0) + 1}</button>
              </div>
            </form>
          </details>

          <div className="mt-5 space-y-3">
            {equipment.dl50Assessments.length === 0 ? (
              <EmptyState
                title="Sem avaliações DL50"
                description="Gera a primeira avaliação ou aplica um template do tipo de equipamento."
              />
            ) : (
              equipment.dl50Assessments.map((assessment) => (
                <details key={assessment.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">v{assessment.version} · {formatDate(assessment.createdAt)}</p>
                        <h3 className="mt-1 font-semibold text-zinc-100">{dl50StatusLabel(assessment.status)}</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{assessment.conclusion}</p>
                        <p className="mt-2 text-xs text-zinc-500">Criado por: {assessment.createdBy?.name ?? "Sem utilizador"}</p>
                      </div>
                      <span className={`inline-flex rounded-lg border px-3 py-2 text-xs font-semibold ${dl50StatusClass(assessment.status)}`}>
                        {assessment.status}
                      </span>
                    </div>
                  </summary>

                  <form action={updateDl50Assessment} className="mt-5 border-t border-zinc-800 pt-4">
                    <input type="hidden" name="id" value={assessment.id} />
                    <input type="hidden" name="equipmentId" value={equipment.id} />
                    <Dl50FieldsSectioned source={assessment} />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className={buttonClass}>Guardar alterações</button>
                    </div>
                  </form>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!assessment.documentId && (
                      <form action={attachDl50AssessmentToDocuments}>
                        <input type="hidden" name="id" value={assessment.id} />
                        <input type="hidden" name="equipmentId" value={equipment.id} />
                        <button className="inline-flex h-10 items-center justify-center rounded-lg border border-sky-300/40 bg-sky-300/10 px-3 text-sm font-semibold text-sky-200 transition hover:border-sky-200">
                          Criar documento
                        </button>
                      </form>
                    )}
                    <form action={archiveDl50Assessment}>
                      <input type="hidden" name="id" value={assessment.id} />
                      <input type="hidden" name="equipmentId" value={equipment.id} />
                      <button className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-300/40 bg-rose-300/10 px-3 text-sm font-semibold text-rose-200 transition hover:border-rose-200">
                        Arquivar avaliação
                      </button>
                    </form>
                  </div>
                </details>
              ))
            )}
          </div>
        </Panel>

        <Panel className="min-w-0">
          <div className="flex items-center gap-3">
            <Package size={22} className="text-amber-300" />
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Templates DL50</h2>
              <p className="mt-1 text-sm text-zinc-500">{equipment.equipmentType?.name ?? "Sem tipo de equipamento associado"}</p>
            </div>
          </div>

          {equipment.equipmentTypeId ? (
            <div className="mt-4 space-y-4">
              {dl50Templates.length > 0 && (
                <form action={applyDl50TemplateToEquipment} className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-4">
                  <input type="hidden" name="equipmentId" value={equipment.id} />
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-300">Aplicar template a este equipamento</span>
                    <select name="templateId" className={inputClass}>
                      {dl50Templates.map((template) => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </select>
                  </label>
                  <button className={`${buttonClass} mt-3`}>Aplicar template DL50</button>
                </form>
              )}

              <details className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-zinc-100">Criar novo template DL50</summary>
                <form action={createDl50AssessmentTemplate} className="mt-4">
                  <input type="hidden" name="equipmentTypeId" value={equipment.equipmentTypeId} />
                  <input name="name" className={inputClass} placeholder="Nome do template, ex.: Ar condicionado split" />
                  <textarea name="templateNotes" className={`${textareaClass} mt-3`} placeholder="Notas do template" />
                  <div className="mt-4">
                    <Dl50FieldsSectioned />
                  </div>
                  <button className={`${buttonClass} mt-4`}>Guardar template</button>
                </form>
              </details>

              {dl50Templates.map((template) => (
                <details key={template.id} className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-100">{template.name}</summary>
                  <form action={updateDl50AssessmentTemplate} className="mt-4">
                    <input type="hidden" name="id" value={template.id} />
                    <input type="hidden" name="equipmentId" value={equipment.id} />
                    <input name="name" className={inputClass} defaultValue={template.name} />
                    <select name="active" className={`${inputClass} mt-3`} defaultValue={template.active ? "true" : "false"}>
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                    <textarea name="templateNotes" className={`${textareaClass} mt-3`} defaultValue={template.notes ?? ""} placeholder="Notas do template" />
                    <div className="mt-4">
                      <Dl50FieldsSectioned source={template} />
                    </div>
                    <button className={`${buttonClass} mt-4`}>Atualizar template</button>
                  </form>

                  <form action={applyDl50TemplateToEquipments} className="mt-4 border-t border-zinc-800 pt-4">
                    <input type="hidden" name="templateId" value={template.id} />
                    <p className="text-sm font-semibold text-zinc-200">Aplicar em massa</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {currentCodePrefix
                        ? `Mostra equipamentos com código interno iniciado por ${currentCodePrefix}.`
                        : "Sem prefixo de código detetado; mostra equipamentos do mesmo tipo."}
                    </p>
                    <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
                      {bulkDl50Equipment.map((item) => (
                        <label key={item.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                          <input type="checkbox" name="equipmentId" value={item.id} defaultChecked={item.id === equipment.id} />
                          <span>{item.name}{item.code ? ` · ${item.code}` : ""}</span>
                        </label>
                      ))}
                    </div>
                    <button className={`${buttonClass} mt-3`}>Aplicar aos selecionados</button>
                  </form>
                </details>
              ))}

              {dl50Templates.length === 0 && (
                <EmptyState
                  title="Sem templates DL50"
                  description="Cria um template para este tipo e reutiliza-o nos equipamentos semelhantes."
                />
              )}
            </div>
          ) : (
            <EmptyState
              title="Sem tipo de equipamento"
              description="Associa primeiro um tipo ao equipamento para poderes criar templates DL50 reutilizáveis."
            />
          )}
        </Panel>
      </section>

      <Panel>
        <div className="flex items-center gap-3">
          <Receipt size={22} className="text-sky-300" />
          <div>
            <h2 className="text-xl font-semibold text-zinc-50">Documentos do equipamento</h2>
            <p className="mt-1 text-sm text-zinc-500">Evidências, certificados, faturas e avaliações associadas a este cadastro.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {equipment.documents.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title="Sem documentos associados" description="Ao gerar a avaliação DL50, a evidência aparece automaticamente aqui." />
            </div>
          ) : (
            equipment.documents.map((document) => (
              <article key={document.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-sky-300">
                  {documentTypeLabels[document.type] ?? document.type}
                </p>
                <h3 className="mt-2 font-semibold text-zinc-100">{document.title}</h3>
                <p className="mt-2 text-sm text-zinc-500">Criado em: {formatDate(document.createdAt)}</p>
                {document.fileUrl && (
                  <a href={document.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-sky-300">
                    Abrir documento
                  </a>
                )}
              </article>
            ))
          )}
        </div>
      </Panel>

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

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">Requisitos regulamentares?</span>
            <select name="regulatoryRequirements" className={inputClass} defaultValue={equipment.regulatoryRequirements ? "true" : "false"}>
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-zinc-300">Se sim, quais?</span>
            <textarea
              name="regulatoryDetails"
              className={textareaClass}
              defaultValue={equipment.regulatoryDetails ?? ""}
              placeholder="Ex.: diretiva, regulamento, requisito legal ou norma aplicável"
            />
          </label>

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
