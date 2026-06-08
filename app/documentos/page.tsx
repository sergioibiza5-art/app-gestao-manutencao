import { createDocument } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getModuleData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const { documents, equipment } = await getModuleData();

  return (
    <AppShell activeHref="/documentos">
      <PageHeader
        eyebrow="Arquivo"
        title="Documentos importantes"
        description="Centraliza garantias, manuais, certificados, contratos, faturas e documentos com validade."
      />

      <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Novo documento</h2>
          <form action={createDocument} className="mt-4 space-y-3">
            <input name="title" required className={inputClass} placeholder="Título" />
            <select name="type" className={inputClass}>
              <option value="INVOICE">Fatura</option>
              <option value="WARRANTY">Garantia</option>
              <option value="MANUAL">Manual</option>
              <option value="CERTIFICATE">Certificado</option>
              <option value="CONTRACT">Contrato</option>
              <option value="OTHER">Outro</option>
            </select>
            <select name="equipmentId" className={inputClass}>
              <option value="">Sem equipamento associado</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input name="fileName" className={inputClass} placeholder="Nome do ficheiro" />
            <input name="fileUrl" className={inputClass} placeholder="URL ou caminho do ficheiro" />
            <input name="expiryDate" type="date" className={inputClass} />
            <textarea name="notes" className={textareaClass} placeholder="Notas" />
            <button className={buttonClass}>Guardar documento</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Arquivo</h2>
          <div className="mt-4 space-y-3">
            {documents.length === 0 ? (
              <EmptyState title="Sem documentos" description="Adiciona os documentos críticos para controlar evidências e validades." />
            ) : (
              documents.map((document) => (
                <article key={document.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{document.title}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{document.type} · {document.equipment?.name ?? "sem equipamento"}</p>
                    </div>
                    <p className="text-xs text-zinc-500">Val.: {formatDate(document.expiryDate)}</p>
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
