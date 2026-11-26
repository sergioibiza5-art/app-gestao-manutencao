import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Filter, Users } from "lucide-react";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass } from "@/app/components/ui";
import { requireUser } from "@/lib/auth";
import { getEmployeeTeam } from "@/lib/employee-team";
import { employeeDayWindow } from "@/lib/employee-day";
import { lisbonDay } from "@/lib/daily-maintenance";
import { minutesLabel } from "@/lib/production";
import { DayRefresh } from "../refresh";

export const dynamic = "force-dynamic";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm hover:border-teal-300";
const time = (date: Date) => new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);

export default async function EmployeeTeamPage({ searchParams }: { searchParams: Promise<{ dia?: string; q?: string; ver?: string }> }) {
  const user = await requireUser();
  if (!user.productionCoordinator) notFound();
  const query = await searchParams, now = new Date(), today = lisbonDay(now), day = query.dia || today, live = day === today;
  try { employeeDayWindow(day); } catch { notFound(); }
  if (day > today || day < "2000-01-01") notFound();
  const rows = await getEmployeeTeam(user, day, now);
  const search = (query.q || "").trim().toLocaleLowerCase("pt-PT");
  const filtered = rows.filter(row => row.person.name.toLocaleLowerCase("pt-PT").includes(search)
    && (query.ver === "attention" ? row.attention : query.ver === "active" ? live ? row.current.length > 0 : row.totals.total > 0 || row.signatures > 0 : true));
  return <AppShell activeHref="/funcionario">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><Users size={23} />O dia da equipa</h1><p className="mt-2 text-sm text-zinc-400">{new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "full" }).format(employeeDayWindow(day).start)}</p></div><div className="flex gap-2"><Link href="/funcionario" className={secondary}><ArrowLeft size={16} />O meu dia</Link><DayRefresh live={live} /></div></header>
    <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[180px_minmax(0,1fr)_220px_auto]">
      <label className="space-y-1 text-sm text-zinc-400">Dia<input type="date" name="dia" defaultValue={day} required min="2000-01-01" max={today} className={inputClass} /></label>
      <label className="space-y-1 text-sm text-zinc-400">Colaborador<input type="search" name="q" defaultValue={query.q} className={inputClass} /></label>
      <label className="space-y-1 text-sm text-zinc-400">Registos<select name="ver" defaultValue={query.ver || "all"} className={inputClass}><option value="all">Toda a equipa</option><option value="active">{live ? "Em atividade agora" : "Com registos no dia"}</option><option value="attention">Precisam de atenção</option></select></label>
      <button className={buttonClass}><Filter size={16} />Consultar</button>
    </form>
    <section aria-label="Resumo da equipa" className="grid grid-cols-2 gap-4 border-y border-zinc-800 py-4 lg:grid-cols-4">
      {[["Colaboradores", filtered.length], [live ? "Em atividade agora" : "Com registos no dia", filtered.filter(row => live ? row.current.length > 0 : row.totals.total > 0 || row.signatures > 0).length], ["Precisam de atenção", filtered.filter(row => row.attention).length], ["Assinaturas no dia", filtered.reduce((n, row) => n + row.signatures, 0)]].map(([label, value]) => <div key={String(label)}><p className="text-sm text-zinc-400">{label}</p><p className="mt-2 text-xl font-semibold text-teal-200">{value}</p></div>)}
    </section>
    <section aria-label="Colaboradores da equipa"><div className="mb-2 hidden grid-cols-[minmax(140px,1fr)_minmax(0,2fr)_130px_130px_100px] gap-4 border-b border-zinc-800 pb-3 text-xs font-semibold uppercase text-zinc-500 lg:grid"><p>Colaborador</p><p>{live ? "Em curso agora" : "Registos do dia"}</p><p>Tempo no dia</p><p>Terminados</p><p>Assinaturas</p></div>
      <ul className="divide-y divide-zinc-800">{filtered.map(row => <li key={row.person.id} data-testid={`team-person-${row.person.id}`} className="grid min-w-0 gap-4 py-5 lg:grid-cols-[minmax(140px,1fr)_minmax(0,2fr)_130px_130px_100px]">
        <div className="min-w-0"><h2 className="break-words font-semibold">{row.person.name}</h2><p className="mt-1 text-xs text-zinc-500">{row.person.role}{!row.person.active ? " · Inativo" : ""}</p><Link href={`/funcionario?dia=${day}&pessoa=${row.person.id}`} className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm text-teal-200">Ver dia <ArrowUpRight size={16} /></Link></div>
        <div className="min-w-0 space-y-2">{row.current.map(work => <p key={`${work.href}:${work.start.toISOString()}`} className="break-words text-sm"><Link href={work.href} className="text-teal-200">{work.title}</Link><span className="block text-xs text-zinc-500">Desde {time(work.start)}</span></p>)}{!row.current.length && <p className="text-sm text-zinc-500">{live ? "Sem atividade aberta" : "Consulta os registos no detalhe do dia"}</p>}{row.forgotten > 0 && <p className="text-sm text-amber-200">{row.forgotten} atividade(s) aberta(s) desde outro dia</p>}{row.totals.overlap && <p className="text-sm text-rose-200">Horários sobrepostos</p>}{row.unverified > 0 && <p className="text-sm text-amber-200">{row.unverified} limpeza(s) do dia por verificar</p>}</div>
        <div><p className="text-xs text-zinc-500 lg:hidden">Tempo no dia</p><p className="text-sm font-semibold tabular-nums">{minutesLabel(row.totals.total)}</p>{row.totals.provisional > 0 && <p className="mt-1 text-xs text-amber-200">Inclui tempo provisório</p>}</div>
        <div><p className="text-xs text-zinc-500 lg:hidden">Períodos terminados</p><p className="text-sm tabular-nums">{minutesLabel(row.totals.closed)}</p></div>
        <div><p className="text-xs text-zinc-500 lg:hidden">Assinaturas</p><p className="text-sm">{row.signatures}</p></div>
      </li>)}</ul>{!filtered.length && <p className="py-8 text-sm text-zinc-400">Sem colaboradores para estes filtros.</p>}
    </section>
  </AppShell>;
}
