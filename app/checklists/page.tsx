import { Copy, Plus, Rows3, Save, Trash2 } from "lucide-react";

import {
  createChecklistExpectedCondition,
  createEquipmentTypeWithChecklist,
  deleteChecklistExpectedCondition,
  duplicateChecklistTemplate,
  updateChecklistExpectedCondition,
  updateChecklistTemplate,
} from "@/app/actions";
import { ChecklistTemplateBuilder } from "@/app/checklists/checklist-template-builder";
import { AppShell } from "@/app/components/app-shell";
import { EmptyState, inputClass, PageHeader, Panel } from "@/app/components/ui";
import { getChecklistAdminData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ChecklistsPage() {
  const { equipmentTypes, expectedConditions } = await getChecklistAdminData();
  const expectedConditionNames = expectedConditions.map((condition) => condition.name);

  return (
    <AppShell activeHref="/checklists">
      <PageHeader
        eyebrow="Templates"
        title="Checklists por tipo de equipamento"
        description="Cria modelos por tipo de equipamento com linhas de verificacao, condicao esperada e obrigatoriedade de foto."
      />

      <section className="space-y-6">
        <Panel>
          <div className="flex items-center gap-3">
            <Rows3 size={22} className="text-sky-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Novo template</h2>
          </div>
          <ChecklistTemplateBuilder action={createEquipmentTypeWithChecklist} expectedConditions={expectedConditionNames} />
        </Panel>

        <Panel>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Condições esperadas</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Gere as opções que aparecem nas linhas das checklists. As condições antigas ficam preservadas nos registos já criados.
              </p>
            </div>
          </div>

          <form action={createChecklistExpectedCondition} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <input name="name" className={inputClass} placeholder="Nova condição esperada, ex.: Sem corrosão visível" />
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200">
              <Plus size={16} />
              Adicionar
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {expectedConditions.length === 0 ? (
              <EmptyState title="Sem condições configuradas" description="Adiciona condições para aparecerem na criação das checklists." />
            ) : (
              expectedConditions.map((condition) => (
                <div key={condition.id} className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950/45 p-2 md:grid-cols-[96px_minmax(0,1fr)_auto_auto]">
                  <form id={`condition-${condition.id}`} action={updateChecklistExpectedCondition} className="contents">
                    <input type="hidden" name="id" value={condition.id} />
                    <input name="sortOrder" type="number" className={inputClass} defaultValue={condition.sortOrder} aria-label="Ordem" />
                    <input name="name" className={inputClass} defaultValue={condition.name} aria-label="Condição esperada" />
                    <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-teal-300/35 bg-teal-300/10 px-3 text-sm font-semibold text-teal-100 transition hover:border-teal-200/70">
                      <Save size={15} />
                      Guardar
                    </button>
                  </form>
                  <form action={deleteChecklistExpectedCondition}>
                    <input type="hidden" name="id" value={condition.id} />
                    <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-rose-300/35 bg-rose-300/10 px-3 text-sm font-semibold text-rose-100 transition hover:border-rose-200/70">
                      <Trash2 size={15} />
                      Apagar
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Templates existentes</h2>
          <div className="mt-4 space-y-3">
            {equipmentTypes.length === 0 ? (
              <EmptyState title="Sem templates" description="Cria o primeiro tipo de equipamento para usar checklists nas manutencoes internas." />
            ) : (
              equipmentTypes.map((type) => (
                <details key={type.id} className="group rounded-lg border border-zinc-800 bg-zinc-950/65 p-4 open:border-sky-300/35">
                  <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{type.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{type.description ?? "Sem descricao"}</p>
                    </div>
                    <span className="flex flex-col items-start gap-2 sm:items-end">
                      <span className="rounded-md bg-sky-300/10 px-2 py-1 text-xs text-sky-200">
                        {type.checklistTemplates.length} template(s)
                      </span>
                      <span className="text-xs text-teal-300 group-open:hidden">Abrir templates</span>
                    </span>
                  </summary>
                  <div className="mt-4 space-y-3">
                    {type.checklistTemplates.map((template) => (
                      <div key={template.id} className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-zinc-100">{template.title}</p>
                          <p className="text-xs text-zinc-500">v{template.version}</p>
                        </div>
                        <p className="mt-2 text-sm text-zinc-500">{template.items.length} item(ns)</p>
                        <form action={duplicateChecklistTemplate} className="mt-3 rounded-lg border border-sky-300/20 bg-sky-300/5 p-3">
                          <input type="hidden" name="templateId" value={template.id} />
                          <div className="mb-3 flex items-center gap-2">
                            <Copy size={16} className="text-sky-300" />
                            <p className="text-sm font-semibold text-sky-100">Duplicar como novo template</p>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <input name="targetTypeName" className={inputClass} defaultValue={`${type.name} - copia`} placeholder="Novo tipo/template" />
                            <input name="targetTemplateTitle" className={inputClass} defaultValue={`Copia de ${template.title}`} placeholder="Titulo da nova checklist" />
                            <input name="targetVersion" className={inputClass} defaultValue={template.version} placeholder="Versao" />
                            <input name="targetTypeDescription" className={inputClass} defaultValue={type.description ?? ""} placeholder="Descricao do tipo" />
                          </div>
                          <textarea
                            name="targetNotes"
                            className="mt-2 min-h-20 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-sky-300/60"
                            defaultValue={template.notes ?? ""}
                            placeholder="Notas da nova checklist"
                          />
                          <button className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-sky-300/35 bg-sky-300/10 px-3 text-sm font-semibold text-sky-100 transition hover:border-sky-200/70">
                            <Copy size={15} />
                            Criar novo template
                          </button>
                        </form>
                        <ChecklistTemplateBuilder
                          action={updateChecklistTemplate}
                          expectedConditions={expectedConditionNames}
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
                </details>
              ))
            )}
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
