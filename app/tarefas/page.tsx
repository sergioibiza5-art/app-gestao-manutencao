import { Plus } from "lucide-react";

import { createTask, deleteTask, updateTask } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { DetailsPopup } from "@/app/components/details-modal";
import { DetailsOpenButton } from "@/app/components/details-open-button";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type TasksPageProps = {
  searchParams?: Promise<{ taskId?: string }>;
};

function dateInputValue(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function timeValue(task: { dueTime: string | null; dueDate: Date | null }) {
  return task.dueTime ?? task.dueDate?.toISOString().slice(11, 16) ?? "";
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const params = (await searchParams) ?? {};
  const selectedTaskId = params.taskId ?? "";

  const { tasks, equipment } = await getModuleData();
  const newTaskAction = (
    <DetailsOpenButton targetId="nova-tarefa" className={buttonClass}>
      <Plus size={18} />
      Nova tarefa
    </DetailsOpenButton>
  );

  const newTaskPopup = (
    <DetailsPopup id="nova-tarefa" title="nova tarefa" maxWidth="max-w-3xl">
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
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <input name="dueDate" type="date" className={inputClass} />
            <input name="dueTime" type="time" className={inputClass} />
          </div>

          <textarea name="description" className={textareaClass} placeholder="Descrição, critério ou instrução" />

          <button className={buttonClass}>Guardar tarefa</button>
        </form>
      </Panel>
    </DetailsPopup>
  );

  return (
    <AppShell activeHref="/tarefas">
      <PageHeader
        eyebrow="Rotina"
        title="Tarefas"
        description="Cria tarefas pontuais com data e hora ou tarefas recorrentes para a rotina diária."
        action={newTaskAction}
      />
      {newTaskPopup}

      <section>
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Plano de tarefas</h2>

          <div className="mt-4 space-y-3">
            {tasks.length === 0 ? (
              <EmptyState
                title="Sem tarefas registadas"
                description="Cria tarefas pontuais ou recorrentes para construir o calendário operacional."
              />
            ) : (
              tasks.map((task) => {
                const isSelected = selectedTaskId === task.id;

                return (
                  <article
                    key={task.id}
                    id={`task-${task.id}`}
                    className={`scroll-mt-24 rounded-lg border bg-zinc-950/65 p-4 transition ${
                      isSelected
                        ? "border-teal-300/70 shadow-[0_0_0_1px_rgba(45,212,191,0.35),0_0_35px_rgba(45,212,191,0.12)]"
                        : "border-zinc-800"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-100">{task.title}</h3>
                        <p className="mt-1 text-sm text-zinc-500">
                          {task.equipment?.name ?? (task.isRecurring ? task.frequency : "Pontual")}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className={isSelected ? "text-sm font-medium text-teal-200" : "text-sm font-medium text-teal-300"}>
                          {task.status}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatDate(task.dueDate ?? task.nextDue)} {timeValue(task)}
                        </p>
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="mt-4 rounded-lg border border-teal-300/25 bg-teal-300/10 px-3 py-2 text-sm font-medium text-teal-100">
                        Tarefa aberta a partir da dashboard.
                      </div>
                    ) : null}

                    <form action={updateTask} className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <input type="hidden" name="id" value={task.id} />

                      <input name="title" className={inputClass} defaultValue={task.title} />

                      <select name="status" className={inputClass} defaultValue={task.status}>
                        <option value="PENDING">Pendente</option>
                        <option value="IN_PROGRESS">Em curso</option>
                        <option value="COMPLETED">Concluída</option>
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
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>

                      <input name="dueDate" type="date" className={inputClass} defaultValue={dateInputValue(task.dueDate)} />
                      <input name="dueTime" type="time" className={inputClass} defaultValue={timeValue(task)} />

                      <textarea
                        name="description"
                        className={`${textareaClass} md:col-span-2 xl:col-span-3`}
                        defaultValue={task.description ?? ""}
                      />

                      <button className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100">
                        Atualizar
                      </button>
                    </form>

                    <form action={deleteTask} className="mt-2">
                      <input type="hidden" name="id" value={task.id} />
                      <button className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-200">
                        Eliminar tarefa
                      </button>
                    </form>
                  </article>
                );
              })
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
