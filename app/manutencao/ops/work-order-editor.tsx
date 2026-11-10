"use client";

import { useState, useTransition, type FormEvent } from "react";
import { buttonClass, inputClass, textareaClass } from "@/app/components/ui";
import { saveWorkOrderDetails } from "./edit-action";

type EditableOrder = {
  id: string; version: string; title: string; type: string; performedBy: string | null;
  actionsDone: string | null; result: string | null; notes: string | null; supplier?: string | null;
};

export function WorkOrderEditor({ order }: { order: EditableOrder }) {
  const [version, setVersion] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!version) return;
    const form = new FormData(event.currentTarget);
    setMessage("");
    startTransition(async () => {
      try {
        const response = await saveWorkOrderDetails(order.id, version, form);
        if (response.error) return setMessage(response.error);
        setVersion(null);
        setMessage("Alterações guardadas.");
      } catch {
        setMessage("Não foi possível confirmar a gravação. Volta a consultar a ficha.");
      }
    });
  }

  return <section>
    {version ? <form onSubmit={save} className="glass-panel grid gap-4 rounded-lg p-4 sm:grid-cols-2">
      <h2 className="text-xl font-semibold sm:col-span-2">Editar OP</h2>
      <label className="grid gap-1">Título da intervenção<input name="title" required defaultValue={order.title} className={inputClass} /></label>
      <label className="grid gap-1">Tipo<select name="type" defaultValue={order.type} className={inputClass}><option value="INTERNAL">Interna</option><option value="EXTERNAL">Externa</option></select></label>
      <label className="grid gap-1">Executado por<input name="performedBy" defaultValue={order.performedBy ?? ""} className={inputClass} /></label>
      {order.supplier !== undefined && <label className="grid gap-1">Fornecedor<input name="supplier" defaultValue={order.supplier ?? ""} className={inputClass} /></label>}
      <label className="grid gap-1 sm:col-span-2">Trabalho executado<textarea name="actionsDone" defaultValue={order.actionsDone ?? ""} className={textareaClass} /></label>
      <label className="grid gap-1 sm:col-span-2">Resultado<input name="result" defaultValue={order.result ?? ""} className={inputClass} /></label>
      <label className="grid gap-1 sm:col-span-2">Notas<textarea name="notes" defaultValue={order.notes ?? ""} className={textareaClass} /></label>
      <div className="flex gap-3"><button disabled={pending} className={buttonClass}>{pending ? "A guardar…" : "Guardar alterações"}</button>
        <button type="button" disabled={pending} onClick={() => { setVersion(null); setMessage(""); }}>Cancelar</button></div>
    </form> : <button className={buttonClass} onClick={() => { setMessage(""); setVersion(order.version); }}>Editar OP</button>}
    {message && <p role="status" className="mt-2">{message}</p>}
  </section>;
}
