import Link from "next/link";
import type { Prisma, WorkOrderStatus } from "@prisma/client";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass, PageHeader, Panel } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { getPrisma } from "@/lib/prisma";
import { workOrderScope, workOrderStatuses } from "@/lib/work-order-search";

export default async function Orders({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; pagina?: string }> }) {
  const scope = await workOrderScope();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = Object.hasOwn(workOrderStatuses, params.estado ?? "") ? params.estado as WorkOrderStatus : undefined;
  const contains = { contains: q, mode: "insensitive" as const };
  const where: Prisma.WorkOrderWhereInput = { AND: [scope, { status }, ...(q ? [{ OR: [
    { number: contains }, { title: contains }, { equipment: { name: contains } },
    { equipment: { code: contains } }, { ticket: { number: contains } },
  ] }] : [])] };
  const db = getPrisma();
  const total = await db.workOrder.count({ where });
  const pages = Math.max(1, Math.ceil(total / 30));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(params.pagina)) || 1));
  const list = await db.workOrder.findMany({ where, orderBy: [{ openedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 30, take: 30, select: { id: true, number: true, title: true, status: true, openedAt: true, equipment: { select: { name: true } } } });
  function href(p: number) {
    return "/manutencao/ops?" + new URLSearchParams({ q, estado: status ?? "", pagina: String(p) });
  }

  return <AppShell activeHref="/manutencao">
    <PageHeader eyebrow="Manutenção" title="Pesquisar OPs" description="Consulta ordens de qualquer data, incluindo as encerradas." />
    <Panel>
      <form className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label className="grid gap-1">Pesquisar<input className={inputClass} name="q" defaultValue={q} placeholder="Número da OP, intervenção, equipamento ou ticket" /></label>
        <label className="grid gap-1">Estado<select className={inputClass} name="estado" defaultValue={status ?? ""}><option value="">Todos os estados</option>
          {Object.entries(workOrderStatuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <button className={buttonClass}>Pesquisar</button>
      </form>
      <p className="my-4 text-sm text-zinc-400">{total === 1 ? "1 ordem encontrada" : `${total} ordens encontradas`}</p>
      <ul className="divide-y divide-zinc-800">{list.map(op => <li key={op.id}>
        <Link className="block rounded p-3 hover:bg-zinc-900" href={`/manutencao/ops/${op.id}?${new URLSearchParams({ q, estado: status ?? "", pagina: String(page) })}`}>
          <strong className="text-teal-300">{op.number}</strong> · {op.title}
          <div className="mt-1 text-sm text-zinc-400">{op.equipment.name} · {formatDate(op.openedAt)} · {workOrderStatuses[op.status]}</div>
        </Link></li>)}</ul>
      {total === 0 && <Link className="text-teal-300 underline" href="/manutencao/ops">Limpar pesquisa</Link>}
      {pages > 1 && <nav aria-label="Páginas de OPs" className="mt-4 flex items-center gap-4">
        {page > 1 && <Link href={href(page - 1)} className="text-teal-300">Anterior</Link>} Página {page} de {pages}
        {page < pages && <Link href={href(page + 1)} className="text-teal-300">Seguinte</Link>}
      </nav>}
    </Panel>
  </AppShell>;
}
