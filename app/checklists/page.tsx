import { Rows3 } from "lucide-react";

import { createEquipmentTypeWithChecklist, updateChecklistTemplate } from "@/app/actions";
import { ChecklistTemplateBuilder } from "@/app/checklists/checklist-template-builder";
import { AppShell } from "@/app/components/app-shell";
import { EmptyState, PageHeader, Panel } from "@/app/components/ui";
import { getChecklistAdminData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ChecklistsPage() {
  const { equipmentTypes } = await getChecklistAdminData();

  return (
    <AppShell activeHref="/checklists">
      <PageHeader
        eyebrow="Templates"
        title="Checklists por tipo de equipamento"
        description="Cria modelos por tipo de equipamento com linhas de verificacao, condicao esperada e obrigatoriedade de foto."
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <Rows3 size={22} className="text-sky-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Novo template</h2>
          </div>
          <ChecklistTemplateBuilder action={createEquipmentTypeWithChecklist} />
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Templates existentes</h2>
          <div className="mt-4 space-y-3">
            {equipmentTypes.length === 0 ? (
              <EmptyState title="Sem templates" description="Cria o primeiro tipo de equipamento para usar checklists nas manutencoes internas." />
            ) : (
              equipmentTypes.map((type) => (
                <article key={type.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{type.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{type.description ?? "Sem descricao"}</p>
                    </div>
                    <span className="rounded-md bg-sky-300/10 px-2 py-1 text-xs text-sky-200">
                      {type.checklistTemplates.length} template(s)
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {type.checklistTemplates.map((template) => (
                      <div key={template.id} className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-zinc-100">{template.title}</p>
                          <p className="text-xs text-zinc-500">v{template.version}</p>
                        </div>
                        <p className="mt-2 text-sm text-zinc-500">{template.items.length} item(ns)</p>
                        <ChecklistTemplateBuilder
                          action={updateChecklistTemplate}
                          templateId={template.id}
                          typeName={type.name}
                          templateTitle={template.title}
                          version={template.version}
                          description={type.description}
                          notes={template.notes}
                          rows={template.items
                            .filter((item) => item.active)
                            .sort((a, b) => a.order - b.order)
                            .map((item) => ({
                              id: item.id,
                              check: item.check,
                              expected: item.expectedCondition,
                              photo: item.photoRequired,
                            }))}
                          submitLabel="Guardar alteracoes"
                        />
                      </div>
                    ))}
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
