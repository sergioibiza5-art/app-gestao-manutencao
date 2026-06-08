import { createTask } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { tasks, equipment } = await getModuleData();

  return (
    <AppShell activeHref="/tarefas">
      <PageHeader
        eyebrow="Rotina"
        title="Tarefas recorrentes"
        description="Planeia tarefas diárias, semanais, mensais, trimestrais, quadrimestrais, semestrais e anuais."
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Nova tarefa</h2>
          <form action={createTask} className="mt-4 space-y-3">
            <input name="title" required className={inputClass} placeholder="Título" />
            <select name="frequency" className={inputClass}>
              <option value="DAILY">Diária</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensal</option>
              <option value="QUARTERLY">Trimestral</option>
              <option value="FOUR_MONTHLY">Quadrimestral</option>
              <option value="SEMIANNUAL">Semestral</option>
              <option value="ANNUAL">Anual</option>
            </select>
            <select name="equipmentId" className={inputClass}>
              <option value="">Sem equipamento</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input name="startDate" type="date" className={inputClass} />
              <input name="dueDate" type="date" className={inputClass} />
            </div>
            <textarea name="description" className={textareaClass} placeholder="Descrição, critério de aceitação ou instrução SGQ" />
            <button className={buttonClass}>Guardar tarefa</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Plano de tarefas</h2>
          <div className="mt-4 space-y-3">
            {tasks.length === 0 ? (
              <EmptyState title="Sem tarefas registadas" description="Cria as primeiras rotinas para construir o calendário operacional." />
            ) : (
              tasks.map((task) => (
                <article key={task.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{task.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{task.equipment?.name ?? task.frequency}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-medium text-teal-300">{task.status}</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatDate(task.dueDate ?? task.nextDue)}</p>
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
