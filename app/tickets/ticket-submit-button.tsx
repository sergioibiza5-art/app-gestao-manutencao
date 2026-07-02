"use client";

import { useFormStatus } from "react-dom";
import { Siren } from "lucide-react";

import { buttonClass } from "@/app/components/ui";

export function TicketSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className={buttonClass} disabled={pending}>
      <Siren size={17} />
      {pending ? "A enviar..." : "Criar ticket"}
    </button>
  );
}
