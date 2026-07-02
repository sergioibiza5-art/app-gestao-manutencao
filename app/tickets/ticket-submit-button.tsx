"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Siren } from "lucide-react";

import { buttonClass } from "@/app/components/ui";

export function TicketSubmitButton() {
  const { pending } = useFormStatus();
  const [locked, setLocked] = useState(false);
  const disabled = pending || locked;

  return (
    <button
      className={buttonClass}
      disabled={disabled}
      onClick={(event) => {
        const form = event.currentTarget.form;
        if (form?.checkValidity()) {
          setLocked(true);
        }
      }}
    >
      <Siren size={17} />
      {disabled ? "A enviar..." : "Criar ticket"}
    </button>
  );
}
