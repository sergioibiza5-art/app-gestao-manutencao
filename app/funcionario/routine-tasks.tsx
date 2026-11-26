import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, LockKeyhole } from "lucide-react";
import type { getEmployeeRoutines } from "@/lib/employee-routines";

export function RoutineTasks({ units, accessibleIds }: { units: Awaited<ReturnType<typeof getEmployeeRoutines>>; accessibleIds: string[] }) {
  if (!units.length) return null;
  const roots = [...new Set(units.map(unit => unit.rootId))];
  const tasks = units.flatMap(unit => unit.tasks);
  const pending = tasks.filter(task => ["pending", "reading", "issue"].includes(task.state)).length;
  const verification = tasks.filter(task => task.state === "verify").length;
  return <section id="routine-tasks" aria-labelledby="routine-heading" className="scroll-mt-28 border-t border-zinc-800 pt-4">
    <h2 id="routine-heading" className="flex items-center gap-2 text-lg font-semibold"><ClipboardCheck size={19} className="text-teal-200" />Limpezas e preventivas</h2>
    <p className="mt-2 text-sm text-zinc-400">{pending} por fazer ou confirmar · {verification} limpezas por verificar</p>
    {roots.map(id => {
      const family = units.filter(unit => unit.rootId === id), root = family[0];
      const count = family.flatMap(unit => unit.tasks).filter(task => ["pending", "reading", "issue"].includes(task.state)).length;
      return <details key={id} className="border-b border-zinc-800 py-2">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold"><span className="break-words">{root.rootName} · {root.rootCode}</span><span className="ml-2 text-xs font-normal text-amber-200">{count} por fazer ou confirmar</span></summary>
        <ul className="divide-y divide-zinc-800">{family.flatMap(unit => unit.tasks.map(task => <li key={`${unit.equipment.id}:${task.key}`} data-routine-state={task.state} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0"><p className="break-words font-medium">{unit.equipment.code} · {task.label}</p><p className="mt-1 text-xs text-zinc-500">{task.primary} · {task.period}</p></div>
          <p className={`break-words text-sm ${["pending", "reading", "verify"].includes(task.state) ? "text-amber-200" : task.state === "issue" ? "text-rose-200" : "text-teal-200"}`}>{task.statusLabel}</p>
          {accessibleIds.includes(unit.equipment.id) ? <Link href={task.href} className="inline-flex min-h-11 items-center gap-1 text-sm text-teal-200">Abrir <ArrowUpRight size={16} /></Link> : <span title="Sem acesso a este equipamento" className="inline-flex min-h-11 items-center gap-1 text-xs text-zinc-500"><LockKeyhole size={15} />Sem acesso ao impresso</span>}
        </li>))}</ul>
      </details>;
    })}
  </section>;
}
