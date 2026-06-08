"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { buttonClass, inputClass, textareaClass } from "@/app/components/ui";

type ChecklistTemplateBuilderProps = {
  action: (formData: FormData) => void | Promise<void>;
};

const expectedOptions = [
  "Dentro dos parametros corretos",
  "Sem fugas",
  "Funcionamento correto",
  "Sem desgaste irregular",
  "Limpo e em bom estado",
  "Sem folgas ou ruidos anormais",
  "Condicao conforme criterio definido",
];

const initialRows = [
  { check: "Nivel de combustivel/bateria", expected: "Dentro dos parametros corretos", photo: true },
  { check: "Estado da bateria", expected: "Limpo e em bom estado", photo: true },
  { check: "Oleo do motor/hidraulico", expected: "Sem fugas", photo: true },
];

export function ChecklistTemplateBuilder({ action }: ChecklistTemplateBuilderProps) {
  const [rows, setRows] = useState(initialRows);

  function updateRow(index: number, field: "check" | "expected" | "photo", value: string | boolean) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { check: "", expected: "Condicao conforme criterio definido", photo: false }]);
  }

  function removeRow(index: number) {
    setRows((current) => (current.length > 1 ? current.filter((_, rowIndex) => rowIndex !== index) : current));
  }

  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="typeName" required className={inputClass} placeholder="Tipo de equipamento, ex.: Empilhador" />
      <input name="templateTitle" className={inputClass} placeholder="Titulo do template" />
      <div className="grid grid-cols-2 gap-3">
        <input name="version" defaultValue="1.0" className={inputClass} placeholder="Versao" />
        <input name="description" className={inputClass} placeholder="Descricao do tipo" />
      </div>

      <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/45 p-3">
        <div className="grid grid-cols-[1fr_1fr_72px_42px] gap-2 px-1 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
          <span>Verificar</span>
          <span>Condicao esperada</span>
          <span>Foto</span>
          <span />
        </div>
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_72px_42px] gap-2">
            <input name="itemCheck" className={inputClass} value={row.check} onChange={(event) => updateRow(index, "check", event.target.value)} placeholder="Verificar" />
            <select name="itemExpectedCondition" className={inputClass} value={row.expected} onChange={(event) => updateRow(index, "expected", event.target.value)}>
              {expectedOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <label className="grid h-11 place-items-center rounded-lg border border-zinc-800 bg-zinc-950">
              <input name="itemPhotoRequired" value={String(index)} type="checkbox" checked={row.photo} onChange={(event) => updateRow(index, "photo", event.target.checked)} className="size-4 accent-teal-300" />
            </label>
            <button type="button" onClick={() => removeRow(index)} className="grid h-11 place-items-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-500 transition hover:border-rose-300/40 hover:text-rose-200" aria-label="Remover linha">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addRow} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-100 transition hover:border-sky-300/50">
          <Plus size={16} />
          Adicionar linha
        </button>
      </div>

      <textarea name="notes" className={textareaClass} placeholder="Notas do template" />
      <button className={buttonClass}>Guardar template</button>
    </form>
  );
}
