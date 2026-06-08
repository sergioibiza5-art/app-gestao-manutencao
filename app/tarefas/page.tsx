import { createTask, deleteTask, updateTask } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function dateInputValue(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function timeValue(task: { dueTime: string | null; dueDate: Date | null }) {
  return task.dueTime ?? task.dueDate?.toISOString().slice(11, 16) ?? "";
}

export default async function TasksPage() {
  const { tasks, equipment } = await getModuleData();

  return (
    <AppShell activeHref="/tarefas">
      <PageHeader
        eyebrow="Rotina"
        title="Tarefas"
        description="Cria tarefas pontuais com data e hora ou tarefas recorrentes para a rotina diaria."
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Nova tarefa</h2>
          <form action={createTask} className="mt-4 space-y-3">
            <input name="title" required className={inputClass} placeholder="Titulo" />
            <select name="isRecurring" className={inputClass} defaultValue="false">
              <option value="false">Tarefa pontual</option>
              <option value="true">Tarefa recorrente</option>
            </select>
            <select name="frequency" className={inputClass}>
              <option value="MONTHLY">Mensal, se recorrente</option>
              <option value="DAILY">Diaria</option>
              <option value="WEEKLY">Semanal</option>
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
              <input name="dueDate" type="date" className={inputClass} />
              <input name="dueTime" type="time" className={inputClass} />
            </div>
            <textarea name="description" className={textareaClass} placeholder="Descricao, criterio ou instrucao" />
            <button className={buttonClass}>Guardar tarefa</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Plano de tarefas</h2>
          <div className="mt-4 space-y-3">
            {tasks.length === 0 ? (
              <EmptyState title="Sem tarefas registadas" description="Cria tarefas pontuais ou recorrentes para construir o calendario operacional." />
            ) : (
              tasks.map((task) => (
                <article key={task.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{task.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{task.equipment?.name ?? (task.isRecurring ? task.frequency : "Pontual")}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-medium text-teal-300">{task.status}</p>
                      <p className="mt-1 text-xs text-zinc-500">{formatDate(task.dueDate ?? task.nextDue)} {timeValue(task)}</p>
                    </div>
                  </div>
                  <form action={updateTask} className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    <input type="hidden" name="id" value={task.id} />
                    <input name="title" className={inputClass} defaultValue={task.title} />
                    <select name="status" className={inputClass} defaultValue={task.status}>
                      <option value="PENDING">Pendente</option>
                      <option value="IN_PROGRESS">Em curso</option>
                      <option value="COMPLETED">Concluida</option>
                      <option value="CANCELED">Cancelada</option>
                    </select>
                    <select name="isRecurring" className={inputClass} defaultValue={task.isRecurring ? "true" : "false"}>
                      <option value="false">Pontual</option>
                      <option value="true">Recorrente</option>
                    </select>
                    <select name="frequency" className={inputClass} defaultValue={task.frequency ?? "MONTHLY"}>
                      <option value="MONTHLY">Mensal</option>
                      <option value="DAILY">Diaria</option>
                      <option value="WEEKLY">Semanal</option>
                      <option value="QUARTERLY">Trimestral</option>
                      <option value="FOUR_MONTHLY">Quadrimestral</option>
                      <option value="SEMIANNUAL">Semestral</option>
                      <option value="ANNUAL">Anual</option>
                    </select>
                    <select name="equipmentId" className={inputClass} defaultValue={task.equipmentId ?? ""}>
                      <option value="">Sem equipamento</option>
                      {equipment.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <input name="dueDate" type="date" className={inputClass} defaultValue={dateInputValue(task.dueDate)} />
                    <input name="dueTime" type="time" className={inputClass} defaultValue={timeValue(task)} />
                    <textarea name="description" className={`${textareaClass} md:col-span-2 xl:col-span-3`} defaultValue={task.description ?? ""} />
                    <button className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100">Atualizar</button>
                  </form>
                  <form action={deleteTask} className="mt-2">
                    <input type="hidden" name="id" value={task.id} />
                    <button className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-200">
                      Eliminar tarefa
                    </button>
                  </form>
                </article>
              ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
