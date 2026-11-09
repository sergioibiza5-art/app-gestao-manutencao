"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { updateConsumable } from "@/app/actions";
import { buttonClass } from "@/app/components/ui";

export function ConsumableEditForm({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; saved?: boolean }>({});

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFeedback({});
    startTransition(async () => {
      try {
        setFeedback(await updateConsumable(data));
      } catch {
        setFeedback({ error: "Não foi possível confirmar a gravação. Verifica a ligação e volta a consultar a ficha." });
      }
    });
  }

  return <form onSubmit={save} className="grid gap-3 lg:grid-cols-2">
    {children}
    <div className="lg:col-span-2">
      {feedback.error && <p role="alert" className="mb-2 text-rose-300">{feedback.error}</p>}
      {feedback.saved && <p role="status" className="mb-2 text-teal-300">Alterações guardadas.</p>}
      <button disabled={pending} className={buttonClass}>{pending ? "A guardar…" : "Guardar alterações"}</button>
    </div>
  </form>;
}
