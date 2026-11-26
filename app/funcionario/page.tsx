import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUpRight, ClipboardCheck, Factory, Filter, Siren, Users } from "lucide-react";
import { AppShell } from "@/app/components/app-shell";
import { inputClass, buttonClass } from "@/app/components/ui";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { employeeDayWindow, shiftDay } from "@/lib/employee-day";
import { getEmployeeDay, type DayEvent } from "@/lib/employee-day-data";
import { dailyMaintenanceUnits, dailyPath, lisbonDay } from "@/lib/daily-maintenance";
import { isCleaning, maintenancePlan } from "@/lib/mcc-maintenance-plan";
import { canWriteProduction, minutesLabel } from "@/lib/production";
import { DayRefresh } from "./refresh";
import { EmployeeWorkControl } from "./work-control";
import { getEmployeeRoutines } from "@/lib/employee-routines";
import { RoutineTasks } from "./routine-tasks";

export const dynamic = "force-dynamic";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm font-medium hover:border-teal-300";
const stamp = (date: Date) => new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
const status: Record<string, string> = { OPEN: "Por iniciar", IN_PROGRESS: "Em curso", PAUSED: "Pausada", SUSPENDED: "Suspensa" };

export default async function EmployeeDayPage({ searchParams }: { searchParams: Promise<{ dia?: string; pessoa?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date(), today = lisbonDay(now), day = params.dia || today;
  try { employeeDayWindow(day); } catch { notFound(); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today || day < "2000-01-01") notFound();
  const personId = params.pessoa || user.id;
  const data = await getEmployeeDay(user, personId, day, now);
  const people = user.productionCoordinator ? await getPrisma().user.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }) : [];
  const canRoutines = ["ADMIN", "MANAGER", "USER", "TICKET"].includes(user.role) || user.cleaningVerifier;
  const units = canRoutines ? await dailyMaintenanceUnits(user) : [];
  const routines = units.map(equipment => ({ equipment, groups: maintenancePlan(equipment.code) }));
  const mainRoutines = routines.filter(({ equipment, groups }) => {
    const parent = routines.find(r => r.equipment.id === equipment.parentEquipmentId);
    const preventive = groups.find(g => !isCleaning(g.key));
    return groups.some(g => isCleaning(g.key)) || !parent || parent.groups.find(g => !isCleaning(g.key))?.documentCode !== preventive?.documentCode;
  });
  const url = (date: string) => `/funcionario?${new URLSearchParams({ dia: date, ...(personId !== user.id ? { pessoa: personId } : {}) })}`;
  const self = personId === user.id, live = day === today;
  const canControl = self && (canWriteProduction(user.role) || user.productionCoordinator);
  const routineTasks = live ? await getEmployeeRoutines(data.person, today) : [];
  const forgotten = live ? data.current.filter(event => event.at < employeeDayWindow(today).start) : [];
  function eventRow(event: DayEvent, active = false) {
    return <li key={event.id} className={`grid min-w-0 gap-3 border-b border-zinc-800 py-4 last:border-0 sm:grid-cols-[140px_minmax(0,1fr)_auto] ${active ? "border-l-2 border-l-teal-300 pl-3" : ""}`}>
      <div className="text-sm tabular-nums text-zinc-300"><p>{stamp(event.at)}</p>{event.end && <p className="mt-1 text-zinc-500">até {stamp(event.end)}</p>}{event.open && <p className="mt-1 text-amber-200">{event.at < employeeDayWindow(today).start ? "Aberta desde outro dia" : "Em curso"}</p>}</div>
      <div className="min-w-0"><p className="text-xs text-zinc-400">{event.kind}</p><h3 className="mt-1 break-words font-semibold">{event.title}</h3><p className="mt-1 break-words text-sm text-zinc-400">{event.detail}</p>{event.href && <Link href={event.href} className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-teal-200">Abrir <ArrowUpRight size={16} /></Link>}</div>
      <div className="min-w-0 space-y-3 sm:text-right"><p className="whitespace-nowrap text-sm font-semibold tabular-nums text-zinc-200">{event.minutes !== undefined ? minutesLabel(event.minutes) : "Sem duração"}</p>{active && event.work && <p className="text-xs text-zinc-400">{event.work.batchStatus === "OPEN" ? "Lote em curso" : "Lote fechado"} · {event.kind === "Produção" ? "Atividade individual em curso" : "Controlo individual"}</p>}{active && live && canControl && event.work?.batchStatus === "OPEN" && <EmployeeWorkControl id={event.work.id} command={event.work.command} />}</div>
    </li>;
  }
  const shortcuts = <section className="border-t border-zinc-800 pt-4"><h2 className="mb-3 text-lg font-semibold">Acessos rápidos</h2><div className="flex flex-wrap gap-2"><Link className={secondary} href="/producao"><Factory size={17} />Produção</Link>{!["SGQ", "HSA"].includes(user.role) && <Link className={secondary} href="/tickets"><Siren size={17} />Tickets</Link>}</div>
    {!!mainRoutines.length && <details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 font-medium">Manutenções e limpezas dos equipamentos</summary><ul className="divide-y divide-zinc-800">{mainRoutines.map(({ equipment, groups }) => <li key={equipment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><p className="min-w-0 break-words text-sm">{equipment.name} <span className="text-zinc-500">· {equipment.code}</span></p><div className="flex flex-wrap gap-2">{[groups.find(g => !isCleaning(g.key)), groups.find(g => isCleaning(g.key))].filter(g => !!g).map(g => <Link key={g.key} className={secondary} href={`${dailyPath(equipment.id)}?grupo=${g.key}`}><ClipboardCheck size={16} />{isCleaning(g.key) ? "Limpezas" : "Plano preventivo"}</Link>)}</div></li>)}</ul></details>}
  </section>;
  return <AppShell activeHref="/funcionario">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-4">
      <div><h1 className="text-2xl font-semibold">{self ? "O meu dia" : "Dia do colaborador"}</h1><p className="mt-1 text-zinc-300">{data.person.name}{!data.person.active && " · Inativo"}</p><p className="mt-1 text-sm text-zinc-500">{new Intl.DateTimeFormat("pt-PT", { dateStyle: "full", timeZone: "Europe/Lisbon" }).format(employeeDayWindow(day).start)}</p></div>
      <div className="flex flex-wrap items-center gap-2">{user.productionCoordinator && <Link href={`/funcionario/equipa?dia=${day}`} className={secondary}><Users size={17} />O dia da equipa</Link>}<DayRefresh live={live} /></div>
    </header>
    <form className="flex flex-wrap items-end gap-2" action="/funcionario">
      <Link href={url(shiftDay(day, -1))} title="Dia anterior" aria-label="Dia anterior" className={secondary}><ArrowLeft size={18} /></Link>
      <label className="min-w-0 text-sm text-zinc-400"><span className="mb-1 block">Dia</span><input type="date" name="dia" required max={today} min="2000-01-01" defaultValue={day} className={inputClass} /></label>
      {people.length > 0 && <label className="min-w-0 flex-1 text-sm text-zinc-400 sm:max-w-xs"><span className="mb-1 block">Colaborador</span><select name="pessoa" defaultValue={personId} className={inputClass}>{people.map(p => <option key={p.id} value={p.id}>{p.name}{!p.active ? " · Inativo" : ""}</option>)}</select></label>}
      <button className={buttonClass}><Filter size={16} />Consultar</button>
      {!live && <Link href={url(shiftDay(day, 1))} title="Dia seguinte" aria-label="Dia seguinte" className={secondary}><ArrowRight size={18} /></Link>}
      {!live && <Link href={url(today)} className={secondary}>Hoje</Link>}
    </form>
    {shortcuts}
    {forgotten.length > 0 && <aside role="alert" className="border-l-2 border-amber-200 bg-amber-200/5 p-4"><h2 className="flex items-center gap-2 font-semibold text-amber-100"><AlertTriangle size={19} />{forgotten.length} {forgotten.length === 1 ? "atividade aberta desde outro dia" : "atividades abertas desde outros dias"}</h2><p className="mt-2 text-sm text-amber-100">Se ficou aberta por engano, pede à coordenação para corrigir o horário. Nenhum registo foi fechado automaticamente.</p><ul className="mt-2 space-y-1 text-sm text-zinc-300">{forgotten.map(event => <li key={event.id}>{event.detail} · Desde {stamp(event.at)}</li>)}</ul></aside>}
    <section aria-label="Resumo de tempos" className="grid grid-cols-2 gap-4 border-y border-zinc-800 py-5 lg:grid-cols-4">
      {[ ["Tempo registado no dia", data.totals.total, "text-teal-200"], ["Períodos terminados", data.totals.closed, "text-zinc-100"], ["Produção", data.totals.production, "text-sky-200"], ["Controlo de qualidade", data.totals.quality, "text-amber-200"] ].map(([label, value, tone]) => <div key={String(label)} className="min-w-0"><p className="text-sm text-zinc-400">{label}</p><p data-testid={label === "Tempo registado no dia" ? "day-total" : undefined} className={`mt-2 break-words text-xl font-semibold tabular-nums ${tone}`}>{minutesLabel(Number(value))}</p></div>)}
    </section>
    {data.totals.provisional > 0 && <p className="text-sm text-amber-200">Inclui {minutesLabel(data.totals.provisional)} em atividades ainda abertas. Tempo provisório.</p>}
    {data.totals.overlap && <p role="status" className="text-sm text-amber-200">Existem horários sobrepostos. O total do dia conta cada minuto uma só vez.</p>}
    {live && <section aria-labelledby="current-heading"><h2 id="current-heading" className="text-lg font-semibold">{self ? "O que tenho em curso" : "Em curso agora"} <span className="text-sm text-zinc-400">({data.current.length})</span></h2><ul>{data.current.map(e => eventRow(e, true))}</ul>{!data.current.length && <p className="py-4 text-sm text-zinc-400">Sem atividades de produção ou CQ em curso.</p>}</section>}
    {live && <RoutineTasks units={routineTasks} accessibleIds={units.map(unit => unit.id)} />}
    <section aria-labelledby="diary-heading" className="border-t border-zinc-800 pt-4"><h2 id="diary-heading" className="text-lg font-semibold">Diário do dia <span className="text-sm text-zinc-400">({data.events.length})</span></h2><ul>{data.events.map(e => eventRow(e))}</ul>{!data.events.length && <p className="py-6 text-sm text-zinc-400">Sem registos neste dia.</p>}</section>
    {live && <section aria-labelledby="pending-heading" className="border-t border-zinc-800 pt-4">
      <h2 id="pending-heading" className="text-lg font-semibold">Por terminar agora <span className="text-sm text-zinc-400">({data.pending.length})</span></h2>
      <ul className="divide-y divide-zinc-800">{data.pending.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0"><h3 className="break-words font-medium">{p.title}</h3><p className="mt-1 text-sm text-zinc-400">{p.detail} · {p.statusLabel || status[p.status] || p.status}</p>{p.personalStatus && <p className="mt-2 text-sm text-teal-200">{self ? p.personalStatus : p.resumeId ? "A atividade do colaborador terminou. O lote continua aberto." : "Sem atividade deste colaborador em curso no lote."}</p>}{p.minutes !== undefined && <p className="mt-1 text-xs text-zinc-500">Tempo acumulado da intervenção: {minutesLabel(p.minutes)}</p>}</div>
        <div className="flex flex-wrap items-start gap-2">{self && live && p.resumeId && <EmployeeWorkControl id={p.resumeId} command="resume" />}{p.href && <Link className={secondary} href={p.href}>{p.personalStatus ? "Abrir lote" : "Abrir"} <ArrowUpRight size={16} /></Link>}</div>
      </li>)}</ul>
      {!data.pending.length && <p className="py-4 text-sm text-zinc-400">Sem lotes, pedidos ou intervenções por terminar.</p>}
    </section>}
    <footer className="border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-500">Hora de Lisboa. O total diário considera os períodos individuais de produção e CQ dentro deste dia. Assinaturas de limpeza e manutenção não têm duração medida. Os tempos acumulados das intervenções não entram neste total.</footer>
  </AppShell>;
}
