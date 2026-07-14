import { CalendarDays, Plus, Trash2, TreePalm } from "lucide-react";

import { createVacation, deleteVacation, updateVacation } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { DetailsModal } from "@/app/components/details-modal";
import {
  buttonClass,
  EmptyState,
  inputClass,
  PageHeader,
  Panel,
  textareaClass,
} from "@/app/components/ui";
import { requireCanManage } from "@/lib/auth";
import { getVacationsData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type VacationsPageProps = {
  searchParams?: Promise<{ year?: string }>;
};

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function colorStyle(color?: string | null) {
  const safeColor = color || "#14b8a6";

  return {
    borderColor: `${safeColor}80`,
    backgroundColor: `${safeColor}22`,
    color: "#f8fafc",
  };
}

function StatusSelect({ defaultValue = "PLANNED" }: { defaultValue?: string }) {
  return (
    <select name="status" className={inputClass} defaultValue={defaultValue}>
      <option value="PLANNED">Planeada</option>
      <option value="APPROVED">Aprovada</option>
      <option value="TAKEN">Gozada</option>
      <option value="CANCELED">Cancelada</option>
    </select>
  );
}

export default async function VacationsPage({ searchParams }: VacationsPageProps) {
  await requireCanManage();

  const params = (await searchParams) ?? {};
  const selectedYear = Number(params.year || new Date().getFullYear());
  const { vacations, users } = await getVacationsData(selectedYear);

  const activeVacations = vacations.filter((vacation) => vacation.status !== "CANCELED");
  const totalDays = activeVacations.reduce((sum, vacation) => sum + Number(vacation.days ?? 0), 0);
  const totalAbsenceHours = activeVacations.reduce((sum, vacation) => sum + Number(vacation.absenceHours ?? 0), 0);
  const totalBankHours = activeVacations.reduce((sum, vacation) => sum + Number(vacation.bankHoursUsed ?? 0), 0);
  const people = new Set(activeVacations.map((vacation) => vacation.employeeName)).size;

  const monthlyMap = monthNames.map((month, index) => ({
    month,
    items: vacations.filter((vacation) => {
      const monthStart = new Date(selectedYear, index, 1);
      const monthEnd = new Date(selectedYear, index + 1, 0, 23, 59, 59, 999);
      return vacation.startDate <= monthEnd && vacation.endDate >= monthStart;
    }),
  }));
  const newVacationAction = (
    <DetailsModal
      id="nova-marcacao-ferias"
      title="nova marcação"
      maxWidth="max-w-2xl"
      button={
        <span className={buttonClass}>
          <Plus size={18} />
          Nova marcação
        </span>
      }
    >
      <Panel>
        <div className="flex items-center gap-3">
          <TreePalm size={22} className="text-emerald-300" />
          <h2 className="text-xl font-semibold text-zinc-50">Nova marcação</h2>
        </div>

        <form action={createVacation} className="mt-4 space-y-3">
          <select name="userId" className={inputClass}>
            <option value="">Sem utilizador associado</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>

          <input name="employeeName" required className={inputClass} placeholder="Nome da pessoa" />

          <div className="grid grid-cols-2 gap-3">
            <input name="startDate" required type="date" className={inputClass} />
            <input name="endDate" required type="date" className={inputClass} />
          </div>

          <input name="days" type="number" step="0.5" min="0" className={inputClass} placeholder="Dias Ãºteis, ex.: 0.5" />

          <div className="grid grid-cols-2 gap-3">
            <input name="absenceHours" type="number" step="0.25" min="0" className={inputClass} placeholder="Horas de falta" />
            <input name="bankHoursUsed" type="number" step="0.25" min="0" className={inputClass} placeholder="Horas banco" />
          </div>

          <StatusSelect />

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Cor da pessoa</label>
            <input
              type="color"
              name="color"
              defaultValue="#14b8a6"
              className="mt-2 h-11 w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 px-2"
            />
          </div>

          <textarea name="notes" className={textareaClass} placeholder="ObservaÃ§Ãµes" />

          <button className={buttonClass}>Guardar fÃ©rias</button>
        </form>
      </Panel>
    </DetailsModal>
  );

  return (
    <AppShell activeHref="/ferias">
      <PageHeader
        eyebrow="Departamento"
        title="Férias da equipa"
        description="Planeia e acompanha as férias do departamento por pessoa, estado, período e ano."
        action={newVacationAction}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Panel>
          <p className="text-sm text-zinc-500">Ano</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-50">{selectedYear}</p>
        </Panel>

        <Panel>
          <p className="text-sm text-zinc-500">Pessoas com férias</p>
          <p className="mt-2 text-3xl font-semibold text-teal-200">{people}</p>
        </Panel>

        <Panel>
          <p className="text-sm text-zinc-500">Dias planeados</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-200">{totalDays.toFixed(1)}</p>
        </Panel>

        <Panel>
          <p className="text-sm text-zinc-500">Horas / banco</p>
          <p className="mt-2 text-3xl font-semibold text-amber-200">{totalAbsenceHours.toFixed(1)}h</p>
          <p className="mt-1 text-xs text-zinc-500">{totalBankHours.toFixed(1)}h descontadas</p>
        </Panel>
      </section>

      <section className="space-y-4">
        <Panel>
          <form className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_auto] md:items-end">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Ano</span>
              <input name="year" className={inputClass} defaultValue={selectedYear} />
            </label>
            <button className={buttonClass}>Ver ano</button>
          </form>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <CalendarDays size={22} className="text-emerald-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Mapa anual</h2>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {monthlyMap.map(({ month, items }) => (
              <div
                key={month}
                className="min-h-40 overflow-hidden rounded-lg border border-emerald-300/20 bg-zinc-950/60"
              >
                <div className="border-b border-emerald-300/20 bg-emerald-300/10 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
                    {month}
                  </p>
                </div>

                <div className="space-y-2 p-3">
                  {items.length === 0 ? (
                    <p className="text-xs text-zinc-600">Sem férias</p>
                  ) : (
                    items.map((vacation) => (
                      <div
                        key={vacation.id}
                        className="rounded-md border px-2 py-2"
                        style={colorStyle(vacation.color)}
                      >
                        <p className="truncate text-xs font-semibold">{vacation.employeeName}</p>
                        <p className="mt-1 text-[11px] opacity-80">
                          {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel>
        <h2 className="text-xl font-semibold text-zinc-50">Registos de férias</h2>

        <div className="mt-4 space-y-3">
          {vacations.length === 0 ? (
            <EmptyState
              title="Sem férias registadas"
              description="Adiciona a primeira marcação para começar o mapa do departamento."
            />
          ) : (
            vacations.map((vacation) => (
              <article key={vacation.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                <form action={updateVacation} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <input type="hidden" name="id" value={vacation.id} />

                  <select name="userId" className={inputClass} defaultValue={vacation.userId ?? ""}>
                    <option value="">Sem utilizador</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>

                  <input name="employeeName" required className={inputClass} defaultValue={vacation.employeeName} />

                  <input
                    name="startDate"
                    required
                    type="date"
                    className={inputClass}
                    defaultValue={dateInputValue(vacation.startDate)}
                  />

                  <input
                    name="endDate"
                    required
                    type="date"
                    className={inputClass}
                    defaultValue={dateInputValue(vacation.endDate)}
                  />

                  <input
                    name="days"
                    type="number"
                    step="0.5"
                    min="0"
                    className={inputClass}
                    defaultValue={String(vacation.days ?? 0)}
                    aria-label="Dias de férias"
                  />

                  <input
                    name="absenceHours"
                    type="number"
                    step="0.25"
                    min="0"
                    className={inputClass}
                    defaultValue={String(vacation.absenceHours ?? 0)}
                    aria-label="Horas de falta"
                  />

                  <input
                    name="bankHoursUsed"
                    type="number"
                    step="0.25"
                    min="0"
                    className={inputClass}
                    defaultValue={String(vacation.bankHoursUsed ?? 0)}
                    aria-label="Horas descontadas do banco de horas"
                  />

                  <StatusSelect defaultValue={vacation.status} />

                  <input
                    type="color"
                    name="color"
                    className="h-11 w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 px-2"
                    defaultValue={vacation.color ?? "#14b8a6"}
                  />

                  <textarea
                    name="notes"
                    className={`${textareaClass} md:col-span-2 xl:col-span-5`}
                    defaultValue={vacation.notes ?? ""}
                  />

                  <div className="flex flex-wrap gap-2">
                    <button className={buttonClass}>Atualizar</button>

                    <button
                      formAction={deleteVacation}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 text-sm font-semibold text-rose-200"
                    >
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  </div>
                </form>
              </article>
            ))
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
