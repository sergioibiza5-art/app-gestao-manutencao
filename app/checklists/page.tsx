import { Rows3 } from "lucide-react";

import { createEquipmentTypeWithChecklist } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { buttonClass, EmptyState, inputClass, PageHeader, Panel, textareaClass } from "@/app/components/ui";
import { getChecklistAdminData } from "@/lib/data";

export const dynamic = "force-dynamic";

const forkliftTemplate = [
  "Nível de combustível/bateria | Dentro dos parâmetros corretos | foto",
  "Estado da bateria | Terminais limpos, sem corrosão, cabos íntegros | foto",
  "Óleo do motor/hidráulico | Sem fugas | foto",
  "Líquido de refrigeração | Sem fugas",
  "Travões | Funcionamento correto",
  "Direção | Sem folgas ou ruídos anormais",
  "Pneus | Pressão correta, sem desgaste irregular | foto",
  "Garfos | Sem deformações ou fissuras | foto",
  "Correntes de elevação | Lubrificadas, sem desgaste excessivo",
  "Sinais acústicos e luminosos | Funcionamento correto",
  "Estrutura geral | Cabine, proteções e cintos em bom estado | foto",
  "Sistema hidráulico | Funcionamento normal e sem fugas | foto",
].join("\n");

export default async function ChecklistsPage() {
  const { equipmentTypes } = await getChecklistAdminData();

  return (
    <AppShell activeHref="/checklists">
      <PageHeader
        eyebrow="Templates"
        title="Checklists por tipo de equipamento"
        description="Cria modelos diferentes por tipo de equipamento. Cada checklist pode pedir OK/NOK/N/A, observações e fotos por item."
      />

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <Rows3 size={22} className="text-sky-300" />
            <h2 className="text-xl font-semibold text-zinc-50">Novo template</h2>
          </div>
          <form action={createEquipmentTypeWithChecklist} className="mt-4 space-y-3">
            <input name="typeName" required className={inputClass} placeholder="Tipo de equipamento, ex.: Empilhador" />
            <input name="templateTitle" className={inputClass} placeholder="Título do template" />
            <div className="grid grid-cols-2 gap-3">
              <input name="version" defaultValue="1.0" className={inputClass} placeholder="Versão" />
              <input name="description" className={inputClass} placeholder="Descrição do tipo" />
            </div>
            <textarea
              name="items"
              required
              className="min-h-80 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-teal-300/60"
              defaultValue={forkliftTemplate}
              placeholder="Verificar | Condição esperada | foto"
            />
            <textarea name="notes" className={textareaClass} placeholder="Notas do template" />
            <button className={buttonClass}>Guardar template</button>
          </form>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold text-zinc-50">Templates existentes</h2>
          <div className="mt-4 space-y-3">
            {equipmentTypes.length === 0 ? (
              <EmptyState title="Sem templates" description="Cria o primeiro tipo de equipamento para começar a usar checklists nas manutenções internas." />
            ) : (
              equipmentTypes.map((type) => (
                <article key={type.id} className="rounded-lg border border-zinc-800 bg-zinc-950/65 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{type.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{type.description ?? "Sem descrição"}</p>
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
                        <div className="mt-3 grid gap-2">
                          {template.items.slice(0, 6).map((item) => (
                            <div key={item.id} className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-400">
                              {item.order}. {item.check}
                            </div>
                          ))}
                          {template.items.length > 6 && (
                            <p className="text-xs text-zinc-600">+ {template.items.length - 6} itens</p>
                          )}
                        </div>
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
