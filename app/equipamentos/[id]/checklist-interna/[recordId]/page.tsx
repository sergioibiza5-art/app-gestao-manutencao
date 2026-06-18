import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2, FileText, XCircle } from "lucide-react";

import { AppShell } from "@/app/components/app-shell";
import { PageHeader, Panel } from "@/app/components/ui";
import { getInternalMaintenanceRecord } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type ChecklistDocumentPageProps = {
  params: Promise<{ id: string; recordId: string }>;
};

function statusLabel(status: string) {
  if (status === "NOT_OK") return "Não OK";
  if (status === "NA") return "N/A";
  return "OK";
}

function statusClass(status: string) {
  if (status === "NOT_OK") return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  if (status === "NA") return "border-zinc-700 bg-zinc-900 text-zinc-300";
  return "border-teal-300/40 bg-teal-300/10 text-teal-200";
}

export default async function ChecklistDocumentPage({ params }: ChecklistDocumentPageProps) {
  const { id, recordId } = await params;
  const record = await getInternalMaintenanceRecord(id, recordId);

  if (!record) {
    notFound();
  }

  const equipment = record.equipment;
  const notOkCount = record.responses.filter((response) => response.status === "NOT_OK").length;
  const okCount = record.responses.filter((response) => response.status === "OK").length;
  const photoCount = record.responses.reduce((total, response) => total + response.photos.length, 0);

  return (
    <AppShell activeHref="/equipamentos">
      <PageHeader
        eyebrow="Documento de manutenção interna"
        title={record.documentNo || `Checklist ${formatDate(record.performedAt)}`}
        description={`${record.template.title} · ${equipment.name} · ${equipment.code ?? "sem código"} · ${equipment.equipmentType?.name ?? "sem tipo"}`}
        action={
          <div className="flex flex-wrap gap-2">
            
            <Link href={`/equipamentos/${equipment.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
              <ArrowLeft size={17} />
              Ficha
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_0.7fr]">
        <Panel>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Equipamento", equipment.name],
              ["Código interno", equipment.code ?? "Sem código"],
              ["Tipo", equipment.equipmentType?.name ?? "Sem tipo"],
              ["Modelo", equipment.model ?? "Sem modelo"],
              ["N.º de série", equipment.serialNumber ?? "Sem n.º série"],
              ["Localização", equipment.location ?? "Sem localização"],
              ["Responsável", record.responsible ?? "Sem responsável"],
              ["Data", formatDate(record.performedAt)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">{value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-teal-300/25 bg-teal-300/10 p-3">
              <p className="text-xs text-teal-200">OK</p>
              <p className="mt-1 text-2xl font-semibold text-teal-200">{okCount}</p>
            </div>
            <div className="rounded-lg border border-rose-400/25 bg-rose-400/10 p-3">
              <p className="text-xs text-rose-200">Não OK</p>
              <p className="mt-1 text-2xl font-semibold text-rose-200">{notOkCount}</p>
            </div>
            <div className="rounded-lg border border-sky-300/25 bg-sky-300/10 p-3">
              <p className="text-xs text-sky-200">Fotos</p>
              <p className="mt-1 text-2xl font-semibold text-sky-200">{photoCount}</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs text-zinc-500">Resultado final</p>
            <p className="mt-1 text-sm font-medium text-zinc-100">{record.result || "Sem resultado final"}</p>
          </div>

{record.workOrder && (
  <a
    href={`/equipamentos/${equipment.id}/checklist-interna/${record.id}`}
    target="_blank"
    rel="noreferrer"
    className="mt-4 block rounded-lg border border-sky-300/20 bg-sky-300/10 p-3 transition hover:border-sky-300/50"
  >
    <p className="text-xs uppercase tracking-[0.14em] text-sky-300">
      Ordem de serviço associada
    </p>
    <p className="mt-1 text-sm font-semibold text-sky-100">
      Documento {record.workOrder.number}
    </p>
  </a>
)}

        </Panel>
      </section>

      <Panel>
        <div className="mb-4 flex items-center gap-3">
          <CheckCircle2 size={22} className="text-teal-300" />
          <h2 className="text-xl font-semibold text-zinc-50">Registo de inspeção e manutenção</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-230 border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-[0.14em] text-zinc-500">
                <th className="px-3 py-3 font-medium">Verificar</th>
                <th className="px-3 py-3 font-medium">Condição esperada</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 font-medium">Obs.</th>
                <th className="px-3 py-3 font-medium">Fotos</th>
              </tr>
            </thead>
            <tbody>
              {record.responses.map((response) => (
                <tr key={response.id} className="border-b border-zinc-900 align-top">
                  <td className="px-3 py-4 font-medium text-zinc-100">
                    {response.item.order}. {response.item.check}
                  </td>
                  <td className="px-3 py-4 leading-6 text-zinc-400">{response.item.expectedCondition}</td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(response.status)}`}>
                      {statusLabel(response.status)}
                    </span>
                  </td>
                  <td className="px-3 py-4 leading-6 text-zinc-400">{response.obs || "Sem observações"}</td>
                  <td className="px-3 py-4">
                    {response.photos.length === 0 ? (
                      <span className="text-zinc-600">Sem fotos</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {response.photos.map((photo) => (
                          <a key={photo.id} href={photo.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sky-300 hover:text-sky-200">
                            <Camera size={15} />
                            {photo.caption || photo.fileName || "Abrir foto"}
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <div className="flex items-center gap-3">
            <FileText size={22} className="text-sky-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Notas gerais</h2>
          </div>
          <p className="mt-4 min-h-20 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-400">
            {record.notes || "Sem notas gerais."}
          </p>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3">
            <XCircle size={22} className={notOkCount > 0 ? "text-rose-300" : "text-zinc-500"} />
            <h2 className="text-xl font-semibold text-zinc-50">Pontos em atenção</h2>
          </div>
          <div className="mt-4 space-y-2">
            {record.responses.filter((response) => response.status === "NOT_OK").length === 0 ? (
              <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">Sem pontos Não OK neste documento.</p>
            ) : (
              record.responses
                .filter((response) => response.status === "NOT_OK")
                .map((response) => (
                  <div key={response.id} className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-4">
                    <p className="font-medium text-rose-100">{response.item.check}</p>
                    <p className="mt-2 text-sm leading-6 text-rose-100/75">{response.obs || "Sem observação."}</p>
                  </div>
                ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
