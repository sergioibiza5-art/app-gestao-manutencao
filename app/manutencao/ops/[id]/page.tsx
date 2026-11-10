import { WorkOrderEditor } from "../work-order-editor";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, PageHeader, Panel } from "@/app/components/ui";
import { getPrisma } from "@/lib/prisma";
import { workOrderScope, workOrderStatuses } from "@/lib/work-order-search";

const dateTime = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Lisbon" });

export default async function Order({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; estado?: string; pagina?: string }> }) {
  const user = await requireUser();
  const scope = await workOrderScope();
  const { id } = await params;
  const { q = "", estado = "", pagina = "1" } = await searchParams;
  const op = await getPrisma().workOrder.findFirst({ where: { AND: [scope, { id }] }, include: {
    equipment: { select: { name: true, code: true } }, ticket: { select: { id: true, number: true } },
    schedule: { select: { assignedTo: { select: { name: true } } } },
    maintenanceLog: { select: { description: true, supplier: true } },
  } });
  if (!op) notFound();
  const fields = [
    ["Estado", workOrderStatuses[op.status]], ["Tipo", op.type === "INTERNAL" ? "Interna" : "Externa"],
    ["Abertura", dateTime.format(op.openedAt)], ["Início", op.startedAt && dateTime.format(op.startedAt)],
    ["Conclusão", op.closedAt && dateTime.format(op.closedAt)], ["Validação", op.validatedAt && dateTime.format(op.validatedAt)],
    ["Executado por", op.performedBy], ["Atribuída a", op.schedule?.assignedTo?.name], ["Fornecedor", op.maintenanceLog?.supplier],
    ["Trabalho executado", op.actionsDone || op.maintenanceLog?.description], ["Resultado", op.result], ["Notas", op.notes],
  ];
  return <AppShell activeHref="/manutencao">
    <PageHeader eyebrow={op.number} title={op.title} description={[op.equipment.code,op.equipment.name].filter(Boolean).join(" · ")}
      action={<Link className={buttonClass} href={"/manutencao/ops?" + new URLSearchParams({ q, estado, pagina })}>Voltar à pesquisa</Link>} />
    {["ADMIN", "MANAGER"].includes(user.role) && <WorkOrderEditor order={{
      id: op.id, version: op.updatedAt.toISOString(), title: op.title, type: op.type,
      performedBy: op.performedBy, actionsDone: op.actionsDone || op.maintenanceLog?.description || null,
      result: op.result, notes: op.notes, supplier: op.maintenanceLog?.supplier,
    }} />}
    <Panel><dl className="grid gap-4 sm:grid-cols-2">{fields.filter(([,value]) => value).map(([label,value]) =>
      <div key={label}><dt className="text-sm text-zinc-400">{label}</dt><dd className="whitespace-pre-wrap">{value}</dd></div>)}</dl>
      <div className="mt-5 flex flex-wrap gap-3">
        {op.scheduleId && <Link className={buttonClass} href={`/manutencao/${op.scheduleId}`}>Abrir agendamento</Link>}
        {op.ticket && <Link className={buttonClass} href={`/tickets?ticketId=${op.ticket.id}#ticket-${op.ticket.id}`}>Abrir {op.ticket.number}</Link>}
      </div>
    </Panel>
  </AppShell>;
}
