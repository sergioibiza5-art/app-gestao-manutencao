import { FileSpreadsheet, Search } from "lucide-react";

import { createCalibrationLog, importCalibrationsCsv, updateCalibrationLog } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type CalibrationPageProps = {
  searchParams?: Promise<{ q?: string; approved?: string }>;
};

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase();
}

export default async function CalibrationPage({ searchParams }: CalibrationPageProps) {
  const params = (await searchParams) ?? {};
  const { equipment, calibrationLogs } = await getModuleData();
  const q = normalize(params.q);
  const approved = params.approved || "all";
  const filteredLogs = calibrationLogs.filter((log) => {
    const haystack = [log.title, log.certificateNo, log.result, log.notes, log.equipment.name, log.equipment.code].map(normalize).join(" ");
    return (!q || haystack.includes(q)) && (approved === "all" || String(log.approved) === approved);
  });
  const templateHref =
    "data:text/csv;charset=utf-8," +
    encodeURIComponent("codigo_equipamento;equipamento;descricao;numero_certificado;data_calibracao;proxima_validade;resultado;aprovado;link_certificado;nome_ficheiro;notas\nEQ-001;;Calibracao anual;CERT-001;2026-01-10;2027-01-10;Conforme;sim;https://...;certificado.pdf;\n");

  return (
    <AppShell activeHref="/calibracao">
      <PageHeader
        eyebrow="Metrologia"
        title="Calibracao de equipamentos"
        description="Controla certificados, resultados, aprovacao e proxima validade dos equipamentos calibraveis."
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Nova calibracao</h2>
          <form action={createCalibrationLog} className="mt-4 space-y-3">
            <select name="equipmentId" required className={inputClass}>
              <option value="">Selecionar equipamento</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input name="title" required className={inputClass} placeholder="Descricao" />
            <input name="certificateNo" className={inputClass} placeholder="N. certificado" />
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
            <input name="certificateUrl" className={inputClass} placeholder="Link/caminho do certificado" />
            <input name="certificateFileName" className={inputClass} placeholder="Nome do ficheiro do certificado" />
            <textarea name="notes" className={textareaClass} placeholder="Notas e criterios" />
            <button className={buttonClass}>Guardar calibracao</button>
          </form>

          <div className="mt-6 rounded-lg border border-zinc-800 bg-black/20 p-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={20} className="text-lime-300" />
              <h3 className="font-semibold text-zinc-100">Importar por Excel/CSV</h3>
            </div>
            <a href={templateHref} download="modelo_calibracoes.csv" className="mt-3 inline-flex text-sm font-semibold text-lime-200">
              Descarregar modelo
            </a>
            <form action={importCalibrationsCsv} encType="multipart/form-data" className="mt-3 grid gap-3">
              <input name="file" type="file" accept=".csv,text/csv" className={inputClass} />
              <button className={buttonClass}>Importar calibracoes</button>
            </form>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-zinc-50">Certificados</h2>
            <form className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
              <input name="q" defaultValue={params.q ?? ""} className={inputClass} placeholder="Pesquisar" />
              <select name="approved" defaultValue={approved} className={inputClass}>
                <option value="all">Todos</option>
                <option value="true">Aprovados</option>
                <option value="false">Reprovados</option>
              </select>
              <button className={buttonClass}>
                <Search size={16} />
                Filtrar
              </button>
            </form>
          </div>
          <div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-1">
            {filteredLogs.length === 0 ? (
              <EmptyState title="Sem calibracoes registadas" description="Os certificados e vencimentos passam a aparecer aqui." />
            ) : (
              filteredLogs.map((log) => {
                const certificate = log.documents.find((document) => document.type === "CERTIFICATE" && document.fileUrl);
                return (
                  <article key={log.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-100">{log.title}</h3>
                        <p className="mt-1 text-sm text-zinc-500">{log.equipment.name} - {log.certificateNo ?? "sem certificado"}</p>
                        {certificate && (
                          <a href={certificate.fileUrl ?? "#"} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-sky-300">
                            Abrir certificado
                          </a>
                        )}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className={log.approved ? "text-sm font-medium text-emerald-300" : "text-sm font-medium text-rose-300"}>
                          {log.approved ? "Aprovado" : "Reprovado"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">Prox.: {formatDate(log.nextDueDate)}</p>
                      </div>
                    </div>
                    <form action={updateCalibrationLog} className="mt-4 grid gap-2 md:grid-cols-2">
                      <input type="hidden" name="id" value={log.id} />
                      <input name="title" className={inputClass} defaultValue={log.title} placeholder="Descricao" />
                      <input name="certificateNo" className={inputClass} defaultValue={log.certificateNo ?? ""} placeholder="N. certificado" />
                      <input name="calibrationDate" type="date" className={inputClass} defaultValue={log.calibrationDate.toISOString().slice(0, 10)} />
                      <input name="nextDueDate" type="date" className={inputClass} defaultValue={log.nextDueDate?.toISOString().slice(0, 10) ?? ""} />
                      <input name="result" className={inputClass} defaultValue={log.result ?? ""} placeholder="Resultado" />
                      <select name="approved" className={inputClass} defaultValue={log.approved ? "true" : "false"}>
                        <option value="true">Aprovado</option>
                        <option value="false">Reprovado</option>
                      </select>
                      <input name="certificateUrl" className={inputClass} defaultValue={certificate?.fileUrl ?? ""} placeholder="Link/caminho do certificado" />
                      <input name="certificateFileName" className={inputClass} defaultValue={certificate?.fileName ?? ""} placeholder="Nome do ficheiro" />
                      <textarea name="notes" className={`${textareaClass} md:col-span-2`} defaultValue={log.notes ?? ""} placeholder="Notas" />
                      <button className={buttonClass}>Guardar certificado</button>
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
