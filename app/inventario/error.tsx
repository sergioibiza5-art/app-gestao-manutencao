"use client";

import { buttonClass, Panel } from "@/app/components/ui";

export default function InventoryError({ reset }: { reset: () => void }) {
  return (
    <Panel>
      <h2 className="text-xl font-semibold text-zinc-50">Não foi possível carregar o inventário</h2>
      <p role="alert" className="mt-2 text-zinc-400">Ocorreu um erro ao consultar os produtos. Isto não significa que o stock esteja vazio.</p>
      <button type="button" onClick={reset} className={`${buttonClass} mt-4`}>Tentar novamente</button>
    </Panel>
  );
}
