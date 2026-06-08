import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, CheckSquare } from "lucide-react";

import { createInternalMaintenanceChecklistRecord } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getEquipmentDetail } from "@/lib/data";

export const dynamic = "force-dynamic";

type ChecklistPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InternalChecklistPage({ params }: ChecklistPageProps) {
  const { id } = await params;
  const equipment = await getEquipmentDetail(id);

  if (!equipment) {
    notFound();
  }

  const template = equipment.equipmentType?.checklistTemplates[0];

  if (!template) {
    return (
      <AppShell activeHref="/equipamentos">
        <PageHeader
          eyebrow="Checklist"
          title={equipment.name}
          description="Este equipamento ainda não tem um tipo com checklist ativa associado."
          action={
            <Link href={`/equipamentos/${equipment.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
              <ArrowLeft size={17} />
              Voltar
            </Link>
          }
        />
      </AppShell>
    );
  }

  const now = new Date();

  return (
    <AppShell activeHref="/equipamentos">
      <PageHeader
        eyebrow="Manutenção interna"
        title={`Checklist - ${equipment.name}`}
        description={`${template.title} · ${equipment.equipmentType?.name ?? "Tipo não definido"} · versão ${template.version}`}
        action={
          <Link href={`/equipamentos/${equipment.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50">
            <ArrowLeft size={17} />
            Ficha
          </Link>
        }
      />

      <form action={createInternalMaintenanceChecklistRecord} className="space-y-4">
        <Panel>
          <div className="grid gap-3 md:grid-cols-5">
            <input type="hidden" name="equipmentId" value={equipment.id} />
            <input type="hidden" name="templateId" value={template.id} />
            <input name="year" defaultValue={now.getFullYear()} className={inputClass} placeholder="Ano" />
            <input name="month" defaultValue={now.getMonth() + 1} className={inputClass} placeholder="Mês" />
            <input name="documentNo" className={inputClass} placeholder="Documento n.º" />
            <input name="performedAt" type="date" className={inputClass} />
            <input name="responsible" className={inputClass} placeholder="Responsável" />
          </div>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center gap-3">
            <CheckSquare size={22} className="text-teal-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Itens a verificar</h2>
          </div>

          <div className="space-y-3">
            {template.items.map((item) => (
              <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                <input type="hidden" name="itemId" value={item.id} />
                <div className="grid gap-3 xl:grid-cols-[0.9fr_1fr_0.55fr]">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-600">Verificar</p>
                    <h3 className="mt-1 font-semibold text-zinc-100">{item.order}. {item.check}</h3>
                    {item.photoRequired && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-300/10 px-2 py-1 text-xs text-amber-200">
                        <Camera size={13} />
                        Foto recomendada
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-600">Condição esperada</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{item.expectedCondition}</p>
                  </div>
                  <select name={`status_${item.id}`} className={inputClass}>
                    <option value="OK">OK</option>
                    <option value="NOT_OK">Não OK</option>
                    <option value="NA">N/A</option>
                  </select>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_0.75fr]">
                  <input name={`obs_${item.id}`} className={inputClass} placeholder="Observações" />
                  <input name={`photo_${item.id}`} className={inputClass} placeholder="URL/caminho da foto" />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input name={`photoName_${item.id}`} className={inputClass} placeholder="Nome da foto" />
                  <input name={`photoCaption_${item.id}`} className={inputClass} placeholder="Legenda da foto" />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input name="result" className={inputClass} placeholder="Resultado final" />
            <textarea name="notes" className={textareaClass} placeholder="Notas gerais" />
            <button className={`${buttonClass} md:self-start`}>Guardar checklist</button>
          </div>
        </Panel>
      </form>
    </AppShell>
  );
}
