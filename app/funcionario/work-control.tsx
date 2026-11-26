"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play, Square } from "lucide-react";
import { employeeWorkAction } from "./actions";

export function EmployeeWorkControl({ id, command }: { id: string; command: "resume" | "finish" | "cq-arrive" | "cq-end" }) {
  const [result, action, pending] = useActionState(employeeWorkAction, {});
  const router = useRouter();
  useEffect(() => { if (result.success) router.refresh(); }, [result, router]);
  const starting = command === "resume" || command === "cq-arrive";
  const label = command === "resume" ? "Retomar atividade" : command === "finish" ? "Terminar a minha atividade" : command === "cq-arrive" ? "Iniciar o meu CQ" : "Terminar o meu CQ";
  return <form action={action} className="min-w-0">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="command" value={command} />
    <button disabled={pending} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${starting ? "border-teal-300/50 bg-teal-300/10 text-teal-100" : "border-amber-200/40 text-amber-100"}`}>
      {starting ? <Play size={16} className="shrink-0" /> : <Square size={16} className="shrink-0" />}{pending ? "A guardar..." : label}
    </button>
    {(result.error || result.success) && <p role="status" className={`mt-2 max-w-sm break-words text-sm ${result.error ? "text-rose-200" : "text-teal-200"}`}>{result.error || result.success}</p>}
  </form>;
}
