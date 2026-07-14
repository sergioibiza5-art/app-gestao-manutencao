"use client";

import { X } from "lucide-react";

type DetailsCloseButtonProps = {
  targetId: string;
  label?: string;
};

export function DetailsCloseButton({ targetId, label = "Fechar" }: DetailsCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        document.getElementById(targetId)?.removeAttribute("open");
      }}
      className="ml-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-800 px-3 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/50"
    >
      <X size={16} />
      {label}
    </button>
  );
}
