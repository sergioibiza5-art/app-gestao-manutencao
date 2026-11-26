import Link from "next/link";
import { Factory, Plus, Save, Square, Play, Download, CheckCheck, RotateCcw, FlaskConical } from "lucide-react";
import { AppShell } from "@/app/components/app-shell";
import { inputClass, textareaClass, buttonClass } from "@/app/components/ui";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { productionBatchAccess } from "@/lib/production-data";
import { canManageProduction, canWriteProduction, elapsedMinutes, minutesLabel, productionOperations, productionStatuses, stopMinutes } from "@/lib/production";
import { formatLisbonDateTimeInput as dateInput } from "@/lib/lisbon-time";
import { ProductionForm, StopFields, ProductionRefresh } from "./forms";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm font-medium hover:border-teal-300";
const field = (name: string, children: ReactNode) => <label className="block min-w-0 space-y-1 text-sm text-zinc-300"><span>{name}</span>{children}</label>;
const dateLabel = (date: Date | null) => date ? new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" }).format(date) : "—";
const number = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 3 });

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ lote?: string; q?: string; estado?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const db = getPrisma();
  const manager = canManageProduction(user), writer = canWriteProduction(user.role) || manager;
  const equipment = await db.equipment.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
  const people = writer ? await db.user.findMany({ where: { active: true }, select: { id: true, name: true, username: true, role: true }, orderBy: { name: "asc" } }) : [];
  const operators = people.filter(p => p.role === "TICKET");
  const qualityPeople = people.filter(p => p.role === "SGQ");
  const batches = await db.productionBatch.findMany({ where: {
    ...(params.q ? { OR: [{ reference: { contains: params.q, mode: "insensitive" as const } }, { lot: { contains: params.q, mode: "insensitive" as const } }] } : {}),
    ...(params.estado && Object.hasOwn(productionStatuses, params.estado) ? { status: params.estado } : {}),
  }, select: { id: true, reference: true, lot: true, line: true, status: true, quantity: true, unit: true, equipment: { select: { code: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 101 });
  const selected = params.lote ? (await productionBatchAccess(params.lote)).batch : null;
  const running = selected && writer ? await db.productionActivity.findMany({ where: { endedAt: null }, select: { id: true, batchId: true, collaboratorId: true, operation: true, startedAt: true, batch: { select: { lot: true } } } }) : [];
  const participantIds = new Set([user.id, ...(selected?.activities.map(a => a.collaboratorId) || [])]);
  const participants = operators.filter(p => participantIds.has(p.id));
  const editable = writer && selected?.status === "OPEN";
  const unlocked = writer && selected && ["PLANNED", "OPEN"].includes(selected.status);
  const now = new Date(), nowInput = dateInput(now);
  const operatorMinutes = selected?.activities.reduce((sum, a) => sum + elapsedMinutes(a.startedAt, a.endedAt, now), 0) ?? 0;
  const cqMinutes = selected?.qualityCalls.reduce((sum, q) => sum + (q.arrivedAt ? elapsedMinutes(q.arrivedAt, q.endedAt, now) : 0), 0) ?? 0;
  const downtime = selected ? stopMinutes(selected.qualityCalls.flatMap(q => q.hasStop && q.stopStartedAt ? [{ start: q.stopStartedAt, end: q.stopEndedAt }] : []), now) : 0;
  const personOptions = operators.map(p => <option key={p.id} value={p.id}>{p.username ? `${p.username} · ` : ""}{p.name}</option>);
  const qualityOptions = qualityPeople.map(p => <option key={p.id} value={p.id}>{p.username ? `${p.username} · ` : ""}{p.name}</option>);
  function activityFields(activity?: NonNullable<typeof selected>["activities"][number]) {
    return <>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("Operação", <select name="operation" defaultValue={activity?.operation || "PCAM"} className={inputClass}>{Object.entries(productionOperations).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select>)}
        {activity ? field("Colaborador", <input value={activity.collaborator.name} readOnly className={inputClass} />) : <fieldset className="sm:row-span-2"><legend className="mb-1 text-sm text-zinc-300">Colaboradores</legend><div className="grid max-h-48 gap-1 overflow-auto rounded-lg border border-zinc-800 p-2">{operators.map(p => <label key={p.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="collaboratorId" value={p.id} className="size-5 shrink-0 accent-teal-300" />{p.username ? `${p.username} · ` : ""}{p.name}</label>)}</div></fieldset>}
        {field("Início", <input type="datetime-local" name="startedAt" required defaultValue={activity ? dateInput(activity.startedAt) : nowInput} className={inputClass} />)}
        {field("Fim", <input type="datetime-local" name="endedAt" defaultValue={dateInput(activity?.endedAt)} className={inputClass} />)}
      </div>
      {field("Observações", <textarea name="notes" defaultValue={activity?.notes} className={textareaClass} />)}
      {activity && <><input type="hidden" name="rowId" value={activity.id} />{field("Motivo da correção", <input name="reason" required className={inputClass} />)}</>}
      <button className={buttonClass}><Save size={17} />{activity ? "Guardar correção" : "Registar atividade"}</button>
    </>;
  }
  function qualityFields(q?: NonNullable<typeof selected>["qualityCalls"][number]) {
    return <>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("Chamada do técnico", <input type="datetime-local" name="calledAt" required defaultValue={q ? dateInput(q.calledAt) : nowInput} className={inputClass} />)}
        {field("Técnico de qualidade", <select name="technicianId" defaultValue={q?.technicianId ?? ""} className={inputClass}><option value="">Por atribuir</option>{qualityOptions}</select>)}
        {field("Chegada / início do CQ", <input type="datetime-local" name="arrivedAt" defaultValue={dateInput(q?.arrivedAt)} className={inputClass} />)}
        {field("Fim do CQ", <input type="datetime-local" name="endedAt" defaultValue={dateInput(q?.endedAt)} className={inputClass} />)}
      </div>
      <StopFields hasStop={q?.hasStop} start={dateInput(q?.stopStartedAt)} end={dateInput(q?.stopEndedAt)} />
      {field("Observações", <textarea name="notes" defaultValue={q?.notes} className={textareaClass} />)}
      {q && <input type="hidden" name="rowId" value={q.id} />}
      {q && field("Motivo da correção", <input name="reason" required className={inputClass} />)}
      <button className={buttonClass}><Save size={17} />{q ? "Guardar CQ" : "Registar chamada de CQ"}</button>
    </>;
  }
  return <AppShell activeHref="/producao">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
      <h1 className="flex items-center gap-3 text-2xl font-semibold"><Factory className="text-teal-300" />Produção</h1>
      {writer && <details key={selected?.id || "new-lot"} className="relative"><summary className={`${buttonClass} cursor-pointer list-none`}><Plus size={18} />Novo lote</summary><div className="absolute right-0 z-20 mt-2 w-[min(92vw,520px)] rounded-lg border border-zinc-700 bg-zinc-950 p-4 shadow-xl"><ProductionForm command="create">
        <div className="grid gap-3 sm:grid-cols-2">{field("Referência", <input name="reference" required maxLength={180} className={inputClass} />)}{field("Lote", <input name="lot" required maxLength={180} className={inputClass} />)}{field("Sala / linha", <input name="line" required defaultValue="SL1" maxLength={180} className={inputClass} />)}{field("Equipamento", <select name="equipmentId" required className={inputClass}><option value="">Selecionar</option>{equipment.map(e => <option key={e.id} value={e.id}>{e.code ? `${e.code} · ` : ""}{e.name}</option>)}</select>)}</div>
        <button className={buttonClass}><Plus size={17} />Criar lote</button>
      </ProductionForm></div></details>}
    </header>
    <form className="flex flex-wrap gap-2" action="/producao">
      <input name="q" aria-label="Pesquisar referência ou lote" placeholder="Referência ou lote" defaultValue={params.q} className={`${inputClass} sm:max-w-xs`} />
      <select name="estado" aria-label="Estado" defaultValue={params.estado || ""} className={`${inputClass} sm:max-w-48`}><option value="">Todos os estados</option>{Object.entries(productionStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className={secondary}>Filtrar</button>
    </form>
    {!selected ? <>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-zinc-400"><tr>{["Referência / lote", "Linha", "Equipamento", "Produzido", "Estado", ""].map((x, i) => <th key={i} className="p-3">{x}</th>)}</tr></thead><tbody>{batches.slice(0, 100).map(b => <tr key={b.id} className="border-t border-zinc-800"><td className="p-3 font-semibold">{b.reference}<span className="block font-normal text-zinc-400">{b.lot}</span></td><td className="p-3">{b.line}</td><td className="p-3">{b.equipment.code || b.equipment.name}</td><td className="p-3">{b.quantity.toString()} {b.unit}</td><td className="p-3">{productionStatuses[b.status as keyof typeof productionStatuses]}</td><td className="p-3"><Link href={`/producao?lote=${b.id}`} className={secondary}>Abrir lote</Link></td></tr>)}</tbody></table></div>
      {!batches.length && <p className="py-8 text-center text-zinc-400">Sem lotes registados.</p>}{batches.length > 100 && <p className="text-sm text-amber-200">Apresentados os 100 lotes mais recentes. Refina a pesquisa.</p>}
    </> : <>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><Link href="/producao" className="text-sm text-teal-300">← Lotes</Link><h2 className="mt-2 break-words text-xl font-semibold">{selected.reference} · {selected.lot}</h2><p className="mt-1 text-sm text-zinc-400">{selected.line} · {selected.equipment.code} · {selected.equipment.name} · {productionStatuses[selected.status as keyof typeof productionStatuses]}</p></div><div className="flex flex-wrap gap-2"><ProductionRefresh live={selected.status === "OPEN"} /><a href={`/api/producao/${selected.id}/export?format=xlsx`} className={secondary}><Download size={16} />Excel</a><a href={`/api/producao/${selected.id}/export?format=pdf`} target="_blank" className={secondary}><Download size={16} />PDF</a></div></div>
      <dl className="grid grid-cols-2 gap-4 border-y border-zinc-800 py-4 lg:grid-cols-4">{[["Quantidade produzida", `${selected.quantity} ${selected.unit}`], ["Mão de obra · operadores", minutesLabel(operatorMinutes)], ["Controlo de qualidade", minutesLabel(cqMinutes)], ["Paragem de produção", minutesLabel(downtime)]].map(([label, value]) => <div key={label}><dt className="text-sm text-zinc-400">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd></div>)}</dl>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <p className="text-sm font-semibold">Estado do lote: <span className="text-teal-200">{productionStatuses[selected.status as keyof typeof productionStatuses]}</span></p>
        {writer && selected.status === "PLANNED" && <ProductionForm command="batch-start" batchId={selected.id}><button className={buttonClass}><Play size={17} />Iniciar lote</button></ProductionForm>}
        {writer && selected.status === "OPEN" && <ProductionForm command="batch-end" batchId={selected.id}><button className={secondary}><Square size={17} />Terminar lote</button></ProductionForm>}
      </div>
      {unlocked && <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Quantidade e observações do lote</summary><ProductionForm command="batch" batchId={selected.id} className="max-w-3xl py-3"><div className="grid gap-3 sm:grid-cols-2">{field("Quantidade produzida", <input name="quantity" type="number" min="0" step="0.001" required defaultValue={selected.quantity.toString()} className={inputClass} />)}{field("Unidade", <input name="unit" required defaultValue={selected.unit} className={inputClass} />)}</div>{field("Observações do lote", <textarea name="notes" defaultValue={selected.notes} className={textareaClass} />)}<button className={buttonClass}><Save size={17} />Guardar lote</button></ProductionForm></details>}
      {selected.notes && <p className="whitespace-pre-wrap text-sm text-zinc-300">{selected.notes}</p>}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Colaboradores no lote</h2>
        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
          {participants.map(person => {
            const active = running.find(a => a.collaboratorId === person.id);
            const onThisLot = active?.batchId === selected.id;
            const controllable = editable && (manager || person.id === user.id);
            return <div key={person.id} data-testid={`production-person-${person.id}`} className="grid min-w-0 gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)] sm:items-center">
              <div className="min-w-0"><p className="break-words font-semibold">{person.name}{person.id === user.id ? " · Eu" : ""}</p><p className="mt-1 text-sm text-zinc-400">{person.username}{active ? ` · ${active.operation} · ${dateLabel(active.startedAt)}` : " · Sem atividade em curso"}</p>{active && !onThisLot && <Link href={`/producao?lote=${active.batchId}`} className="text-sm text-amber-200">Em trabalho no lote {active.batch.lot}</Link>}</div>
              {controllable ? active ? onThisLot ? <ProductionForm command="finish" batchId={selected.id}><input name="rowId" type="hidden" value={active.id} /><button className={`${secondary} w-full border-rose-300/40 text-rose-200`}><Square size={17} />Terminar</button></ProductionForm> : <span className="text-sm text-amber-200">Atividade noutro lote</span> : <ProductionForm command="start" batchId={selected.id}><input name="collaboratorId" type="hidden" value={person.id} /><div className="flex flex-wrap gap-2"><select name="operation" aria-label={`Operação de ${person.name}`} className={`${inputClass} min-w-0 flex-1`}>{Object.entries(productionOperations).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select><button className={buttonClass}><Play size={17} />Iniciar</button></div></ProductionForm> : <span className={`text-sm ${onThisLot ? "text-teal-200" : "text-zinc-400"}`}>{onThisLot ? "Em curso" : "Sem atividade neste lote"}</span>}
            </div>;
          })}
        </div>
        {editable && manager && <details><summary className="min-h-11 cursor-pointer py-2 font-semibold text-teal-200">Iniciar outro colaborador</summary><ProductionForm command="start" batchId={selected.id} className="max-w-3xl py-3"><div className="grid gap-3 sm:grid-cols-2">{field("Colaborador", <select name="collaboratorId" required defaultValue="" className={inputClass}><option value="">Selecionar</option>{personOptions}</select>)}{field("Operação", <select name="operation" className={inputClass}>{Object.entries(productionOperations).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select>)}</div><button className={buttonClass}><Play size={17} />Iniciar</button></ProductionForm></details>}
        <h2 className="pt-3 text-lg font-semibold">Registo de atividades</h2>
        {editable && manager && <details className="border-y border-zinc-800 py-2"><summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-teal-200"><Plus size={17} />Registar atividade manual</summary><ProductionForm command="activity" batchId={selected.id} className="max-w-4xl py-3">{activityFields()}</ProductionForm></details>}
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="text-xs uppercase text-zinc-400"><tr>{["Colaborador", "Operação", "Início", "Fim", "Tempo", "Observações", ""].map((s, i) => <th key={i} className="p-2">{s}</th>)}</tr></thead><tbody>{selected.activities.map(a => <tr key={a.id} className="border-t border-zinc-800 align-top"><td className="p-2">{a.collaborator.name}<small className="block text-zinc-400">{a.collaborator.username}</small></td><td className="p-2">{a.operation}</td><td className="p-2">{dateLabel(a.startedAt)}</td><td className="p-2">{a.endedAt ? dateLabel(a.endedAt) : <span className="text-amber-200">Em curso</span>}</td><td className="p-2 whitespace-nowrap">{minutesLabel(elapsedMinutes(a.startedAt, a.endedAt, now))}<small className="block text-zinc-400">{number(elapsedMinutes(a.startedAt, a.endedAt, now) / 60)} h</small></td><td className="max-w-xs whitespace-pre-wrap break-words p-2">{a.notes}</td><td className="p-2">{editable && manager && <details><summary className="cursor-pointer py-2 text-teal-200">Corrigir</summary><ProductionForm command="activity" batchId={selected.id} className="min-w-[300px] py-2">{activityFields(a)}</ProductionForm></details>}</td></tr>)}</tbody></table></div>
        {!selected.activities.length && <p className="py-3 text-sm text-zinc-400">Sem atividades.</p>}
      </section>
      <section className="space-y-3 border-t border-zinc-800 pt-4"><h2 className="flex items-center gap-2 text-lg font-semibold"><FlaskConical size={19} className="text-sky-300" />Controlo de qualidade</h2>
        {editable && <details><summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-teal-200"><Plus size={17} />Nova chamada de CQ</summary><ProductionForm command="call-quality" batchId={selected.id} className="max-w-3xl py-3">
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" name="hasStop" className="size-5 accent-teal-300" />Houve paragem de produção?</label>
          {field("Observações", <textarea name="notes" className={textareaClass} />)}
          <button className={buttonClass}><FlaskConical size={17} />Chamar CQ</button>
        </ProductionForm></details>}
        {editable && manager && <details><summary className="min-h-11 cursor-pointer py-2 text-teal-200">Registo manual de CQ</summary><ProductionForm command="quality" batchId={selected.id} className="max-w-3xl py-3">{qualityFields()}</ProductionForm></details>}
        {selected.qualityCalls.map(q => <article key={q.id} className="rounded-lg border border-zinc-800 p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Chamada", dateLabel(q.calledAt)], ["Chegada", dateLabel(q.arrivedAt)], ["Fim do CQ", dateLabel(q.endedAt)], ["Técnico", q.technician?.name || "Por atribuir"], [q.arrivedAt ? "Espera" : "À espera", minutesLabel(elapsedMinutes(q.calledAt, q.arrivedAt, now))], ["Tempo de controlo", q.arrivedAt ? minutesLabel(elapsedMinutes(q.arrivedAt, q.endedAt, now)) : "—"], ["Paragem", q.hasStop && q.stopStartedAt ? `${dateLabel(q.stopStartedAt)} → ${dateLabel(q.stopEndedAt)} · ${minutesLabel(elapsedMinutes(q.stopStartedAt, q.stopEndedAt, now))}` : "Não"]].map(([k, v]) => <div key={k}><p className="text-xs text-zinc-400">{k}</p><p className="mt-1 break-words text-sm">{v}</p></div>)}</div>
          {q.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{q.notes}</p>}
          {editable && <div className="mt-3 flex flex-wrap gap-2">
            {!q.arrivedAt && (manager || user.role === "SGQ") && <ProductionForm command="cq-arrive" batchId={selected.id}><input name="rowId" type="hidden" value={q.id} />{manager && field("Técnico SGQ", <select name="technicianId" required defaultValue={user.role === "SGQ" ? user.id : ""} className={inputClass}><option value="">Selecionar</option>{qualityOptions}</select>)}<button className={buttonClass}><Play size={17} />Iniciar CQ</button></ProductionForm>}
            {q.arrivedAt && !q.endedAt && (manager || q.technicianId === user.id) && <ProductionForm command="cq-end" batchId={selected.id}><input name="rowId" type="hidden" value={q.id} /><button className={secondary}><Square size={17} />Terminar CQ</button></ProductionForm>}
            {!q.hasStop && !q.endedAt && <ProductionForm command="stop-start" batchId={selected.id}><input name="rowId" type="hidden" value={q.id} /><button className={secondary}>Iniciar paragem</button></ProductionForm>}
            {q.hasStop && !q.stopEndedAt && <ProductionForm command="stop-end" batchId={selected.id}><input name="rowId" type="hidden" value={q.id} /><button className={secondary}>Terminar paragem</button></ProductionForm>}
          </div>}
          {editable && manager && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-teal-200">Corrigir horários de CQ</summary><ProductionForm command="quality" batchId={selected.id} className="max-w-3xl py-3">{qualityFields(q)}</ProductionForm></details>}
        </article>)}
        {!selected.qualityCalls.length && <p className="py-3 text-sm text-zinc-400">Sem chamadas de controlo de qualidade.</p>}
      </section>
      {manager && ["DONE", "VERIFIED"].includes(selected.status) && <section className="space-y-3 border-t border-zinc-800 pt-4">
        {selected.status === "DONE" && <ProductionForm command="verify" batchId={selected.id}><input type="hidden" name="quantity" value={selected.quantity.toString()} /><input type="hidden" name="unit" value={selected.unit} /><input type="hidden" name="notes" value={selected.notes} /><button className={buttonClass}><CheckCheck size={18} />Conferir lote</button></ProductionForm>}
        <ProductionForm command="reopen" batchId={selected.id} className="max-w-xl">{field("Motivo da reabertura", <input name="reason" required className={inputClass} />)}<button className={secondary}><RotateCcw size={17} />Reabrir lote</button></ProductionForm>
      </section>}
      <details className="border-t border-zinc-800 pt-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Histórico de registos e alterações</summary><ol className="divide-y divide-zinc-800">{selected.audits.map(a => <li key={a.id} className="py-3 text-sm"><span className="text-zinc-400">{dateLabel(a.createdAt)}</span> · {a.actorName} · {a.action}{a.reason && <p className="mt-1 text-zinc-300">{a.reason}</p>}</li>)}</ol></details>
    </>}
  </AppShell>;
}
