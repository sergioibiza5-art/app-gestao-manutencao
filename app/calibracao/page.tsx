import { createCalibrationLog } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CalibrationPage() {
  const { equipment, calibrationLogs } = await getModuleData();

  return (
    <AppShell activeHref="/calibracao">
      <PageHeader
        eyebrow="Metrologia"
        title="Calibração de equipamentos"
        description="Controla certificados, resultados, aprovação e próxima validade dos equipamentos calibráveis."
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Nova calibração</h2>
          <form action={createCalibrationLog} className="mt-4 space-y-3">
            <select name="equipmentId" required className={inputClass}>
              <option value="">Selecionar equipamento</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input name="title" required className={inputClass} placeholder="Descrição" />
            <input name="certificateNo" className={inputClass} placeholder="N.º certificado" />
            <div className="grid grid-cols-2 gap-3">
              <input name="calibrationDate" type="date" className={inputClass} />
              <input name="nextDueDate" type="date" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="result" className={inputClass} placeholder="Resultado" />
              <select name="approved" className={inputClass}>
                <option value="true">Aprovado</option>
                <option value="false">Reprovado</option>
              </select>
            </div>
            <textarea name="notes" className={textareaClass} placeholder="Notas e critérios" />
            <button className={buttonClass}>Guardar calibração</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Certificados</h2>
          <div className="mt-4 space-y-3">
            {calibrationLogs.length === 0 ? (
              <EmptyState title="Sem calibrações registadas" description="Os certificados e vencimentos passam a aparecer aqui." />
            ) : (
              calibrationLogs.map((log) => (
                <article key={log.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{log.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{log.equipment.name} · {log.certificateNo ?? "sem certificado"}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className={log.approved ? "text-sm font-medium text-emerald-300" : "text-sm font-medium text-rose-300"}>
                        {log.approved ? "Aprovado" : "Reprovado"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">Próx.: {formatDate(log.nextDueDate)}</p>
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
